import crypto from 'crypto';
import { Generation, GenerationMode, GenerationAttemptLog, AssetType } from '../../src/types/index.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { smartRouterService } from './smartRouterService.js';
import { walletService } from './walletService.js';
import { assetReferenceResolver } from './assetReferenceResolver.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { assetRepository } from '../repositories/assetRepository.js';

interface GenerationReferenceInput {
  asset_id: string;
  slot_type?: 'INITIAL' | 'END' | 'GENERAL';
  alias?: string;
}

interface StartParams {
  userId: string;
  model_id: string;
  mode?: GenerationMode;
  prompt: string;
  negative_prompt?: string;
  duration_seconds: number;
  resolution: string;
  aspect_ratio: string;
  number_of_outputs: number;
  seed?: number | null;
  motion_strength?: number | null;
  references?: GenerationReferenceInput[];
  requested_provider_id?: string;
  client_request_id?: string;
  maximum_authorized_cost_cents?: number;
  reqHost?: string;
  idToken?: string;
}

const IMAGE_MODEL_IDS = new Set([
  'nano-banana-pro-image',
  'nano-banana-2-image',
  'seedream-5-pro-image',
  'gpt-image-2',
]);

function isImageMode(mode?: GenerationMode) {
  return mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE';
}

function inferMode(refs: GenerationReferenceInput[], requested: GenerationMode | undefined, modelId: string): GenerationMode {
  if (requested) return requested;
  if (IMAGE_MODEL_IDS.has(modelId)) return refs.length ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
  if (!refs.length) return 'TEXT_TO_VIDEO';
  if (refs.some((r) => r.slot_type === 'INITIAL')) return 'IMAGE_TO_VIDEO';
  return 'REFERENCE_TO_VIDEO';
}

function terminal(status: string) {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status);
}

async function registerGeneratedAssets(generation: Generation, urls: string[]) {
  const mediaType: AssetType = isImageMode(generation.mode) ? 'IMAGE' : 'VIDEO';
  const created = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    if (!url) continue;
    try {
      const asset = await assetRepository.createAsset({
        owner_user_id: generation.user_id,
        type: mediaType,
        category: 'GENERIC',
        name: mediaType === 'IMAGE'
          ? `Imagem gerada ${generation.generation_id.slice(-6)}${urls.length > 1 ? ` ${index + 1}` : ''}`
          : `Vídeo gerado ${generation.generation_id.slice(-6)}${urls.length > 1 ? ` ${index + 1}` : ''}`,
        alias: `${mediaType === 'IMAGE' ? 'generated_image' : 'generated_video'}_${generation.generation_id.slice(-6)}${urls.length > 1 ? `_${index + 1}` : ''}`,
        storage_path: `provider://${generation.provider_id}/${generation.provider_job_id || generation.generation_id}/${index + 1}`,
        public_url: url,
        thumbnail_url: mediaType === 'IMAGE' ? url : generation.thumbnail_url || '',
        mime_type: mediaType === 'IMAGE' ? 'image/jpeg' : 'video/mp4',
        size_bytes: 0,
        status: 'READY',
        origin: 'GENERATED',
        source_generation_id: generation.generation_id,
        source_model_id: generation.model_id,
        source_provider_id: generation.provider_id,
      });
      created.push(asset);
    } catch (err: any) {
      console.warn('[GeneratedAssetRegister]', generation.generation_id, err?.message || err);
    }
  }
  return created;
}

export const generationService = {
  async createAndStartGeneration(params: StartParams): Promise<Generation> {
    if (!params.model_id || !params.prompt?.trim()) {
      throw Object.assign(new Error('Modelo e prompt são obrigatórios.'), { code: 'VALIDATION_ERROR' });
    }

    const refs = params.references || [];
    const mode = inferMode(refs, params.mode, params.model_id);
    const imageJob = isImageMode(mode);
    const billDuration = imageJob ? 1 : params.duration_seconds;

    if (!imageJob && (!Number.isInteger(params.duration_seconds) || params.duration_seconds <= 0)) {
      throw Object.assign(new Error('Duração inválida.'), { code: 'VALIDATION_ERROR' });
    }
    if (!Number.isInteger(params.number_of_outputs) || params.number_of_outputs < 1 || params.number_of_outputs > 4) {
      throw Object.assign(new Error('Quantidade de saídas inválida.'), { code: 'VALIDATION_ERROR' });
    }
    if (mode === 'IMAGE_TO_IMAGE' && !refs.length) {
      throw Object.assign(new Error('Adicione pelo menos uma imagem de referência para editar.'), { code: 'REFERENCE_REQUIRED' });
    }

    const clientId = params.client_request_id || crypto.randomUUID();
    const existing = await generationRepository.findByClientRequest(params.userId, clientId);
    if (existing) return existing;

    const generationId = `gen_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const decision = await smartRouterService.selectProvider({
      userId: params.userId,
      model_id: params.model_id,
      mode,
      prompt: params.prompt.trim(),
      negative_prompt: params.negative_prompt,
      duration_seconds: billDuration,
      resolution: params.resolution,
      aspect_ratio: params.aspect_ratio,
      number_of_outputs: params.number_of_outputs,
      seed: params.seed,
      motion_strength: params.motion_strength,
      generation_id: generationId,
    });

    const reserveAmount = decision.selected.customer_price_cents;
    const authorized = Number(params.maximum_authorized_cost_cents);
    if (Number.isFinite(authorized) && authorized > 0 && reserveAmount > authorized) {
      throw Object.assign(new Error('O preço mudou desde a estimativa. Atualize a cotação antes de gerar; nenhum saldo foi reservado.'), {
        code: 'PRICE_CHANGED_REQUOTE_REQUIRED',
        quoted_price_cents: authorized,
        current_price_cents: reserveAmount,
      });
    }

    const now = new Date().toISOString();
    let generation: Generation = {
      generation_id: generationId,
      user_id: params.userId,
      status: 'QUEUED',
      model_id: params.model_id,
      provider_id: decision.selected.provider_id,
      mode,
      original_prompt: params.prompt.trim(),
      compiled_prompt: params.prompt.trim(),
      prompt_compiler_version: 'stage4-unified-media-1.0',
      duration_seconds: imageJob ? undefined : params.duration_seconds,
      resolution: params.resolution,
      aspect_ratio: params.aspect_ratio,
      estimated_cost_cents: reserveAmount,
      maximum_authorized_cost_cents: reserveAmount,
      final_cost_cents: 0,
      currency: 'BRL',
      client_request_id: clientId,
      progress_percent: 0,
      result_asset_id: null,
      result_url: null,
      thumbnail_url: null,
      error_code: null,
      error_message: null,
      attempt_count: 0,
      references_count: refs.length,
      created_at: now,
      submitted_at: null,
      completed_at: null,
      failed_at: null,
    };

    await generationRepository.saveGeneration(generation);
    generation.status = 'RESERVING_FUNDS';
    await generationRepository.saveGeneration(generation);

    await walletService.reserveForGeneration({
      userId: params.userId,
      amount_cents: reserveAmount,
      generation_id: generationId,
      idempotency_key: `reserve:${generationId}`,
      description: `Reserva geração ${params.model_id}`,
    });

    try {
      const resolved = await assetReferenceResolver.resolveReferenceAssetUrls(
        params.userId,
        refs.map((r) => r.asset_id),
        params.reqHost,
        params.idToken
      );

      const enriched = resolved.map((asset) => {
        const source = refs.find((ref) => ref.asset_id === asset.asset_id);
        return {
          ...asset,
          slot_type: (source?.slot_type || 'GENERAL') as 'INITIAL' | 'END' | 'GENERAL',
          prompt_alias: source?.alias || asset.alias,
        };
      });

      const compatible = [
        decision.selected,
        ...decision.candidates.filter(
          (candidate) => candidate.provider_id !== decision.selected.provider_id && candidate.customer_price_cents <= reserveAmount
        ),
      ];
      let lastError: any = null;

      for (let i = 0; i < compatible.length; i++) {
        const candidate = compatible[i];
        const adapter = providerRegistry.getAdapter(candidate.provider_id);
        if (!adapter || !adapter.isConfigured()) continue;

        const attempt: GenerationAttemptLog = {
          attempt_id: `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          generation_id: generationId,
          attempt_number: i + 1,
          provider_id: candidate.provider_id,
          status: 'SUBMITTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          generation.provider_id = candidate.provider_id;
          generation.attempt_count = i + 1;
          await generationRepository.saveGeneration(generation);

          const job = await adapter.submitGeneration({
            generation_id: generationId,
            user_id: params.userId,
            model_id: params.model_id,
            mode,
            prompt: params.prompt.trim(),
            negative_prompt: params.negative_prompt,
            duration_seconds: billDuration,
            resolution: params.resolution,
            aspect_ratio: params.aspect_ratio,
            number_of_outputs: params.number_of_outputs,
            seed: params.seed,
            motion_strength: params.motion_strength,
            references: enriched,
          });

          attempt.provider_job_id = job.provider_job_id;
          attempt.updated_at = new Date().toISOString();
          await generationRepository.recordAttemptLog(attempt);
          generation.provider_job_id = job.provider_job_id;
          generation.status = 'SUBMITTED';
          generation.submitted_at = new Date().toISOString();
          await generationRepository.saveGeneration(generation);
          return generation;
        } catch (err: any) {
          lastError = err;
          attempt.status = 'FAILED';
          attempt.error_message = err?.message || 'Falha ao enviar';
          attempt.updated_at = new Date().toISOString();
          await generationRepository.recordAttemptLog(attempt);
        }
      }

      throw lastError || Object.assign(new Error('Todos os providers compatíveis falharam antes de aceitar o job.'), { code: 'PROVIDER_SUBMISSION_FAILED' });
    } catch (err: any) {
      await walletService.releaseForGeneration({
        userId: params.userId,
        amount_cents: reserveAmount,
        generation_id: generationId,
        idempotency_key: `release:${generationId}:submit-failure`,
        reason: 'Liberação por falha antes do processamento',
      }).catch(() => {});
      generation.status = 'FAILED';
      generation.error_code = err?.code || 'GENERATION_SUBMIT_FAILED';
      generation.error_message = err?.message || 'Falha ao iniciar geração';
      generation.failed_at = new Date().toISOString();
      await generationRepository.saveGeneration(generation);
      throw err;
    }
  },

  async refreshGenerationState(generation: Generation): Promise<Generation> {
    if (terminal(generation.status) || !generation.provider_job_id) return generation;
    const adapter = providerRegistry.getAdapter(generation.provider_id);
    if (!adapter || !adapter.isConfigured()) return generation;

    let status;
    try {
      status = await adapter.checkStatus(generation.provider_job_id);
    } catch (err: any) {
      console.warn('[GenerationPoll]', generation.generation_id, err?.message);
      return generation;
    }

    if (status.status === 'QUEUED' || status.status === 'PROCESSING') {
      generation.status = status.status;
      generation.progress_percent = status.progress_percent ?? generation.progress_percent;
      return generationRepository.saveGeneration(generation);
    }

    if (status.status === 'FAILED') {
      const reserved = generation.maximum_authorized_cost_cents || generation.estimated_cost_cents || 0;
      if (reserved > 0) {
        await walletService.releaseForGeneration({
          userId: generation.user_id,
          amount_cents: reserved,
          generation_id: generation.generation_id,
          idempotency_key: `release:${generation.generation_id}:provider-failure`,
          reason: 'Provider finalizou com falha',
        }).catch(() => {});
      }
      generation.status = 'FAILED';
      generation.progress_percent = 0;
      generation.error_code = status.error_code || 'PROVIDER_GENERATION_FAILED';
      generation.error_message = status.error_message || 'A geração falhou no provider.';
      generation.failed_at = new Date().toISOString();
      return generationRepository.saveGeneration(generation);
    }

    const finalCost = generation.estimated_cost_cents || 0;
    if (finalCost > 0) {
      await walletService.captureForGeneration({
        userId: generation.user_id,
        amount_cents: finalCost,
        generation_id: generation.generation_id,
        idempotency_key: `capture:${generation.generation_id}`,
      });
    }

    const outputs = (status.result_urls || status.result_image_urls || [status.result_video_url]).filter(Boolean) as string[];
    generation.status = 'SUCCEEDED';
    generation.progress_percent = 100;
    generation.final_cost_cents = finalCost;
    generation.completed_at = new Date().toISOString();
    generation.result_url = outputs[0] || null;
    generation.thumbnail_url = isImageMode(generation.mode) ? outputs[0] || null : status.thumbnail_url || null;
    (generation as Generation & { result_urls?: string[] }).result_urls = outputs;

    if (outputs.length) {
      const assets = await registerGeneratedAssets(generation, outputs);
      if (assets[0]) generation.result_asset_id = assets[0].asset_id;
      (generation as Generation & { result_asset_ids?: string[] }).result_asset_ids = assets.map((asset) => asset.asset_id);
    }
    return generationRepository.saveGeneration(generation);
  },

  async getGeneration(id: string, userId: string) {
    const generation = await generationRepository.getGeneration(id);
    if (!generation || generation.user_id !== userId) return null;
    return this.refreshGenerationState(generation);
  },

  async listUserGenerations(userId: string, limit = 50) {
    const list = await generationRepository.listUserGenerations(userId, limit);
    return Promise.all(list.map((generation) => terminal(generation.status) ? generation : this.refreshGenerationState(generation)));
  },

  async cancelGeneration(id: string, userId: string) {
    const generation = await generationRepository.getGeneration(id);
    if (!generation || generation.user_id !== userId) throw new Error('Geração não encontrada.');
    if (terminal(generation.status)) return generation;

    if (generation.provider_job_id) {
      const adapter = providerRegistry.getAdapter(generation.provider_id);
      const cancelled = adapter?.cancelJob ? await adapter.cancelJob(generation.provider_job_id) : false;
      if (!cancelled) throw new Error('Este provider não permite cancelar depois que o job foi enviado.');
    }

    const reserved = generation.maximum_authorized_cost_cents || generation.estimated_cost_cents || 0;
    if (reserved > 0) {
      await walletService.releaseForGeneration({
        userId,
        amount_cents: reserved,
        generation_id: id,
        idempotency_key: `release:${id}:cancel`,
        reason: 'Cancelamento do usuário',
      });
    }
    generation.status = 'CANCELLED';
    generation.failed_at = new Date().toISOString();
    return generationRepository.saveGeneration(generation);
  },
};
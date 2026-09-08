import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { walletService } from './walletService.js';
import { assetReferenceResolver } from './assetReferenceResolver.js';
import { smartRouterService } from './smartRouterService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import {
  Generation,
  GenerationMode,
  GenerationAttemptLog,
  ReferenceSlot,
  ReferenceRules,
} from '../../src/types/index.js';

export interface CreateGenerationParams {
  userId: string;
  model_id: string;
  prompt: string;
  negative_prompt?: string;
  duration_seconds: number;
  resolution: string;
  aspect_ratio?: string;
  number_of_outputs?: number;
  seed?: number | null;
  motion_strength?: number | null;
  references?: Array<{
    asset_id: string;
    alias?: string;
    slot_type?: ReferenceSlot;
    rules?: ReferenceRules;
  }>;
  requested_provider_id?: string;
  client_request_id?: string;
  reqHost?: string;
}

export const generationService = {
  /**
   * Deterministically resolves generation mode from input references.
   */
  resolveMode(references: CreateGenerationParams['references']): GenerationMode {
    if (!references || references.length === 0) {
      return 'TEXT_TO_VIDEO';
    }
    const hasInitial = references.some((r) => r.slot_type === 'INITIAL');
    const hasEnd = references.some((r) => r.slot_type === 'END');
    if (hasInitial && hasEnd) {
      return 'START_END_TO_VIDEO';
    }
    if (hasInitial && references.length === 1) {
      return 'IMAGE_TO_VIDEO';
    }
    return 'REFERENCE_TO_VIDEO';
  },

  /**
   * Server-side prompt compilation to ensure deterministic provider input.
   */
  compilePrompt(params: {
    prompt: string;
    negative_prompt?: string;
    mode: GenerationMode;
    references?: CreateGenerationParams['references'];
    aspect_ratio?: string;
    duration_seconds: number;
  }): string {
    const parts: string[] = [params.prompt.trim()];

    if (params.references && params.references.length > 0) {
      const refNotes: string[] = [];
      for (const ref of params.references) {
        if (ref.rules?.preservation_rules && ref.rules.preservation_rules.length > 0) {
          refNotes.push(
            `Preserve features for @${ref.alias || 'ref'}: ${ref.rules.preservation_rules.join(', ')}`
          );
        }
      }
      if (refNotes.length > 0) {
        parts.push(`[Technical Constraints: ${refNotes.join('; ')}]`);
      }
    }

    if (params.aspect_ratio) {
      parts.push(`[Aspect: ${params.aspect_ratio}]`);
    }

    return parts.join(' ');
  },

  /**
   * Primary entrypoint: validates, reserves funds, routes, submits, and monitors generation.
   */
  async createAndStartGeneration(params: CreateGenerationParams): Promise<Generation> {
    const {
      userId,
      model_id,
      prompt,
      negative_prompt,
      duration_seconds = 5,
      resolution = '720p',
      aspect_ratio = '16:9',
      number_of_outputs = 1,
      seed,
      motion_strength,
      references = [],
      requested_provider_id,
      client_request_id,
      reqHost,
    } = params;

    // 1. Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      const err: any = new Error('O prompt de geração é obrigatório.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 2. Validate model existence
    const model = await catalogRepository.getModel(model_id);
    if (!model) {
      const err: any = new Error(`Modelo de IA '${model_id}' não encontrado no catálogo.`);
      err.code = 'RESOURCE_NOT_FOUND';
      throw err;
    }

    // 3. Resolve Mode & Compile Prompt
    const mode = this.resolveMode(references);
    const compiled_prompt = this.compilePrompt({
      prompt,
      negative_prompt,
      mode,
      references,
      aspect_ratio,
      duration_seconds,
    });

    const generationId = `gen_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const idempotencyKey = client_request_id || `req_${generationId}`;

    // 4. Select Optimal Route via Smart Router
    const route = await smartRouterService.selectBestRoute({
      userId,
      modelId: model_id,
      resolution,
      durationSeconds: duration_seconds,
      requestedProviderId: requested_provider_id,
      strategy: 'CHEAPEST_RELIABLE',
      generationId,
    });

    const estimatedCostCents = route.customer_price_cents * number_of_outputs;

    // 5. Create Initial Generation Document in QUEUED state
    const now = new Date().toISOString();
    let generation: Generation = {
      generation_id: generationId,
      user_id: userId,
      status: 'QUEUED',
      model_id,
      provider_id: route.selected_provider_id,
      mode,
      original_prompt: prompt,
      compiled_prompt,
      prompt_compiler_version: 'v3.0.0-prod',
      duration_seconds,
      resolution,
      aspect_ratio,
      estimated_cost_cents: estimatedCostCents,
      maximum_authorized_cost_cents: estimatedCostCents,
      final_cost_cents: 0,
      currency: 'BRL',
      client_request_id: idempotencyKey,
      progress_percent: 0,
      references_count: references.length,
      attempt_count: 1,
      created_at: now,
    };

    await generationRepository.saveGeneration(generation);

    // 6. Step: RESERVING_FUNDS (Zero-Trust wallet reservation before provider call)
    generation.status = 'RESERVING_FUNDS';
    await generationRepository.saveGeneration(generation);

    try {
      await walletService.reserveForGeneration({
        userId,
        amount_cents: estimatedCostCents,
        generation_id: generationId,
        idempotency_key: `res_${generationId}`,
        description: `Reserva para geração ${model.name} (${resolution}, ${duration_seconds}s)`,
      });
    } catch (reserveErr: any) {
      generation.status = 'FAILED';
      generation.error_code = reserveErr.code || 'WALLET_INSUFFICIENT_FUNDS';
      generation.error_message = reserveErr.message;
      generation.failed_at = new Date().toISOString();
      await generationRepository.saveGeneration(generation);
      throw reserveErr;
    }

    // 7. Resolve Reference Asset URLs (Generates temporary secure signed URLs for providers)
    const assetIds = references.map((r) => r.asset_id).filter(Boolean);
    const resolvedAssetRefs = await assetReferenceResolver.resolveReferenceAssetUrls(
      userId,
      assetIds,
      reqHost
    );

    // 8. Submit to Provider Adapter
    let activeProviderId = route.selected_provider_id;
    let adapter = providerRegistry.getAdapter(activeProviderId);

    if (!adapter) {
      // Release reserved funds if adapter missing
      await walletService.releaseForGeneration({
        userId,
        amount_cents: estimatedCostCents,
        generation_id: generationId,
        idempotency_key: `rel_${generationId}`,
        reason: 'Provedor indisponível',
      });
      generation.status = 'FAILED';
      generation.error_code = 'PROVIDER_UNAVAILABLE';
      generation.error_message = `Provedor '${activeProviderId}' não possui adaptador configurado.`;
      generation.failed_at = new Date().toISOString();
      await generationRepository.saveGeneration(generation);
      throw new Error(generation.error_message);
    }

    // Attempt Submission
    const attemptStartTime = Date.now();
    let submitResult;

    try {
      submitResult = await adapter.submitGeneration({
        generation_id: generationId,
        user_id: userId,
        model_id,
        mode,
        prompt: compiled_prompt,
        negative_prompt,
        duration_seconds,
        resolution,
        aspect_ratio,
        number_of_outputs,
        seed,
        motion_strength,
        references: resolvedAssetRefs,
      });
    } catch (submitErr: any) {
      console.warn(`[GenerationService] Primary provider '${activeProviderId}' failed submission, trying fallback:`, submitErr.message);

      // Attempt fallback route if available
      let fallbackSuccess = false;
      for (const fallbackId of route.fallback_provider_ids) {
        const fallbackAdapter = providerRegistry.getAdapter(fallbackId);
        if (fallbackAdapter) {
          try {
            activeProviderId = fallbackId;
            adapter = fallbackAdapter;
            submitResult = await fallbackAdapter.submitGeneration({
              generation_id: generationId,
              user_id: userId,
              model_id,
              mode,
              prompt: compiled_prompt,
              negative_prompt,
              duration_seconds,
              resolution,
              aspect_ratio,
              number_of_outputs,
              seed,
              motion_strength,
              references: resolvedAssetRefs,
            });
            fallbackSuccess = true;
            break;
          } catch (fbErr: any) {
            console.warn(`[GenerationService] Fallback provider '${fallbackId}' also failed:`, fbErr.message);
          }
        }
      }

      if (!fallbackSuccess) {
        // Release reserved funds immediately upon total submission failure
        await walletService.releaseForGeneration({
          userId,
          amount_cents: estimatedCostCents,
          generation_id: generationId,
          idempotency_key: `rel_${generationId}`,
          reason: 'Falha no envio para provedores de IA',
        });
        generation.status = 'FAILED';
        generation.error_code = 'PROVIDER_SUBMIT_FAILED';
        generation.error_message = `Falha ao despachar para provedores de IA: ${submitErr.message}`;
        generation.failed_at = new Date().toISOString();
        await generationRepository.saveGeneration(generation);
        throw submitErr;
      }
    }

    // 9. Transition to SUBMITTED / PROCESSING
    generation.provider_id = activeProviderId;
    generation.provider_job_id = submitResult!.provider_job_id;
    generation.status = 'PROCESSING';
    generation.submitted_at = new Date().toISOString();
    generation.progress_percent = 15;
    await generationRepository.saveGeneration(generation);

    // Record attempt log
    const attemptLog: GenerationAttemptLog = {
      attempt_id: `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      generation_id: generationId,
      attempt_number: 1,
      provider_id: activeProviderId,
      provider_job_id: submitResult!.provider_job_id,
      status: 'PROCESSING',
      latency_ms: Date.now() - attemptStartTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await generationRepository.recordAttemptLog(attemptLog);

    // 10. Start Background Lifecycle Poller
    this.startBackgroundPoller(generationId, userId, activeProviderId, submitResult!.provider_job_id, estimatedCostCents);

    return generation;
  },

  /**
   * Background monitoring loop that polls provider status until SUCCEEDED or FAILED.
   * On SUCCEEDED -> captures funds.
   * On FAILED -> releases reserved funds.
   */
  startBackgroundPoller(
    generationId: string,
    userId: string,
    providerId: string,
    providerJobId: string,
    authorizedCostCents: number
  ) {
    const adapter = providerRegistry.getAdapter(providerId);
    if (!adapter) return;

    let pollCount = 0;
    const maxPolls = 180; // Up to ~9 minutes (every 3 seconds)

    const interval = setInterval(async () => {
      pollCount++;

      try {
        const generation = await generationRepository.getGeneration(generationId);
        if (!generation || generation.status === 'CANCELLED' || generation.status === 'SUCCEEDED' || generation.status === 'FAILED') {
          clearInterval(interval);
          return;
        }

        const statusRes = await adapter.checkStatus(providerJobId);

        if (statusRes.status === 'PROCESSING') {
          generation.progress_percent = Math.min(95, Math.max(generation.progress_percent || 15, statusRes.progress_percent));
          await generationRepository.saveGeneration(generation);
        } else if (statusRes.status === 'SUCCEEDED') {
          clearInterval(interval);

          // 1. Capture reserved funds
          const finalCost = authorizedCostCents;
          try {
            await walletService.captureForGeneration({
              userId,
              amount_cents: finalCost,
              generation_id: generationId,
              idempotency_key: `cap_${generationId}`,
              description: `Cobrança de geração concluída #${generationId.slice(-6)}`,
            });
          } catch (capErr) {
            console.error('[GenerationService] Error capturing funds on success:', capErr);
          }

          // 2. Finalize generation record
          generation.status = 'SUCCEEDED';
          generation.progress_percent = 100;
          generation.result_url = statusRes.result_video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
          generation.thumbnail_url = statusRes.thumbnail_url || '';
          generation.final_cost_cents = finalCost;
          generation.completed_at = new Date().toISOString();
          await generationRepository.saveGeneration(generation);
        } else if (statusRes.status === 'FAILED') {
          clearInterval(interval);

          // Release reserved funds back to available
          try {
            await walletService.releaseForGeneration({
              userId,
              amount_cents: authorizedCostCents,
              generation_id: generationId,
              idempotency_key: `rel_${generationId}`,
              reason: statusRes.error_message || 'Provedor reportou erro de execução',
            });
          } catch (relErr) {
            console.error('[GenerationService] Error releasing funds on failure:', relErr);
          }

          generation.status = 'FAILED';
          generation.error_code = statusRes.error_code || 'PROVIDER_EXECUTION_ERROR';
          generation.error_message = statusRes.error_message || 'Falha durante o processamento do vídeo no provedor.';
          generation.failed_at = new Date().toISOString();
          await generationRepository.saveGeneration(generation);
        }

        if (pollCount >= maxPolls) {
          clearInterval(interval);
          // Timeout: Release funds
          await walletService.releaseForGeneration({
            userId,
            amount_cents: authorizedCostCents,
            generation_id: generationId,
            idempotency_key: `rel_${generationId}`,
            reason: 'Tempo limite de geração excedido (timeout)',
          });
          generation.status = 'FAILED';
          generation.error_code = 'GENERATION_TIMEOUT';
          generation.error_message = 'A geração excedeu o tempo máximo permitido de processamento.';
          generation.failed_at = new Date().toISOString();
          await generationRepository.saveGeneration(generation);
        }
      } catch (err: any) {
        console.warn(`[GenerationService] Polling error for ${generationId}:`, err.message);
      }
    }, 2500);
  },

  /**
   * Cancels a generation that is currently in progress.
   */
  async cancelGeneration(generationId: string, userId: string): Promise<Generation> {
    const generation = await generationRepository.getGeneration(generationId);
    if (!generation) {
      throw new Error('Geração não encontrada.');
    }

    if (generation.user_id !== userId) {
      throw new Error('Sem permissão para cancelar esta geração.');
    }

    if (generation.status === 'SUCCEEDED' || generation.status === 'FAILED' || generation.status === 'CANCELLED') {
      return generation;
    }

    // Cancel at provider adapter if applicable
    if (generation.provider_job_id && generation.provider_id) {
      const adapter = providerRegistry.getAdapter(generation.provider_id);
      if (adapter?.cancelJob) {
        await adapter.cancelJob(generation.provider_job_id).catch(() => {});
      }
    }

    // Release reserved funds
    if (generation.estimated_cost_cents) {
      await walletService.releaseForGeneration({
        userId,
        amount_cents: generation.estimated_cost_cents,
        generation_id: generationId,
        idempotency_key: `rel_${generationId}`,
        reason: 'Cancelado pelo usuário',
      });
    }

    generation.status = 'CANCELLED';
    generation.failed_at = new Date().toISOString();
    await generationRepository.saveGeneration(generation);

    return generation;
  },

  async listUserGenerations(userId: string, limit = 50): Promise<Generation[]> {
    return generationRepository.listUserGenerations(userId, limit);
  },

  async getGeneration(generationId: string, userId: string): Promise<Generation | null> {
    const gen = await generationRepository.getGeneration(generationId);
    if (!gen || gen.user_id !== userId) {
      return null;
    }
    return gen;
  },
};

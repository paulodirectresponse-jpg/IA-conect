import { GenerationMode } from '../../src/types/index.js';
import {
  VideoProviderAdapter,
  ProviderGenerationParams,
  ProviderJobResult,
  ProviderJobStatusResult,
} from './videoProviderAdapter.js';
import { compileProviderReferencePrompt } from './providerPromptReferences.js';

const FAMILIES: Record<string, string> = {
  'wan-3-0': 'alibaba/wan-3.0',
  'wan-3-0-prime': 'alibaba/wan-3.0-prime',
  'seedance-2-5': 'bytedance/seedance-2.5',
  'minimax-h3': 'wavespeed-ai/minimax-h3',
};

function suffix(mode: GenerationMode) {
  if (mode === 'TEXT_TO_VIDEO') return 'text-to-video';
  if (mode === 'IMAGE_TO_VIDEO') return 'image-to-video';
  if (mode === 'REFERENCE_TO_VIDEO') return 'reference-to-video';
  return null;
}

function base(value: string | undefined) {
  return (value || 'https://api.wavespeed.ai').replace(/\/+$/, '').replace(/\/api\/v3$/, '');
}

export class WaveSpeedProviderAdapter implements VideoProviderAdapter {
  readonly providerId = 'provider-wavespeed';
  readonly name = 'WaveSpeed AI';

  private get apiKey() {
    return process.env.WAVESPEED_API_KEY?.trim();
  }
  private get baseUrl() {
    return base(process.env.WAVESPEED_BASE_URL);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  supports(modelId: string, mode: GenerationMode) {
    if (modelId === 'seedance-2-5' && mode === 'REFERENCE_TO_VIDEO') return false;
    return Boolean(FAMILIES[modelId] && suffix(mode));
  }

  private modelName(modelId: string, mode: GenerationMode) {
    if (!this.supports(modelId, mode)) {
      throw Object.assign(new Error('Modelo/modo não suportado pela WaveSpeed.'), {
        code: 'PROVIDER_INCOMPATIBLE',
      });
    }
    return `${FAMILIES[modelId]}/${suffix(mode)}`;
  }

  private payload(params: ProviderGenerationParams) {
    const images = params.references.filter((r) => r.type === 'IMAGE');
    const videos = params.references.filter((r) => r.type === 'VIDEO');
    const audios = params.references.filter((r) => r.type === 'AUDIO');
    const out: any = {
      prompt: compileProviderReferencePrompt(params, 'wavespeed'),
      resolution: params.resolution,
      aspect_ratio: params.aspect_ratio,
      duration: params.duration_seconds,
    };

    if (params.seed !== null && params.seed !== undefined) out.seed = params.seed;

    if (params.mode === 'IMAGE_TO_VIDEO') {
      const initial = images.find((r) => r.slot_type === 'INITIAL') || images[0];
      if (!initial) {
        throw Object.assign(new Error('Imagem inicial obrigatória.'), { code: 'REFERENCE_REQUIRED' });
      }
      out.image = initial.provider_accessible_url;
      const end = images.find((r) => r.slot_type === 'END');
      if (end) out.last_image = end.provider_accessible_url;
    } else if (params.mode === 'REFERENCE_TO_VIDEO') {
      out.reference_images = images.map((r) => r.provider_accessible_url);
      out.reference_videos = videos.map((r) => r.provider_accessible_url);
      out.reference_audios = audios.map((r) => r.provider_accessible_url);
    }

    if (params.model_id.startsWith('wan-3-0')) {
      out.enable_prompt_expansion = false;
      out.enable_audio = true;
    }
    if (params.model_id === 'seedance-2-5') out.generate_audio = true;
    return out;
  }

  async submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult> {
    if (!this.apiKey) {
      throw Object.assign(new Error('WaveSpeed não configurada.'), { code: 'PROVIDER_NOT_CONFIGURED' });
    }
    const model = this.modelName(params.model_id, params.mode);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${this.baseUrl}/api/v3/${model}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.payload(params)),
      });
      const text = await res.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch {}
      if (!res.ok) {
        throw Object.assign(new Error(body?.message || body?.error || `WaveSpeed HTTP ${res.status}`), {
          code: `WAVESPEED_HTTP_${res.status}`,
        });
      }
      const data = body?.data ?? body;
      if (!data?.id) {
        throw Object.assign(new Error('WaveSpeed não retornou prediction id.'), {
          code: 'PROVIDER_INVALID_RESPONSE',
        });
      }
      return { provider_job_id: data.id, provider_id: this.providerId, status: 'QUEUED' };
    } finally {
      clearTimeout(timer);
    }
  }

  async checkStatus(id: string): Promise<ProviderJobStatusResult> {
    if (!this.apiKey) {
      throw Object.assign(new Error('WaveSpeed não configurada.'), { code: 'PROVIDER_NOT_CONFIGURED' });
    }
    const res = await fetch(`${this.baseUrl}/api/v3/predictions/${encodeURIComponent(id)}/result`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const text = await res.text();
    let body: any = {};
    try { body = JSON.parse(text); } catch {}
    if (!res.ok) {
      throw Object.assign(new Error(body?.message || `WaveSpeed status HTTP ${res.status}`), {
        code: `WAVESPEED_HTTP_${res.status}`,
      });
    }
    const data = body?.data ?? body;
    const raw = String(data?.status || '').toLowerCase();
    if (raw === 'completed') {
      return {
        provider_job_id: id,
        status: 'SUCCEEDED',
        progress_percent: 100,
        result_video_url: Array.isArray(data.outputs) ? data.outputs[0] : data.output?.video_url || data.video_url,
      };
    }
    if (['failed', 'cancelled', 'canceled', 'timeout', 'deleted'].includes(raw)) {
      return {
        provider_job_id: id,
        status: 'FAILED',
        error_message: String(data?.error || data?.message || 'Falha na WaveSpeed.'),
      };
    }
    return {
      provider_job_id: id,
      status: raw === 'pending' || raw === 'queued' ? 'QUEUED' : 'PROCESSING',
      progress_percent: typeof data?.progress === 'number' ? data.progress : undefined,
    };
  }

  async cancelJob() {
    return false;
  }
}

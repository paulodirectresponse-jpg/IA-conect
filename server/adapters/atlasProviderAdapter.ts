import { GenerationMode } from '../../src/types/index.js';
import {
  VideoProviderAdapter,
  ProviderGenerationParams,
  ProviderJobResult,
  ProviderJobStatusResult,
} from './videoProviderAdapter.js';
import { compileProviderReferencePrompt } from './providerPromptReferences.js';

const VIDEO_FAMILIES: Record<string, string> = {
  'wan-3-0': 'alibaba/wan-3.0',
  'wan-3-0-prime': 'alibaba/wan-3.0-prime',
  'seedance-2-5': 'bytedance/seedance-2.5',
  'minimax-h3': 'minimax/h3',
};

const IMAGE_MODELS: Record<string, Partial<Record<GenerationMode, string>>> = {
  'qwen-image-2': {
    TEXT_TO_IMAGE: 'qwen/qwen-image-2.0/text-to-image',
  },
};

function videoSuffixFor(mode: GenerationMode) {
  if (mode === 'TEXT_TO_VIDEO') return 'text-to-video';
  if (mode === 'IMAGE_TO_VIDEO') return 'image-to-video';
  if (mode === 'REFERENCE_TO_VIDEO') return 'reference-to-video';
  return null;
}

function trimBase(value: string | undefined) {
  return (value || 'https://api.atlascloud.ai').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

function groups(params: ProviderGenerationParams) {
  return {
    images: params.references.filter((r) => r.type === 'IMAGE'),
    videos: params.references.filter((r) => r.type === 'VIDEO'),
    audios: params.references.filter((r) => r.type === 'AUDIO'),
  };
}

function atlasResolution(modelId: string, res: string) {
  if (modelId === 'minimax-h3' && res.toLowerCase() === '768p') return '768P';
  if (modelId === 'minimax-h3' && res.toLowerCase() === '2k') return '2K';
  return res;
}

function imageSize(aspectRatio: string) {
  const presets: Record<string, string> = {
    '1:1': '1024*1024',
    '16:9': '1536*864',
    '9:16': '864*1536',
    '4:3': '1365*1024',
    '3:4': '1024*1365',
    '3:2': '1536*1024',
    '2:3': '1024*1536',
    '4:5': '1024*1280',
    '5:4': '1280*1024',
  };
  return presets[aspectRatio] || presets['1:1'];
}

export class AtlasProviderAdapter implements VideoProviderAdapter {
  readonly providerId = 'provider-atlas';
  readonly name = 'Atlas Cloud';

  private get apiKey() {
    return process.env.ATLAS_API_KEY?.trim();
  }
  private get baseUrl() {
    return trimBase(process.env.ATLAS_BASE_URL);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  supports(modelId: string, mode: GenerationMode) {
    if (mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE') {
      return Boolean(IMAGE_MODELS[modelId]?.[mode]);
    }
    return Boolean(VIDEO_FAMILIES[modelId] && videoSuffixFor(mode));
  }

  private modelName(modelId: string, mode: GenerationMode) {
    if (mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE') {
      const model = IMAGE_MODELS[modelId]?.[mode];
      if (!model) {
        throw Object.assign(new Error('Modelo/modo de imagem não suportado pela Atlas.'), {
          code: 'PROVIDER_INCOMPATIBLE',
        });
      }
      return model;
    }

    const family = VIDEO_FAMILIES[modelId];
    const suffix = videoSuffixFor(mode);
    if (!family || !suffix) {
      throw Object.assign(new Error('Modelo/modo não suportado pela Atlas.'), {
        code: 'PROVIDER_INCOMPATIBLE',
      });
    }
    return `${family}/${suffix}`;
  }

  private buildPayload(params: ProviderGenerationParams) {
    const model = this.modelName(params.model_id, params.mode);
    const { images, videos, audios } = groups(params);
    const compiledPrompt = compileProviderReferencePrompt(params, 'atlas');

    if (params.mode === 'TEXT_TO_IMAGE' || params.mode === 'IMAGE_TO_IMAGE') {
      const imagePayload: any = {
        model,
        prompt: compiledPrompt,
        size: imageSize(params.aspect_ratio),
        enable_sync_mode: false,
        enable_base64_output: false,
      };
      if (params.seed !== null && params.seed !== undefined) imagePayload.seed = params.seed;
      return imagePayload;
    }

    const base: any = {
      model,
      prompt: compiledPrompt,
      duration: params.duration_seconds,
      resolution: atlasResolution(params.model_id, params.resolution),
    };

    if (params.seed !== null && params.seed !== undefined) base.seed = params.seed;

    if (params.model_id === 'minimax-h3') {
      base.ratio = params.aspect_ratio;
      if (params.mode === 'IMAGE_TO_VIDEO') {
        const initial = images.find((r) => r.slot_type === 'INITIAL') || images[0];
        if (!initial) {
          throw Object.assign(new Error('Imagem inicial obrigatória.'), { code: 'REFERENCE_REQUIRED' });
        }
        base.image = initial.provider_accessible_url;
      } else if (params.mode === 'REFERENCE_TO_VIDEO') {
        base.refers = params.references.map((r) => ({
          url: r.provider_accessible_url,
          type: r.type.toLowerCase(),
        }));
      }
      return base;
    }

    if (params.model_id === 'seedance-2-5') {
      base.ratio = params.aspect_ratio;
      base.generate_audio = true;
      if (params.mode === 'IMAGE_TO_VIDEO') {
        const initial = images.find((r) => r.slot_type === 'INITIAL') || images[0];
        if (!initial) {
          throw Object.assign(new Error('Imagem inicial obrigatória.'), { code: 'REFERENCE_REQUIRED' });
        }
        base.image = initial.provider_accessible_url;
        const end = images.find((r) => r.slot_type === 'END');
        if (end) base.last_image = end.provider_accessible_url;
      } else if (params.mode === 'REFERENCE_TO_VIDEO') {
        base.reference_images = images.map((r) => r.provider_accessible_url);
        base.reference_videos = videos.map((r) => r.provider_accessible_url);
        base.reference_audios = audios.map((r) => r.provider_accessible_url);
        base.omni_reference_task_type = 'reference';
      }
      return base;
    }

    base.ratio = params.aspect_ratio;
    base.audio = true;
    if (params.mode === 'IMAGE_TO_VIDEO') {
      const initial = images.find((r) => r.slot_type === 'INITIAL') || images[0];
      if (!initial) {
        throw Object.assign(new Error('Imagem inicial obrigatória.'), { code: 'REFERENCE_REQUIRED' });
      }
      base.image = initial.provider_accessible_url;
      const end = images.find((r) => r.slot_type === 'END');
      if (end) base.last_image = end.provider_accessible_url;
    } else if (params.mode === 'REFERENCE_TO_VIDEO') {
      base.refers = params.references.map((r) => ({
        url: r.provider_accessible_url,
        type: r.type.toLowerCase(),
      }));
    }
    return base;
  }

  async submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult> {
    if (!this.apiKey) {
      throw Object.assign(new Error('Atlas Cloud não configurada.'), { code: 'PROVIDER_NOT_CONFIGURED' });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const endpoint = params.mode === 'TEXT_TO_IMAGE' || params.mode === 'IMAGE_TO_IMAGE'
        ? 'generateImage'
        : 'generateVideo';
      const res = await fetch(`${this.baseUrl}/api/v1/model/${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildPayload(params)),
      });
      const text = await res.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch {}
      if (!res.ok) {
        throw Object.assign(new Error(body?.message || body?.error || `Atlas HTTP ${res.status}`), {
          code: `ATLAS_HTTP_${res.status}`,
        });
      }
      const data = body?.data ?? body;
      if (!data?.id) {
        throw Object.assign(new Error('Atlas não retornou prediction id.'), { code: 'PROVIDER_INVALID_RESPONSE' });
      }
      return { provider_job_id: data.id, provider_id: this.providerId, status: 'QUEUED' };
    } finally {
      clearTimeout(timer);
    }
  }

  async checkStatus(id: string): Promise<ProviderJobStatusResult> {
    if (!this.apiKey) {
      throw Object.assign(new Error('Atlas Cloud não configurada.'), { code: 'PROVIDER_NOT_CONFIGURED' });
    }
    const res = await fetch(`${this.baseUrl}/api/v1/model/prediction/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const text = await res.text();
    let body: any = {};
    try { body = JSON.parse(text); } catch {}
    if (!res.ok) {
      throw Object.assign(new Error(body?.message || `Atlas status HTTP ${res.status}`), {
        code: `ATLAS_HTTP_${res.status}`,
      });
    }
    const data = body?.data ?? body;
    const raw = String(data?.status || '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(raw)) {
      const outputs = Array.isArray(data.outputs)
        ? data.outputs.filter(Boolean)
        : [data.output?.video_url || data.video_url || data.output?.image_url || data.image_url].filter(Boolean);
      return {
        provider_job_id: id,
        status: 'SUCCEEDED',
        progress_percent: 100,
        result_video_url: outputs[0],
        result_urls: outputs,
      };
    }
    if (['failed', 'error', 'timeout', 'cancelled', 'canceled'].includes(raw)) {
      return {
        provider_job_id: id,
        status: 'FAILED',
        error_message: String(data?.error || data?.message || 'Falha na Atlas.'),
      };
    }
    return {
      provider_job_id: id,
      status: raw === 'queued' || raw === 'pending' ? 'QUEUED' : 'PROCESSING',
      progress_percent: typeof data?.progress === 'number' ? data.progress : undefined,
    };
  }

  async cancelJob() {
    return false;
  }
}

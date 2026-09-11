import {
  ModelRegistryItem,
  ModelCapabilities,
  GenerationMode,
  WorkspaceReference,
} from '../types/index.js';

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  supported_modes: ['TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'REFERENCE_TO_VIDEO'],
  supported_resolutions: ['720p', '1080p'],
  supported_durations: [5, 10],
  supported_aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_image_reference: true,
  supports_multiple_images: true,
  supports_video_reference: false,
  supports_audio_reference: false,
  supports_negative_prompt: true,
  supports_seed: true,
  max_reference_images: 3,
  max_reference_videos: 0,
  max_reference_audio: 0,
  max_prompt_length: 2000,
  supports_camera_control: false,
  supports_motion_strength: false,
  supports_loop: false,
  supports_start_end_image: false,
};

type KnownCapabilityDefaults = Partial<ModelCapabilities>;

const KNOWN_MODEL_DEFAULTS: Record<string, KnownCapabilityDefaults> = {
  'wan-3-0': {
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_start_end_image: true,
    max_reference_images: 10,
    max_reference_videos: 5,
    max_reference_audio: 5,
    max_prompt_length: 20000,
  },
  'wan-3-0-prime': {
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_start_end_image: true,
    max_reference_images: 10,
    max_reference_videos: 5,
    max_reference_audio: 5,
    max_prompt_length: 20000,
  },
  'seedance-2-5': {
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_start_end_image: true,
    max_reference_images: 30,
    max_reference_videos: 10,
    max_reference_audio: 10,
  },
  'minimax-h3': {
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_start_end_image: true,
    max_reference_images: 9,
    max_reference_videos: 3,
    max_reference_audio: 3,
  },
  'seedance-2-0': {
    supports_image_reference: true,
    supports_multiple_images: false,
    supports_video_reference: false,
    supports_audio_reference: false,
    supports_start_end_image: true,
    max_reference_images: 2,
    max_reference_videos: 0,
    max_reference_audio: 0,
  },
  'kling-3-0': {
    supports_image_reference: true,
    supports_multiple_images: false,
    supports_video_reference: false,
    supports_audio_reference: false,
    supports_start_end_image: true,
    max_reference_images: 2,
    max_reference_videos: 0,
    max_reference_audio: 0,
  },
  'google-omni-flash': {
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: false,
    supports_start_end_image: true,
    max_reference_images: 10,
    max_reference_videos: 3,
    max_reference_audio: 0,
  },
};

function knownValue<K extends keyof ModelCapabilities>(
  model: Partial<ModelRegistryItem>,
  key: K,
  fallback: ModelCapabilities[K]
): ModelCapabilities[K] {
  const explicit = model[key as keyof ModelRegistryItem] as ModelCapabilities[K] | undefined;
  if (explicit !== undefined && explicit !== null) return explicit;
  const known = KNOWN_MODEL_DEFAULTS[model.model_id || '']?.[key] as ModelCapabilities[K] | undefined;
  return known ?? fallback;
}

export function getModelCapabilities(model?: Partial<ModelRegistryItem> | null): ModelCapabilities {
  if (!model) return DEFAULT_MODEL_CAPABILITIES;
  return {
    supported_modes:
      model.supported_modes && model.supported_modes.length > 0
        ? model.supported_modes
        : DEFAULT_MODEL_CAPABILITIES.supported_modes,
    supported_resolutions:
      model.supported_resolutions && model.supported_resolutions.length > 0
        ? model.supported_resolutions
        : DEFAULT_MODEL_CAPABILITIES.supported_resolutions,
    supported_durations:
      model.supported_durations && model.supported_durations.length > 0
        ? model.supported_durations
        : DEFAULT_MODEL_CAPABILITIES.supported_durations,
    supported_aspect_ratios:
      model.supported_aspect_ratios && model.supported_aspect_ratios.length > 0
        ? model.supported_aspect_ratios
        : DEFAULT_MODEL_CAPABILITIES.supported_aspect_ratios,
    supports_image_reference: knownValue(model, 'supports_image_reference', DEFAULT_MODEL_CAPABILITIES.supports_image_reference),
    supports_multiple_images: knownValue(model, 'supports_multiple_images', DEFAULT_MODEL_CAPABILITIES.supports_multiple_images),
    supports_video_reference: knownValue(model, 'supports_video_reference', DEFAULT_MODEL_CAPABILITIES.supports_video_reference),
    supports_audio_reference: knownValue(model, 'supports_audio_reference', DEFAULT_MODEL_CAPABILITIES.supports_audio_reference),
    supports_negative_prompt: model.supports_negative_prompt ?? DEFAULT_MODEL_CAPABILITIES.supports_negative_prompt,
    supports_seed: model.supports_seed ?? DEFAULT_MODEL_CAPABILITIES.supports_seed,
    max_reference_images: knownValue(model, 'max_reference_images', DEFAULT_MODEL_CAPABILITIES.max_reference_images),
    max_reference_videos: knownValue(model, 'max_reference_videos', DEFAULT_MODEL_CAPABILITIES.max_reference_videos),
    max_reference_audio: knownValue(model, 'max_reference_audio', DEFAULT_MODEL_CAPABILITIES.max_reference_audio),
    max_prompt_length: knownValue(model, 'max_prompt_length', DEFAULT_MODEL_CAPABILITIES.max_prompt_length),
    supports_camera_control: model.supports_camera_control ?? false,
    supports_motion_strength: model.supports_motion_strength ?? false,
    supports_loop: model.supports_loop ?? false,
    supports_start_end_image: knownValue(model, 'supports_start_end_image', false),
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isFrameReference(ref: WorkspaceReference) {
  return ['START_FRAME', 'INITIAL_FRAME', 'INITIAL', 'END_FRAME', 'END'].includes(
    String(ref.role || '').toUpperCase()
  );
}

export function mergeModelCapabilities(models: ModelRegistryItem[]): ModelCapabilities {
  const active = models.filter((m) => m.status !== 'INACTIVE');
  if (!active.length) return DEFAULT_MODEL_CAPABILITIES;
  const caps = active.map(getModelCapabilities);
  return {
    supported_modes: unique(caps.flatMap((c) => c.supported_modes)),
    supported_resolutions: unique(caps.flatMap((c) => c.supported_resolutions)),
    supported_durations: unique(caps.flatMap((c) => c.supported_durations)).sort((a, b) => a - b),
    supported_aspect_ratios: unique(caps.flatMap((c) => c.supported_aspect_ratios)),
    supports_image_reference: caps.some((c) => c.supports_image_reference),
    supports_multiple_images: caps.some((c) => c.supports_multiple_images),
    supports_video_reference: caps.some((c) => c.supports_video_reference),
    supports_audio_reference: caps.some((c) => c.supports_audio_reference),
    supports_negative_prompt: caps.some((c) => c.supports_negative_prompt),
    supports_seed: caps.some((c) => c.supports_seed),
    max_reference_images: Math.max(...caps.map((c) => c.max_reference_images), 0),
    max_reference_videos: Math.max(...caps.map((c) => c.max_reference_videos), 0),
    max_reference_audio: Math.max(...caps.map((c) => c.max_reference_audio), 0),
    max_prompt_length: Math.max(...caps.map((c) => c.max_prompt_length), 2000),
    supports_camera_control: caps.some((c) => c.supports_camera_control),
    supports_motion_strength: caps.some((c) => c.supports_motion_strength),
    supports_loop: caps.some((c) => c.supports_loop),
    supports_start_end_image: caps.some((c) => c.supports_start_end_image),
  };
}

export interface CompatibilityCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfiguration(
  model: ModelRegistryItem | null,
  config: {
    mode: GenerationMode;
    duration_seconds: number;
    resolution: string;
    aspect_ratio: string;
    references: WorkspaceReference[];
    negative_prompt?: string;
    promptText?: string;
    has_start_image?: boolean;
    has_end_image?: boolean;
  }
): CompatibilityCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!model) {
    return {
      valid: false,
      errors: ['Nenhuma IA compatível foi encontrada para esta combinação.'],
      warnings: [],
    };
  }

  const caps = getModelCapabilities(model);
  if (!caps.supported_modes.includes(config.mode)) errors.push(`O modelo ${model.name} não suporta o modo ${config.mode}.`);
  if (!caps.supported_durations.includes(config.duration_seconds)) errors.push(`Duração de ${config.duration_seconds}s não suportada por ${model.name}.`);
  if (!caps.supported_resolutions.includes(config.resolution)) errors.push(`Resolução ${config.resolution} não suportada por ${model.name}.`);
  if (!caps.supported_aspect_ratios.includes(config.aspect_ratio)) errors.push(`Proporção ${config.aspect_ratio} não suportada por ${model.name}.`);
  if (config.has_end_image && !caps.supports_start_end_image) errors.push(`${model.name} não suporta quadro final.`);

  const generalRefs = config.references.filter((r) => !isFrameReference(r));
  if ((config.has_start_image || config.has_end_image) && generalRefs.length > 0) {
    errors.push('Imagem inicial/final e referências multimodais usam modos de geração diferentes. Remova um dos grupos antes de gerar.');
  }

  const imageRefs = config.references.filter((r) => r.asset?.type === 'IMAGE' || !r.asset?.type);
  const videoRefs = config.references.filter((r) => r.asset?.type === 'VIDEO');
  const audioRefs = config.references.filter((r) => r.asset?.type === 'AUDIO');

  if (imageRefs.length > 0 && !caps.supports_image_reference) errors.push(`O modelo ${model.name} não suporta imagens de referência.`);
  else if (imageRefs.length > caps.max_reference_images) errors.push(`O modelo ${model.name} aceita no máximo ${caps.max_reference_images} imagem(ns) de referência.`);
  if (videoRefs.length > 0 && !caps.supports_video_reference) errors.push(`O modelo ${model.name} não suporta vídeos de referência.`);
  else if (videoRefs.length > caps.max_reference_videos) errors.push(`O modelo ${model.name} aceita no máximo ${caps.max_reference_videos} vídeo(s) de referência.`);
  if (audioRefs.length > 0 && !caps.supports_audio_reference) errors.push(`O modelo ${model.name} não suporta áudios de referência.`);
  else if (audioRefs.length > caps.max_reference_audio) errors.push(`O modelo ${model.name} aceita no máximo ${caps.max_reference_audio} áudio(s) de referência.`);
  if (config.negative_prompt?.trim() && !caps.supports_negative_prompt) warnings.push(`O modelo ${model.name} não processa negative prompt; este campo será ignorado.`);
  if (config.promptText && config.promptText.length > caps.max_prompt_length) errors.push(`O prompt excede o limite de ${caps.max_prompt_length} caracteres de ${model.name}.`);

  return { valid: errors.length === 0, errors, warnings };
}


export interface ModelDrivenConfigurationInput {
  duration_seconds: number;
  resolution: string;
  aspect_ratio: string;
  negative_prompt?: string;
  references?: WorkspaceReference[];
  has_start_image?: boolean;
  has_end_image?: boolean;
}

export interface ModelDrivenConfigurationResult {
  duration_seconds: number;
  resolution: string;
  aspect_ratio: string;
  negative_prompt: string;
  references: WorkspaceReference[];
  remove_end_image: boolean;
  clear_seed: boolean;
  reset_motion_strength: boolean;
  changes: string[];
}

function closestNumber(values:number[], current:number) {
  if (!values.length) return current;
  return [...values].sort((a,b)=>Math.abs(a-current)-Math.abs(b-current)||a-b)[0];
}

function resolutionRank(value:string) {
  const normalized=String(value||'').trim().toLowerCase();
  if (normalized==='standard'||normalized==='std') return 720;
  const k=normalized.match(/([0-9.]+)k/);
  if (k) return Number(k[1])*1000;
  const p=normalized.match(/([0-9.]+)p/);
  if (p) return Number(p[1]);
  const plain=Number(normalized.replace(/[^0-9.]/g,''));
  return Number.isFinite(plain)&&plain>0?plain:null;
}

function closestResolution(values:string[], current:string) {
  if (!values.length) return current;
  if (values.includes(current)) return current;
  const currentRank=resolutionRank(current);
  if (currentRank==null) return values[0];
  return [...values].sort((a,b)=>{
    const ar=resolutionRank(a),br=resolutionRank(b);
    const ad=ar==null?Number.MAX_SAFE_INTEGER:Math.abs(ar-currentRank);
    const bd=br==null?Number.MAX_SAFE_INTEGER:Math.abs(br-currentRank);
    return ad-bd;
  })[0];
}

function preferredAspectRatio(model:ModelRegistryItem,caps:ModelCapabilities,current:string) {
  if (caps.supported_aspect_ratios.includes(current)) return current;
  if (model.recommended_aspect_ratio && caps.supported_aspect_ratios.includes(model.recommended_aspect_ratio)) {
    return model.recommended_aspect_ratio;
  }
  for (const common of ['16:9','9:16','1:1']) {
    if (caps.supported_aspect_ratios.includes(common)) return common;
  }
  return caps.supported_aspect_ratios[0] || current;
}

export function adaptConfigurationToModel(
  model: ModelRegistryItem,
  input: ModelDrivenConfigurationInput
): ModelDrivenConfigurationResult {
  const caps=getModelCapabilities(model);
  const changes:string[]=[];

  const duration_seconds=caps.supported_durations.includes(input.duration_seconds)
    ? input.duration_seconds
    : closestNumber(caps.supported_durations,input.duration_seconds);
  if (duration_seconds!==input.duration_seconds) changes.push(`duração ${input.duration_seconds}s → ${duration_seconds}s`);

  const resolution=closestResolution(caps.supported_resolutions,input.resolution);
  if (resolution!==input.resolution) changes.push(`resolução ${input.resolution} → ${resolution}`);

  const aspect_ratio=preferredAspectRatio(model,caps,input.aspect_ratio);
  if (aspect_ratio!==input.aspect_ratio) changes.push(`proporção ${input.aspect_ratio} → ${aspect_ratio}`);

  const remove_end_image=Boolean(input.has_end_image&&!caps.supports_start_end_image);
  if (remove_end_image) changes.push('imagem final removida');

  let references=[...(input.references||[])];
  const hasFrameWorkflow=Boolean(input.has_start_image||(input.has_end_image&&!remove_end_image));
  if (references.length&&hasFrameWorkflow) {
    references=[];
    changes.push('referências gerais removidas para manter o fluxo por frames');
  } else if (references.length&&!caps.supported_modes.includes('REFERENCE_TO_VIDEO')) {
    references=[];
    changes.push('referências gerais removidas porque este modelo não usa modo de referência');
  } else if (references.length) {
    const kept:WorkspaceReference[]=[];
    let imageCount=0,videoCount=0,audioCount=0;
    for (const ref of references) {
      const type=ref.asset?.type||'IMAGE';
      if (type==='VIDEO') {
        if (!caps.supports_video_reference||videoCount>=caps.max_reference_videos) continue;
        videoCount++;
      } else if (type==='AUDIO') {
        if (!caps.supports_audio_reference||audioCount>=caps.max_reference_audio) continue;
        audioCount++;
      } else {
        if (!caps.supports_image_reference||imageCount>=caps.max_reference_images) continue;
        imageCount++;
      }
      kept.push(ref);
    }
    if (kept.length!==references.length) changes.push('referências incompatíveis removidas');
    references=kept;
  }

  const negative_prompt=caps.supports_negative_prompt?(input.negative_prompt||''):'';
  if ((input.negative_prompt||'').trim()&&!caps.supports_negative_prompt) changes.push('negative prompt removido');

  const clear_seed=!caps.supports_seed;
  const reset_motion_strength=!caps.supports_motion_strength;

  return {
    duration_seconds,
    resolution,
    aspect_ratio,
    negative_prompt,
    references,
    remove_end_image,
    clear_seed,
    reset_motion_strength,
    changes,
  };
}

export interface AutoCompatibilityRequirements {
  mode?: GenerationMode;
  imageCount?: number;
  videoCount?: number;
  audioCount?: number;
  hasStartImage?: boolean;
  hasEndImage?: boolean;
  desiredResolution?: string;
  desiredDuration?: number;
  desiredAspectRatio?: string;
  promptLength?: number;
  usesNegativePrompt?: boolean;
}

export function findCompatibleModels(allModels: ModelRegistryItem[], req: AutoCompatibilityRequirements): ModelRegistryItem[] {
  return allModels.filter((m) => {
    if (m.status === 'INACTIVE') return false;
    const c = getModelCapabilities(m);
    if (req.mode && !c.supported_modes.includes(req.mode)) return false;
    if (req.hasStartImage && !c.supports_image_reference) return false;
    if (req.hasEndImage && !c.supports_start_end_image) return false;
    if ((req.imageCount || 0) > 0 && !c.supports_image_reference) return false;
    if ((req.imageCount || 0) > c.max_reference_images) return false;
    if ((req.videoCount || 0) > 0 && !c.supports_video_reference) return false;
    if ((req.videoCount || 0) > c.max_reference_videos) return false;
    if ((req.audioCount || 0) > 0 && !c.supports_audio_reference) return false;
    if ((req.audioCount || 0) > c.max_reference_audio) return false;
    if (req.usesNegativePrompt && !c.supports_negative_prompt) return false;
    if (req.desiredResolution && !c.supported_resolutions.includes(req.desiredResolution)) return false;
    if (req.desiredDuration && !c.supported_durations.includes(req.desiredDuration)) return false;
    if (req.desiredAspectRatio && !c.supported_aspect_ratios.includes(req.desiredAspectRatio)) return false;
    if (req.promptLength && req.promptLength > c.max_prompt_length) return false;
    return true;
  });
}

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
};

export function getModelCapabilities(model?: Partial<ModelRegistryItem> | null): ModelCapabilities {
  if (!model) return DEFAULT_MODEL_CAPABILITIES;

  return {
    supported_modes: model.supported_modes && model.supported_modes.length > 0
      ? model.supported_modes
      : DEFAULT_MODEL_CAPABILITIES.supported_modes,
    supported_resolutions: model.supported_resolutions && model.supported_resolutions.length > 0
      ? model.supported_resolutions
      : DEFAULT_MODEL_CAPABILITIES.supported_resolutions,
    supported_durations: model.supported_durations && model.supported_durations.length > 0
      ? model.supported_durations
      : DEFAULT_MODEL_CAPABILITIES.supported_durations,
    supported_aspect_ratios: model.supported_aspect_ratios && model.supported_aspect_ratios.length > 0
      ? model.supported_aspect_ratios
      : DEFAULT_MODEL_CAPABILITIES.supported_aspect_ratios,
    supports_image_reference: model.supports_image_reference ?? DEFAULT_MODEL_CAPABILITIES.supports_image_reference,
    supports_multiple_images: model.supports_multiple_images ?? DEFAULT_MODEL_CAPABILITIES.supports_multiple_images,
    supports_video_reference: model.supports_video_reference ?? DEFAULT_MODEL_CAPABILITIES.supports_video_reference,
    supports_audio_reference: model.supports_audio_reference ?? DEFAULT_MODEL_CAPABILITIES.supports_audio_reference,
    supports_negative_prompt: model.supports_negative_prompt ?? DEFAULT_MODEL_CAPABILITIES.supports_negative_prompt,
    supports_seed: model.supports_seed ?? DEFAULT_MODEL_CAPABILITIES.supports_seed,
    max_reference_images: model.max_reference_images ?? DEFAULT_MODEL_CAPABILITIES.max_reference_images,
    max_reference_videos: model.max_reference_videos ?? DEFAULT_MODEL_CAPABILITIES.max_reference_videos,
    max_reference_audio: model.max_reference_audio ?? DEFAULT_MODEL_CAPABILITIES.max_reference_audio,
    max_prompt_length: model.max_prompt_length ?? DEFAULT_MODEL_CAPABILITIES.max_prompt_length,
    supports_camera_control: model.supports_camera_control ?? false,
    supports_motion_strength: model.supports_motion_strength ?? false,
    supports_loop: model.supports_loop ?? false,
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
  }
): CompatibilityCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!model) {
    return { valid: false, errors: ['Selecione um modelo para continuar.'], warnings: [] };
  }

  const caps = getModelCapabilities(model);

  // 1. Mode Validation
  if (!caps.supported_modes.includes(config.mode)) {
    errors.push(`O modelo ${model.name} não suporta o modo ${config.mode}. Modos suportados: ${caps.supported_modes.join(', ')}.`);
  }

  // 2. Duration Validation
  if (!caps.supported_durations.includes(config.duration_seconds)) {
    errors.push(`Duração de ${config.duration_seconds}s não suportada por ${model.name}. Opções: ${caps.supported_durations.join(', ')}s.`);
  }

  // 3. Resolution Validation
  if (!caps.supported_resolutions.includes(config.resolution)) {
    errors.push(`Resolução ${config.resolution} não suportada por ${model.name}. Opções: ${caps.supported_resolutions.join(', ')}.`);
  }

  // 4. Aspect Ratio Validation
  if (!caps.supported_aspect_ratios.includes(config.aspect_ratio)) {
    errors.push(`Proporção ${config.aspect_ratio} não suportada por ${model.name}. Opções: ${caps.supported_aspect_ratios.join(', ')}.`);
  }

  // 5. References Validation
  const imageRefs = config.references.filter((r) => r.asset?.type === 'IMAGE' || !r.asset?.type);
  const videoRefs = config.references.filter((r) => r.asset?.type === 'VIDEO');
  const audioRefs = config.references.filter((r) => r.asset?.type === 'AUDIO');

  if (imageRefs.length > 0 && !caps.supports_image_reference) {
    errors.push(`O modelo ${model.name} não suporta imagens de referência.`);
  } else if (imageRefs.length > caps.max_reference_images) {
    errors.push(`O modelo ${model.name} aceita no máximo ${caps.max_reference_images} imagem(ns) de referência (atual: ${imageRefs.length}).`);
  }

  if (videoRefs.length > 0 && !caps.supports_video_reference) {
    errors.push(`O modelo ${model.name} não suporta vídeos de referência.`);
  } else if (videoRefs.length > caps.max_reference_videos) {
    errors.push(`O modelo ${model.name} aceita no máximo ${caps.max_reference_videos} vídeo(s) de referência.`);
  }

  if (videoRefs.length > 0 && config.mode !== 'REFERENCE_TO_VIDEO' && config.mode !== 'VIDEO_TO_VIDEO') {
    warnings.push(`Para aproveitar ao máximo vídeos de referência, selecione o modo Reference-to-Video ou Video-to-Video.`);
  }

  if (audioRefs.length > 0 && !caps.supports_audio_reference) {
    errors.push(`O modelo ${model.name} não suporta áudios de referência.`);
  }

  // 6. Negative Prompt Validation
  if (config.negative_prompt?.trim() && !caps.supports_negative_prompt) {
    warnings.push(`O modelo ${model.name} não processa negative prompt. O texto será ignorado na compilação.`);
  }

  // 7. Prompt Length Validation
  if (config.promptText && config.promptText.length > caps.max_prompt_length) {
    errors.push(`O prompt excede o limite máximo do modelo de ${caps.max_prompt_length} caracteres (atual: ${config.promptText.length}).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function findCompatibleModels(
  allModels: ModelRegistryItem[],
  currentConfig: {
    requiresVideoRef?: boolean;
    requiresAudioRef?: boolean;
    refCount?: number;
    desiredResolution?: string;
    desiredDuration?: number;
  }
): ModelRegistryItem[] {
  return allModels.filter((m) => {
    if (m.status === 'INACTIVE') return false;
    const caps = getModelCapabilities(m);

    if (currentConfig.requiresVideoRef && !caps.supports_video_reference) return false;
    if (currentConfig.requiresAudioRef && !caps.supports_audio_reference) return false;
    if (currentConfig.refCount && caps.max_reference_images < currentConfig.refCount) return false;
    if (currentConfig.desiredResolution && !caps.supported_resolutions.includes(currentConfig.desiredResolution)) return false;
    if (currentConfig.desiredDuration && !caps.supported_durations.includes(currentConfig.desiredDuration)) return false;

    return true;
  });
}

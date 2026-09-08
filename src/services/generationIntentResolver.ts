import { GenerationMode, ModelCapabilities, WorkspaceReference, Asset } from '../types/index.js';

export interface IntentResolverInput {
  prompt?: string;
  initial_image?: WorkspaceReference | Asset | null;
  end_image?: WorkspaceReference | Asset | null;
  reference_images?: (WorkspaceReference | Asset)[];
  reference_videos?: (WorkspaceReference | Asset)[];
  reference_audio?: (WorkspaceReference | Asset)[];
  source_video?: (WorkspaceReference | Asset) | null;
  references?: WorkspaceReference[];
  model_capabilities?: ModelCapabilities | null;
  user_disambiguation?: {
    video_intent?: 'MOTION_REFERENCE' | 'TRANSFORM_VIDEO';
  };
}

export interface IntentAmbiguity {
  id: string;
  question: string;
  options: Array<{
    label: string;
    description?: string;
    value: string;
  }>;
}

export interface GenerationIntentResult {
  mode: GenerationMode;
  confidence: number;
  reason: string;
  human_label: string;
  validation_errors: string[];
  validation_warnings: string[];
  ambiguity?: IntentAmbiguity | null;
  has_start_end_frame: boolean;
}

export const GenerationIntentResolver = {
  resolve(input: IntentResolverInput): GenerationIntentResult {
    const {
      prompt = '',
      model_capabilities,
      user_disambiguation,
    } = input;

    // Normalizing slots from explicit slots or generic references list
    let initialImg = input.initial_image || null;
    let endImg = input.end_image || null;
    let sourceVid = input.source_video || null;
    const refImages: (WorkspaceReference | Asset)[] = input.reference_images ? [...input.reference_images] : [];
    const refVideos: (WorkspaceReference | Asset)[] = input.reference_videos ? [...input.reference_videos] : [];
    const refAudio: (WorkspaceReference | Asset)[] = input.reference_audio ? [...input.reference_audio] : [];

    const getItemId = (item: WorkspaceReference | Asset): string => {
      return 'asset_id' in item ? item.asset_id : (item as any).asset_id;
    };

    // If passed general references list, extract categorized slots
    if (input.references && input.references.length > 0) {
      for (const ref of input.references) {
        const role = ref.role?.toUpperCase();
        const type = ref.asset?.type || 'IMAGE';

        if (role === 'INITIAL_FRAME' || role === 'START_FRAME') {
          if (!initialImg) initialImg = ref;
        } else if (role === 'END_FRAME') {
          if (!endImg) endImg = ref;
        } else if (role === 'SOURCE_VIDEO' || role === 'BASE_VIDEO') {
          if (!sourceVid) sourceVid = ref;
        } else if (type === 'VIDEO') {
          if (!refVideos.some((v) => getItemId(v) === ref.asset_id)) {
            refVideos.push(ref);
          }
        } else if (type === 'AUDIO') {
          if (!refAudio.some((a) => getItemId(a) === ref.asset_id)) {
            refAudio.push(ref);
          }
        } else {
          if (!refImages.some((i) => getItemId(i) === ref.asset_id)) {
            refImages.push(ref);
          }
        }
      }
    }

    const validation_errors: string[] = [];
    const validation_warnings: string[] = [];
    let ambiguity: IntentAmbiguity | null = null;
    let mode: GenerationMode = 'TEXT_TO_VIDEO';
    let reason = 'Geração a partir de prompt descritivo';
    let human_label = 'Texto para Vídeo';
    let confidence = 1.0;
    let has_start_end_frame = false;

    const hasInitial = !!initialImg;
    const hasEnd = !!endImg;
    const hasSourceVid = !!sourceVid;
    const hasRefImages = refImages.length > 0;
    const hasRefVideos = refVideos.length > 0;
    const hasRefAudio = refAudio.length > 0;

    // RULE 1: Explicit source video -> VIDEO_TO_VIDEO
    if (hasSourceVid) {
      mode = 'VIDEO_TO_VIDEO';
      reason = 'Vídeo base carregado para transformação';
      human_label = 'Transformação de Vídeo';
      confidence = 0.98;
    }
    // RULE 2: Initial Image + End Image -> IMAGE_TO_VIDEO with start/end frame
    else if (hasInitial && hasEnd) {
      mode = 'IMAGE_TO_VIDEO';
      has_start_end_frame = true;
      reason = 'Transição contínua guiada por quadro inicial e final';
      human_label = 'Quadro Inicial e Final';
      confidence = 0.95;
    }
    // RULE 3: Initial Image only
    else if (hasInitial) {
      mode = 'IMAGE_TO_VIDEO';
      reason = 'Movimentação e geração a partir da imagem inicial';
      human_label = 'Imagem Inicial';
      confidence = 0.95;
    }
    // RULE 4: Reference video present
    else if (hasRefVideos) {
      if (user_disambiguation?.video_intent === 'TRANSFORM_VIDEO') {
        mode = 'VIDEO_TO_VIDEO';
        reason = 'Vídeo de referência selecionado para transformação direta';
        human_label = 'Transformação de Vídeo';
      } else if (user_disambiguation?.video_intent === 'MOTION_REFERENCE') {
        mode = 'REFERENCE_TO_VIDEO';
        reason = 'Vídeo de referência selecionado para extração de movimento';
        human_label = 'Referência de Movimento';
      } else {
        // Check model capabilities to auto-resolve if only 1 is supported
        const supportsV2V = model_capabilities?.supported_modes.includes('VIDEO_TO_VIDEO');
        const supportsRefV = model_capabilities?.supports_video_reference;

        if (supportsV2V && !supportsRefV) {
          mode = 'VIDEO_TO_VIDEO';
          reason = 'Vídeo detectado para transformação de vídeo compatível com o modelo';
          human_label = 'Transformação de Vídeo';
        } else if (supportsRefV && !supportsV2V) {
          mode = 'REFERENCE_TO_VIDEO';
          reason = 'Vídeo detectado como guia de movimento e dinâmica de câmera';
          human_label = 'Referência de Movimento';
        } else {
          // Ambiguous: ask user contextually
          ambiguity = {
            id: 'video_intent',
            question: 'Como você deseja utilizar este vídeo?',
            options: [
              {
                label: 'Referência de movimento',
                description: 'Copiar a dinâmica de câmera e ritmo para uma nova cena',
                value: 'MOTION_REFERENCE',
              },
              {
                label: 'Transformar este vídeo',
                description: 'Alterar o estilo ou elementos mantendo a cena original',
                value: 'TRANSFORM_VIDEO',
              },
            ],
          };
          mode = 'REFERENCE_TO_VIDEO';
          confidence = 0.6;
          reason = 'Vídeo presente no projeto (aguardando seleção de intenção)';
          human_label = 'Referência de Vídeo';
        }
      }
    }
    // RULE 5: Reference images present (without initial image)
    else if (hasRefImages) {
      if (model_capabilities?.supported_modes.includes('REFERENCE_TO_VIDEO')) {
        mode = 'REFERENCE_TO_VIDEO';
        reason = 'Criação estruturada com referências de estilo, produto ou personagem';
        human_label = 'Referências Visuais';
        confidence = 0.95;
      } else if (model_capabilities?.supported_modes.includes('IMAGE_TO_VIDEO') && refImages.length === 1) {
        mode = 'IMAGE_TO_VIDEO';
        reason = 'Referência única utilizada como imagem base';
        human_label = 'Imagem Base';
        confidence = 0.85;
      } else {
        mode = 'REFERENCE_TO_VIDEO';
        reason = 'Referências visuais vinculadas ao prompt com marcadores (@)';
        human_label = 'Referências Visuais';
      }
    }
    // RULE 6: Audio only or prompt only -> TEXT_TO_VIDEO
    else {
      mode = 'TEXT_TO_VIDEO';
      if (hasRefAudio) {
        reason = 'Prompt com trilha de áudio de referência';
        human_label = 'Texto com Áudio';
      } else {
        reason = 'Geração a partir de prompt descritivo';
        human_label = 'Texto para Vídeo';
      }
      confidence = 1.0;
    }

    // MODEL CAPABILITY VALIDATION
    if (model_capabilities) {
      if (!model_capabilities.supported_modes.includes(mode)) {
        validation_errors.push(
          `O modelo selecionado não suporta o modo detectado (${human_label}). Escolha outro modelo compatível.`
        );
      }

      // Check end frame capability
      if (hasEnd && !model_capabilities.supports_multiple_images) {
        validation_errors.push(
          'Este modelo não suporta imagem final (apenas imagem inicial). Remova a imagem final ou selecione um modelo com suporte a start/end frame.'
        );
      }

      // Check max reference images
      if (refImages.length > model_capabilities.max_reference_images) {
        validation_errors.push(
          `O modelo aceita no máximo ${model_capabilities.max_reference_images} imagem(ns) de referência. Você anexou ${refImages.length}.`
        );
      }

      // Check video reference
      if (refVideos.length > 0 && mode === 'REFERENCE_TO_VIDEO' && !model_capabilities.supports_video_reference) {
        validation_errors.push('Este modelo não possui suporte a vídeos de referência.');
      }

      // Check audio reference
      if (hasRefAudio && !model_capabilities.supports_audio_reference) {
        validation_warnings.push(
          'O modelo selecionado não sincroniza áudio de referência diretamente; o áudio não influenciará a geração.'
        );
      }
    }

    return {
      mode,
      confidence,
      reason,
      human_label,
      validation_errors,
      validation_warnings,
      ambiguity,
      has_start_end_frame,
    };
  },

  resolveMode(options: {
    model?: any;
    prompt?: string;
    references?: WorkspaceReference[];
    initialAsset?: Asset | null;
    endAsset?: Asset | null;
  }): {
    mode: GenerationMode;
    explanation: string;
    human_label: string;
    errors: string[];
    warnings: string[];
  } {
    const caps = options.model ? (options.model.supported_modes ? options.model : null) : null;
    const res = this.resolve({
      prompt: options.prompt,
      references: options.references,
      initial_image: options.initialAsset,
      end_image: options.endAsset,
      model_capabilities: caps,
    });
    return {
      mode: res.mode,
      explanation: res.reason,
      human_label: res.human_label,
      errors: res.validation_errors,
      warnings: res.validation_warnings,
    };
  },
};

export const generationIntentResolver = GenerationIntentResolver;

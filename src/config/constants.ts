/**
 * Global Constants & Configurations for AI Generation Platform
 */

export const BASE_CURRENCY = 'BRL';
export const DEFAULT_LOCALE = 'pt-BR';
export const PRICE_VARIATION_WARNING_THRESHOLD_PERCENT = 50;

/**
 * Formats integer cents into a localized Brazilian Real string.
 * Example: 1050 -> "R$ 10,50"
 */
export function formatCentsToBRL(cents: number): string {
  const safeInt = Math.round(cents || 0);
  const reals = safeInt / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reals);
}

/**
 * Parses a currency input string (e.g. "10,50" or "10.50") into integer cents safely.
 * Never allows floating point inaccuracy.
 */
export function parseBRLToCents(val: string | number): number {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const clean = val.replace(/[^\d,\.]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

/**
 * Initial Default Feature Flags
 */
export const INITIAL_FEATURE_FLAGS = [
  {
    flag_key: 'enable_generation_workspace',
    name: 'Creative Workspace',
    description: 'Workspace interativo de geração e compilação de prompts',
    is_enabled: true,
    is_private: false,
  },
  {
    flag_key: 'enable_auto_router',
    name: 'Smart Router',
    description: 'Roteador inteligente para menor custo de geração por provider',
    is_enabled: false,
    is_private: false,
  },
  {
    flag_key: 'enable_prompt_improver',
    name: 'Prompt Improver',
    description: 'Otimizador automático de prompt com IA',
    is_enabled: true,
    is_private: false,
  },
  {
    flag_key: 'enable_video_reference',
    name: 'Video & Image @Reference',
    description: 'Sistema de referências visuais com @ nos prompts',
    is_enabled: true,
    is_private: false,
  },
  {
    flag_key: 'enable_wavespeed',
    name: 'WaveSpeed Provider',
    description: 'Integração de geração com cluster WaveSpeed',
    is_enabled: false,
    is_private: true,
  },
  {
    flag_key: 'enable_atlas',
    name: 'Atlas Cloud Provider',
    description: 'Integração com infraestrutura Atlas Cloud',
    is_enabled: false,
    is_private: true,
  },
  {
    flag_key: 'enable_payments',
    name: 'Gateway de Pagamentos Reais',
    description: 'Checkout real para adição de fundos via Pix e Cartão',
    is_enabled: false,
    is_private: false,
  },
];

export const INITIAL_MODELS = [
  {
    model_id: 'wan-2-1-video',
    name: 'WAN 2.1 Video',
    slug: 'wan-2-1-video',
    category: 'VIDEO' as const,
    description: 'Modelo de ponta para geração de vídeo com alta fidelidade de movimento e dinamismo temporal.',
    status: 'ACTIVE' as const,
    best_for: 'Realismo e Movimento Dinâmico',
    recommended_aspect_ratio: '16:9',
    supported_modes: ['TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'REFERENCE_TO_VIDEO', 'VIDEO_TO_VIDEO'] as any[],
    supported_resolutions: ['720p', '1080p'],
    supported_durations: [5, 10, 15],
    supported_aspect_ratios: ['16:9', '9:16', '1:1', '4:5'],
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: false,
    supports_negative_prompt: true,
    supports_seed: true,
    max_reference_images: 4,
    max_reference_videos: 1,
    max_reference_audio: 0,
    max_prompt_length: 2500,
  },
  {
    model_id: 'kling-v1-5',
    name: 'Kling 1.5 Video Pro',
    slug: 'kling-v1-5',
    category: 'VIDEO' as const,
    description: 'Geração cinematográfica em 1080p com dinamismo e texturas fotorrealistas.',
    status: 'ACTIVE' as const,
    best_for: 'Cinematografia e Estética Premium',
    recommended_aspect_ratio: '16:9',
    supported_modes: ['TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'REFERENCE_TO_VIDEO'] as any[],
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
  },
  {
    model_id: 'hunyuan-video',
    name: 'Hunyuan Video Fast',
    slug: 'hunyuan-video',
    category: 'VIDEO' as const,
    description: 'Modelo open weights ultra-rápido otimizado para custo por segundo reduzido e rápida iteração.',
    status: 'EXPERIMENTAL' as const,
    best_for: 'Eficiência de Custo e Testes Rápidos',
    recommended_aspect_ratio: '16:9',
    supported_modes: ['TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO'] as any[],
    supported_resolutions: ['540p', '720p'],
    supported_durations: [5],
    supported_aspect_ratios: ['16:9', '9:16'],
    supports_image_reference: true,
    supports_multiple_images: false,
    supports_video_reference: false,
    supports_audio_reference: false,
    supports_negative_prompt: false,
    supports_seed: true,
    max_reference_images: 1,
    max_reference_videos: 0,
    max_reference_audio: 0,
    max_prompt_length: 1500,
  },
];

export const ASSET_UPLOAD_LIMITS = {
  IMAGE: {
    max_bytes: 25 * 1024 * 1024, // 25 MB
    allowed_mimes: ['image/jpeg', 'image/png', 'image/webp'],
    allowed_extensions: ['jpg', 'jpeg', 'png', 'webp'],
  },
  VIDEO: {
    max_bytes: 500 * 1024 * 1024, // 500 MB
    allowed_mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    allowed_extensions: ['mp4', 'mov', 'webm'],
  },
  AUDIO: {
    max_bytes: 100 * 1024 * 1024, // 100 MB
    allowed_mimes: ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'],
    allowed_extensions: ['mp3', 'wav', 'm4a', 'aac'],
  },
};

export const DEFAULT_PRESERVATION_RULES = {
  PRODUCT: {
    preserve: ['Logo e Branding', 'Geometria do Produto', 'Proporções da Embalagem', 'Cores Originais', 'Tipografia/Rótulo'],
    flexible: ['Iluminação do Ambiente', 'Posição/Ângulo de Câmera', 'Reflexos de Superfície', 'Cenário de Fundo'],
  },
  CHARACTER: {
    preserve: ['Estrutura Facial', 'Corte e Cor de Cabelo', 'Idade Aparente', 'Tom de Pele', 'Identidade da Roupa'],
    flexible: ['Expressão Facial', 'Pose Dinâmica', 'Direção do Olhar', 'Iluminação de Cena'],
  },
  ENVIRONMENT: {
    preserve: ['Arquitetura Principal', 'Paleta Cromática', 'Atmosfera e Clima', 'Escala Espacial'],
    flexible: ['Posicionamento de Objetos Secundários', 'Hora do Dia / Luz', 'Nível de Neblina / Desfoque'],
  },
  STYLE: {
    preserve: ['Grão e Textura Cinematográfica', 'Composição Visual', 'Tratamento de Cores'],
    flexible: ['Enquadramento', 'Elementos Decorativos'],
  },
  MOTION: {
    preserve: ['Trajetória de Câmera', 'Velocidade de Transição', 'Dinamismo Temporal'],
    flexible: ['Intensidade de Movimento Secundário'],
  },
  AUDIO_REFERENCE: {
    preserve: ['Tom e Timbre', 'Compasso Rítmico'],
    flexible: ['Efeitos de Fundo'],
  },
  GENERIC: {
    preserve: ['Fidelidade Visual do Objeto', 'Cores Principais'],
    flexible: ['Cenário', 'Iluminação', 'Ângulo'],
  },
};

export const DEFAULT_SYSTEM_PRESETS = [
  {
    preset_id: 'preset-product-hero',
    user_id: 'system',
    name: 'Product Hero Shot',
    description: 'Comercial premium de produto sobre base minimalista com iluminação de estúdio.',
    category: 'Comercial',
    prompt_template: 'Filmagem comercial cinematográfica de @produto em câmera lenta, girando suavemente sobre pedestal de quartzo negro, iluminação rim light em estúdio profissional, reflexos nítidos e partículas sutis.',
    negative_prompt_template: 'deformado, sombras duras, baixa resolução, desfoque indesejado, artefatos visuais',
    generation_settings: {
      mode: 'REFERENCE_TO_VIDEO' as any,
      duration_seconds: 10,
      resolution: '1080p',
      aspect_ratio: '16:9',
      number_of_outputs: 1,
    },
    reference_rules_template: {
      priority: 'CRITICAL' as const,
      preservation_rules: ['Logo e Branding', 'Geometria do Produto', 'Proporções da Embalagem', 'Cores Originais'],
      flexible_rules: ['Iluminação do Ambiente', 'Reflexos de Superfície'],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    preset_id: 'preset-cinematic-motion',
    user_id: 'system',
    name: 'Cinematic Drone & Motion',
    description: 'Movimento de câmera dinâmico com iluminação golden hour e profundidade de campo rasa.',
    category: 'Cinematografia',
    prompt_template: 'Plano sequência cinematográfico com movimento fluido de câmera em tracking shot, luz dourada de pôr do sol, profundidade de campo rasa (f/1.8), atmosfera fotorrealista em alta definição.',
    negative_prompt_template: 'imagem estática, tremido de câmera amador, granulação excessiva, cores lavadas',
    generation_settings: {
      mode: 'TEXT_TO_VIDEO' as any,
      duration_seconds: 5,
      resolution: '1080p',
      aspect_ratio: '16:9',
      number_of_outputs: 1,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    preset_id: 'preset-character-portrait',
    user_id: 'system',
    name: 'Character Dialogue & Portrait',
    description: 'Foco na preservação da identidade de personagem com iluminação suave e expressão natural.',
    category: 'Personagens',
    prompt_template: 'Retrato cinematográfico de @personagem em iluminação suave de estúdio, expressão pensativa e serena, olhar sutil para a lente, textura natural de pele e bokeh elegante.',
    negative_prompt_template: 'rosto distorcido, olhos desalinhados, pele plástica, múltiplos dedos, proporções estranhas',
    generation_settings: {
      mode: 'REFERENCE_TO_VIDEO' as any,
      duration_seconds: 5,
      resolution: '1080p',
      aspect_ratio: '9:16',
      number_of_outputs: 1,
    },
    reference_rules_template: {
      priority: 'HIGH' as const,
      preservation_rules: ['Estrutura Facial', 'Corte e Cor de Cabelo', 'Tom de Pele'],
      flexible_rules: ['Expressão Facial', 'Iluminação de Cena'],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    preset_id: 'preset-luxury-brand',
    user_id: 'system',
    name: 'Luxury Brand Film',
    description: 'Estética de alta costura e luxo com macro detalhes, contraste refinado e ritmo lento.',
    category: 'Moda & Luxo',
    prompt_template: 'Filme publicitário de alta costura com macro close-ups de texturas ricas, contraste sofisticado, movimentos de câmera milimétricos e atmosfera de sofisticação moderna.',
    negative_prompt_template: 'estética barata, iluminação amadora, cores saturadas, ruído digital',
    generation_settings: {
      mode: 'TEXT_TO_VIDEO' as any,
      duration_seconds: 10,
      resolution: '1080p',
      aspect_ratio: '16:9',
      number_of_outputs: 1,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Initial Cataloged Providers (Registered Metadata - Etapa 1)
 * NOTE: In Etapa 1, no runtime adapters or API keys are active. Status is INACTIVE until integration in Etapa 3.
 */
export const INITIAL_PROVIDERS = [
  {
    provider_id: 'provider-atlas',
    name: 'Atlas Cloud',
    slug: 'atlas-cloud',
    status: 'INACTIVE' as const,
    priority: 100,
    is_configured: false,
  },
  {
    provider_id: 'provider-wavespeed',
    name: 'WaveSpeed AI',
    slug: 'wavespeed',
    status: 'INACTIVE' as const,
    priority: 90,
    is_configured: false,
  },
  {
    provider_id: 'provider-fal',
    name: 'Fal AI Compute',
    slug: 'fal-ai',
    status: 'INACTIVE' as const,
    priority: 80,
    is_configured: false,
  },
];

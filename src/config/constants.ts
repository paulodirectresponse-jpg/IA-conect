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
    name: 'Creative Workspace (Etapa 2)',
    description: 'Workspace interativo de geração e compilação de prompts',
    is_enabled: false,
    is_private: false,
  },
  {
    flag_key: 'enable_auto_router',
    name: 'Smart Router (Etapa 3)',
    description: 'Roteador inteligente para menor custo de geração por provider',
    is_enabled: false,
    is_private: false,
  },
  {
    flag_key: 'enable_prompt_improver',
    name: 'Prompt Improver (Etapa 2)',
    description: 'Otimizador automático de prompt com IA',
    is_enabled: false,
    is_private: false,
  },
  {
    flag_key: 'enable_video_reference',
    name: 'Video & Image @Reference (Etapa 2)',
    description: 'Sistema de referências visuais com @ nos prompts',
    is_enabled: false,
    is_private: false,
  },
  {
    flag_key: 'enable_wavespeed',
    name: 'WaveSpeed Provider (Etapa 3)',
    description: 'Integração de geração com cluster WaveSpeed',
    is_enabled: false,
    is_private: true,
  },
  {
    flag_key: 'enable_atlas',
    name: 'Atlas Cloud Provider (Etapa 3)',
    description: 'Integração com infraestrutura Atlas Cloud',
    is_enabled: false,
    is_private: true,
  },
  {
    flag_key: 'enable_payments',
    name: 'Gateway de Pagamentos Reais (Etapa 3)',
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
    description: 'Modelo de ponta para geração de vídeo com alta fidelidade de movimento.',
    status: 'ACTIVE' as const,
  },
  {
    model_id: 'kling-v1-5',
    name: 'Kling 1.5 Video Pro',
    slug: 'kling-v1-5',
    category: 'VIDEO' as const,
    description: 'Geração cinematográfica em 1080p com dinamismo temporal.',
    status: 'ACTIVE' as const,
  },
  {
    model_id: 'hunyuan-video',
    name: 'Hunyuan Video Fast',
    slug: 'hunyuan-video',
    category: 'VIDEO' as const,
    description: 'Modelo open weights otimizado para custo por segundo reduzido.',
    status: 'EXPERIMENTAL' as const,
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

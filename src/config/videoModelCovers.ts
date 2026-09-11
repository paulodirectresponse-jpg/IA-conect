const VIDEO_MODEL_COVERS: Record<string, string> = {
  'wan-3-0-prime': '/model-covers/wan-3-0-prime.webp',
  'seedance-2-5': '/model-covers/seedance-2-5.webp',
  'wan-3-0': '/model-covers/wan-3-0.webp',
  'kling-3-0': '/model-covers/kling-3-0.webp',
  'google-omni-flash': '/model-covers/google-omni-flash.webp',
  'minimax-h3': '/model-covers/minimax-h3.webp',
  'seedance-2-0': '/model-covers/seedance-2-0.webp',
};

export function getVideoModelCover(modelId?: string | null) {
  return VIDEO_MODEL_COVERS[String(modelId || '')] || null;
}

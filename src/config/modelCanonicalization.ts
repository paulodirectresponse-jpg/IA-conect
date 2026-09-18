export const LEGACY_MODEL_CANONICAL_IDS:Record<string,string>={
  // Image families that were previously duplicated by operation.
  'gpt-image-2-edit':'gpt-image-2',
  'nano-banana-2-edit':'nano-banana-2-image',
  'nano-banana-pro-edit':'nano-banana-pro-image',
  'seedream-5-pro-edit':'seedream-5-pro-image',
  'flux-2-max-edit':'flux-2-max-image',
  'flux-2-pro-edit':'flux-2-pro-image',
  'qwen-image-3-pro-edit':'qwen-image-3-pro',
  'seedream-4-5-edit':'seedream-4-5-image',
  'wan-2-7-image-edit':'wan-2-7-image',
  'flux-fill-pro-edit':'flux-fill-pro-image',

  // Video families that were previously duplicated by generation/edit/extend.
  'seedance-2-5-video-edit':'seedance-2-5',
  'seedance-2-5-video-edit-turbo':'seedance-2-5',
  'seedance-2-5-video-extend':'seedance-2-5',
  'wan-3-0-prime-video-edit':'wan-3-0-prime',
  'wan-3-0-prime-video-extend':'wan-3-0-prime',
  'wan-3-0-video-edit':'wan-3-0',
  'wan-3-0-video-extend':'wan-3-0',
  'minimax-h3-video-edit':'minimax-h3',
  'minimax-h3-video-extend':'minimax-h3',
  'luma-ray-3-2-video-edit':'luma-ray-3-2',
  'gemini-omni-1-1-flash-video-edit':'google-omni-flash',
  'veo-3-1-video-extend':'veo-3-1',
  'veo-3-1-fast-video-extend':'veo-3-1-fast',
  'grok-imagine-video-extend':'grok-imagine-video',

  // Editor-only models still use a clean canonical model identity.
  'kling-o3-pro-video-edit':'kling-o3-pro',
  'kling-o3-4k-video-edit':'kling-o3-4k',
  'kling-o1-video-edit':'kling-o1',
  'ltx-2-3-video-extend':'ltx-2-3',
  'wan-2-7-video-extend':'wan-2-7-video',
  'pixverse-v6-video-extend':'pixverse-v6',
};

export function canonicalModelId(modelId:string){
  const id=String(modelId||'').trim();
  return LEGACY_MODEL_CANONICAL_IDS[id]||id;
}

export function isLegacyDuplicateModelId(modelId:string){
  return canonicalModelId(modelId)!==String(modelId||'').trim();
}

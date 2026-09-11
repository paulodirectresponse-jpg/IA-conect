const IMAGE_MODEL_COVERS:Record<string,string>={
  'nano-banana-pro-image':'/model-covers/nano-banana-pro-image.png',
  'nano-banana-2-image':'/model-covers/nano-banana-2-image.png',
  'nano-banana-2-lite-image':'/model-covers/nano-banana-2-lite-image.png',
  'seedream-5-pro-image':'/model-covers/seedream-5-pro-image.png',
  'gpt-image-2':'/model-covers/gpt-image-2.png',
};

export function getImageModelCover(modelId?:string|null){
  return IMAGE_MODEL_COVERS[String(modelId||'')]||null;
}

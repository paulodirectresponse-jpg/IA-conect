export interface ImageCoverSources {
  avif:string;
  webp:string;
  png:string;
}

const sourceSet=(base:string):ImageCoverSources=>({
  avif:`${base}-v1.avif`,
  webp:`${base}-v1.webp`,
  png:`${base}.png`,
});

const IMAGE_MODEL_COVERS:Record<string,ImageCoverSources>={
  'nano-banana-pro-image':sourceSet('/model-covers/nano-banana-pro-image'),
  'nano-banana-2-image':sourceSet('/model-covers/nano-banana-2-image'),
  'nano-banana-2-lite-image':sourceSet('/model-covers/nano-banana-2-lite-image'),
  'seedream-5-pro-image':sourceSet('/model-covers/seedream-5-pro-image'),
  'gpt-image-2':sourceSet('/model-covers/gpt-image-2'),
};

export function getImageModelCoverSources(modelId?:string|null){
  return IMAGE_MODEL_COVERS[String(modelId||'')]||null;
}

export function getImageModelCover(modelId?:string|null){
  return getImageModelCoverSources(modelId)?.avif||null;
}

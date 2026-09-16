export interface StaticImageSources {
  avif:string;
  webp:string;
  png:string;
}

const sourceSet=(base:string):StaticImageSources=>({
  avif:`${base}-v1.avif`,
  webp:`${base}-v1.webp`,
  png:`${base}.png`,
});

export const enterpriseVisualAssets = Object.freeze({
  homePlanet: sourceSet('/enterprise/visuals/planet-hero-wide'),
  communityPlanet: sourceSet('/enterprise/visuals/planet-hero-standard'),
  libraryPlanet: sourceSet('/enterprise/visuals/planet-subtle'),
  studioPlanet: sourceSet('/enterprise/visuals/planet-bottom-right'),
  mobilePlanet: sourceSet('/enterprise/visuals/planet-orb-square'),
  createImageHero: sourceSet('/enterprise/visuals/create-image-cat-desktop'),
  createVideoHero: sourceSet('/enterprise/visuals/create-video-surfer-desktop'),
});

export function cssImageSet(source:StaticImageSources){
  return `image-set(url("${source.avif}") type("image/avif"), url("${source.webp}") type("image/webp"), url("${source.png}") type("image/png"))`;
}

export type EnterpriseVisualAssetKey = keyof typeof enterpriseVisualAssets;

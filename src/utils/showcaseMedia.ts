export const SHOWCASE_VIDEO_FILES=[
  'Kling.mp4',
  'Omni flash.mp4',
  'Seedance 2.5.mp4',
  'Wan 3.0.mp4',
  'Wan 3.0 prime.mp4',
] as const;

const showcaseVideoFiles=new Set<string>(SHOWCASE_VIDEO_FILES);

export function isShowcaseVideoFile(value:string){
  return showcaseVideoFiles.has(value);
}

export function showcaseVideoUrl(fileName:string){
  if(!isShowcaseVideoFile(fileName))throw new Error('Arquivo de showcase não permitido.');
  return `/api/assets/media/showcase/${encodeURIComponent(fileName)}`;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd();
const targets=[
  'public/enterprise/visuals/create-image-cat-desktop.png',
  'public/enterprise/visuals/create-video-surfer-desktop.png',
  'public/enterprise/visuals/planet-bottom-right.png',
  'public/enterprise/visuals/planet-hero-standard.png',
  'public/enterprise/visuals/planet-hero-wide.png',
  'public/enterprise/visuals/planet-orb-square.png',
  'public/enterprise/visuals/planet-subtle.png',
  'public/model-covers/gpt-image-2.png',
  'public/model-covers/nano-banana-2-image.png',
  'public/model-covers/nano-banana-2-lite-image.png',
  'public/model-covers/nano-banana-pro-image.png',
  'public/model-covers/seedream-5-pro-image.png',
  'public/brand/ia-connect-logo-oficial.png',
];

async function statSize(file){
  try{return (await fs.stat(file)).size;}catch{return 0;}
}

async function optimize(relative){
  const input=path.join(root,relative);
  const parsed=path.parse(input);
  const webp=path.join(parsed.dir,`${parsed.name}-v1.webp`);
  const avif=path.join(parsed.dir,`${parsed.name}-v1.avif`);
  const image=sharp(input,{failOn:'warning'}).rotate();

  await Promise.all([
    image.clone().webp({quality:82,effort:5,smartSubsample:true}).toFile(webp),
    image.clone().avif({quality:64,effort:5,chromaSubsampling:'4:4:4'}).toFile(avif),
  ]);

  const [sourceBytes,webpBytes,avifBytes]=await Promise.all([statSize(input),statSize(webp),statSize(avif)]);
  return{relative,sourceBytes,webpBytes,avifBytes};
}

const results=[];
for(const target of targets)results.push(await optimize(target));

const appIconInput=path.join(root,'public/brand/ia-connect-app-icon.png');
const appIconOutputs=[
  {size:64,file:path.join(root,'public/brand/ia-connect-app-icon-64-v1.png')},
  {size:192,file:path.join(root,'public/brand/ia-connect-app-icon-192-v1.png')},
  {size:512,file:path.join(root,'public/brand/ia-connect-app-icon-512-v1.png')},
];
await Promise.all(appIconOutputs.map(({size,file})=>
  sharp(appIconInput,{failOn:'warning'})
    .rotate()
    .resize(size,size,{fit:'contain',withoutEnlargement:true})
    .png({compressionLevel:9,adaptiveFiltering:true})
    .toFile(file)
));
console.log('Brand icon derivatives generated');
for(const item of appIconOutputs){
  console.log(`- ${path.relative(root,item.file)}: ${((await statSize(item.file))/1024).toFixed(1)} KiB`);
}

const source=results.reduce((sum,row)=>sum+row.sourceBytes,0);
const webp=results.reduce((sum,row)=>sum+row.webpBytes,0);
const avif=results.reduce((sum,row)=>sum+row.avifBytes,0);
const pct=(value)=>source?Math.round((1-value/source)*100):0;

console.log('Static image derivatives generated');
for(const row of results){
  console.log(`- ${row.relative}: ${(row.sourceBytes/1024).toFixed(1)} KiB -> WebP ${(row.webpBytes/1024).toFixed(1)} KiB | AVIF ${(row.avifBytes/1024).toFixed(1)} KiB`);
}
console.log(`Total source ${(source/1024).toFixed(1)} KiB | WebP ${(webp/1024).toFixed(1)} KiB (-${pct(webp)}%) | AVIF ${(avif/1024).toFixed(1)} KiB (-${pct(avif)}%)`);

import fs from'node:fs';
import path from'node:path';
import{gzipSync}from'node:zlib';

const root=process.cwd();
const assets=path.join(root,'dist','client','assets');
if(!fs.existsSync(assets)){
  console.error('dist/client/assets não existe. Execute o build antes do budget.');
  process.exit(1);
}

const files=fs.readdirSync(assets).filter(name=>/\.js$/i.test(name));
const indexFiles=files.filter(name=>/^index-[\w-]+\.js$/i.test(name));
if(!indexFiles.length){
  console.error('Chunk inicial index-*.js não encontrado.');
  process.exit(1);
}
const rows=indexFiles.map(name=>{
  const buffer=fs.readFileSync(path.join(assets,name));
  return{name,raw:buffer.byteLength,gzip:gzipSync(buffer).byteLength};
}).sort((a,b)=>b.raw-a.raw);
const main=rows[0];
const limits={raw:460*1024,gzip:125*1024};
console.log(`Initial client chunk: ${main.name} ${(main.raw/1024).toFixed(1)} KiB raw / ${(main.gzip/1024).toFixed(1)} KiB gzip`);

const failures=[];
if(main.raw>limits.raw)failures.push(`raw ${main.raw} > ${limits.raw}`);
if(main.gzip>limits.gzip)failures.push(`gzip ${main.gzip} > ${limits.gzip}`);

if(process.env.GITHUB_STEP_SUMMARY){
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '## Initial bundle budget',
    '',
    '| Métrica | Medido | Gate |',
    '| --- | ---: | ---: |',
    `| JS inicial raw | ${(main.raw/1024).toFixed(1)} KiB | ≤ 460 KiB |`,
    `| JS inicial gzip | ${(main.gzip/1024).toFixed(1)} KiB | ≤ 125 KiB |`,
    '',
  ].join('\n')+'\n');
}
if(failures.length){
  console.error('Bundle budget excedido:\n- '+failures.join('\n- '));
  process.exit(1);
}

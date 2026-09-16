import fs from'node:fs';

const[file,profile='4g']=process.argv.slice(2);
if(!file||!fs.existsSync(file)){
  console.error('Uso: node scripts/assert-lighthouse.mjs <report.json> <fast3g|4g>');
  process.exit(1);
}
const report=JSON.parse(fs.readFileSync(file,'utf8'));
const audits=report.audits||{};
const number=(id)=>Number(audits[id]?.numericValue);
const score=Number(report.categories?.performance?.score||0);
const metrics={
  lcp_ms:number('largest-contentful-paint'),
  cls:number('cumulative-layout-shift'),
  tbt_ms:number('total-blocking-time'),
  speed_index_ms:number('speed-index'),
  performance_score:score,
};
const thresholds=profile==='fast3g'
  ?{lcp_ms:4500,cls:0.10,tbt_ms:900}
  :{lcp_ms:3000,cls:0.10,tbt_ms:600};

console.log(`Lighthouse ${profile}: score=${Math.round(score*100)} LCP=${Math.round(metrics.lcp_ms)}ms CLS=${metrics.cls.toFixed(3)} TBT=${Math.round(metrics.tbt_ms)}ms SpeedIndex=${Math.round(metrics.speed_index_ms)}ms`);

const failures=[];
for(const[key,limit]of Object.entries(thresholds)){
  const value=metrics[key];
  if(!Number.isFinite(value))failures.push(`${key}: métrica ausente`);
  else if(value>limit)failures.push(`${key}: ${value} > ${limit}`);
}

if(process.env.GITHUB_STEP_SUMMARY){
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    `## Lighthouse — ${profile}`,
    '',
    '| Métrica | Medido | Gate |',
    '| --- | ---: | ---: |',
    `| Performance score | ${Math.round(score*100)} | informativo |`,
    `| LCP | ${Math.round(metrics.lcp_ms)} ms | ≤ ${thresholds.lcp_ms} ms |`,
    `| CLS | ${metrics.cls.toFixed(3)} | ≤ ${thresholds.cls} |`,
    `| TBT | ${Math.round(metrics.tbt_ms)} ms | ≤ ${thresholds.tbt_ms} ms |`,
    `| Speed Index | ${Math.round(metrics.speed_index_ms)} ms | informativo |`,
    '',
  ].join('\n')+'\n');
}

if(failures.length){
  console.error('Performance QA falhou:\n- '+failures.join('\n- '));
  process.exit(1);
}

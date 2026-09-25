let cache:{value:number;expiresAt:number}|null=null;

function isoDate(date:Date){
  const mm=String(date.getUTCMonth()+1).padStart(2,'0');
  const dd=String(date.getUTCDate()).padStart(2,'0');
  const yyyy=date.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export async function getUsdBrlRate(){
  const env=Number(process.env.ROUTING_V2_FX_USD_BRL);
  if(Number.isFinite(env)&&env>0)return env;
  if(cache&&cache.expiresAt>Date.now())return cache.value;

  const end=new Date();
  const start=new Date(end.getTime()-7*24*60*60*1000);
  const url="https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?"+
    `@dataInicial='${isoDate(start)}'&@dataFinalCotacao='${isoDate(end)}'&$top=100&$format=json`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok)throw new Error(`BCB FX HTTP ${response.status}`);
    const body:any=await response.json();
    const rows=Array.isArray(body?.value)?body.value:[];
    const latest=rows
      .map((row:any)=>({rate:Number(row?.cotacaoVenda),timestamp:Date.parse(row?.dataHoraCotacao||'')}))
      .filter((row:any)=>Number.isFinite(row.rate)&&row.rate>0)
      .sort((a:any,b:any)=>b.timestamp-a.timestamp)[0];
    if(!latest)throw new Error('BCB não retornou cotação USD/BRL válida.');
    cache={value:latest.rate,expiresAt:Date.now()+6*60*60*1000};
    return latest.rate;
  }finally{clearTimeout(timer);}
}

import { RoutingV2CatalogModel } from './adapter.js';

function trimBase(value:string|undefined,fallback:string){
  return String(value||fallback).replace(/\/+$/,'').replace(/\/api\/v1$/,'');
}

function asArray(value:any):any[]{
  if(Array.isArray(value))return value;
  if(Array.isArray(value?.data))return value.data;
  if(Array.isArray(value?.results))return value.results;
  return [];
}

async function readJson(url:string,init?:RequestInit){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5500);
  try{
    const response=await fetch(url,{...init,signal:controller.signal});
    const text=await response.text();
    let body:any={};
    try{body=JSON.parse(text);}catch{}
    if(!response.ok){
      const providerError=Array.isArray(body?.errors)?body.errors[0]:null;
      const message=String(providerError?.message||providerError?.code||body?.message||body?.error||`Catalog HTTP ${response.status}`);
      throw Object.assign(new Error(message),{code:`ROUTING_V2_CATALOG_HTTP_${response.status}`});
    }
    return body;
  }finally{
    clearTimeout(timer);
  }
}

function clean(value:any){
  if(value==null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value).trim();
  if(typeof value==='object'){
    for(const key of ['name','displayName','display_name','provider','vendor','creator','slug','id']){
      const nested=(value as any)?.[key];
      if(typeof nested==='string'||typeof nested==='number')return String(nested).trim();
    }
    return'';
  }
  return String(value).trim();
}

export async function listAtlasCatalogModels():Promise<RoutingV2CatalogModel[]>{
  const base=trimBase(process.env.ATLAS_BASE_URL,'https://api.atlascloud.ai');
  const body=await readJson(`${base}/api/v1/models`);
  const rows=asArray(body).filter((row:any)=>row?.display_console!==false);

  return rows.map((row:any)=>{
    const identifier=clean(row?.model||row?.id||row?.name);
    const name=clean(row?.displayName||row?.display_name||row?.name||identifier);
    const vendor=clean(row?.provider||row?.vendor||identifier.split('/')[0])||null;
    return {
      provider_model_identifier:identifier,
      name,
      vendor,
      capabilities:[],
      metadata:{
        type:row?.type??null,
        tags:Array.isArray(row?.tags)?row.tags:[],
        schema:row?.schema??null,
        display_console:row?.display_console??null,
      },
    };
  }).filter((row:RoutingV2CatalogModel)=>Boolean(row.provider_model_identifier));
}

export async function listRunwareCatalogModels(query=''):Promise<RoutingV2CatalogModel[]>{
  const apiKey=process.env.RUNWARE_API_KEY?.trim();
  if(!apiKey)throw Object.assign(new Error('Runware não configurada.'),{code:'ROUTING_V2_PROVIDER_NOT_CONFIGURED'});

  const url=String(process.env.RUNWARE_BASE_URL||'https://api.runware.ai/v1').replace(/\/+$/,'');
  const taskUUID=crypto.randomUUID();
  const rawSearch=clean(query);
  const search=(rawSearch||'ai').slice(0,48);
  if(search.length<2)throw Object.assign(new Error('Busca Runware deve ter entre 2 e 48 caracteres.'),{code:'ROUTING_V2_RUNWARE_SEARCH_INVALID'});
  const body=await readJson(url,{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify([{
      taskType:'modelSearch',
      taskUUID,
      search,
      visibility:'public',
      sort:'popularity',
      offset:0,
      limit:100,
    }]),
  });

  const envelope=Array.isArray(body?.data)?body.data.find((item:any)=>item?.taskUUID===taskUUID)||body.data[0]:body;
  const rows=Array.isArray(envelope?.results)?envelope.results:[];

  return rows.map((row:any)=>{
    const identifier=clean(row?.air||row?.model||row?.id);
    const name=clean(row?.name||row?.model||identifier);
    const vendor=clean(row?.provider||row?.creator||identifier.split(':')[0])||null;
    return {
      provider_model_identifier:identifier,
      name,
      vendor,
      capabilities:[],
      metadata:{
        category:row?.category??null,
        architecture:row?.architecture??null,
        source:row?.source??null,
        type:row?.type??null,
        tags:Array.isArray(row?.tags)?row.tags:[],
        hero_image:row?.heroImage??null,
      },
    };
  }).filter((row:RoutingV2CatalogModel)=>Boolean(row.provider_model_identifier));
}

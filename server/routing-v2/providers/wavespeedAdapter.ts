import {RoutingV2ProviderAdapter,RoutingV2CatalogModel} from '../adapter.js';
import {RoutingV2Provider} from '../domain.js';
import {createRoutingV2LegacyWrapperAdapter} from '../legacyWrapperAdapter.js';

const BASE='https://api.wavespeed.ai';
const CATALOG=`${BASE}/api/v3/models`;
function key(){return String(process.env.WAVESPEED_API_KEY||'').trim();}
async function catalog(){
  const apiKey=key();
  if(!apiKey)throw Object.assign(new Error('WaveSpeed não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10_000);
  try{
    const response=await fetch(CATALOG,{headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json'},signal:controller.signal});
    const body:any=await response.json().catch(()=>null);
    if(!response.ok)throw Object.assign(new Error(`WaveSpeed catalog HTTP ${response.status}`),{code:`WAVESPEED_CATALOG_HTTP_${response.status}`});
    const rows=Array.isArray(body?.data)?body.data:Array.isArray(body?.data?.models)?body.data.models:Array.isArray(body?.models)?body.models:[];
    if(!rows.length)throw new Error('WaveSpeed catalog não retornou modelos.');
    return rows as any[];
  }finally{clearTimeout(timer);}
}
function identifier(row:any){return String(row?.model_id||row?.id||row?.slug||'').trim();}
function price(row:any){
  for(const candidate of [row?.base_price,row?.price,row?.pricing?.base_price,row?.pricing?.price]){
    const value=Number(candidate);if(Number.isFinite(value)&&value>0)return value;
  }
  return null;
}

export const waveSpeedRoutingV2Adapter:RoutingV2ProviderAdapter={
  adapter_id:'v2:provider-wavespeed',provider_id:'provider-wavespeed',
  isConfigured:()=>Boolean(key()),
  async health(){
    try{await catalog();return{status:'HEALTHY',checked_at:new Date().toISOString(),message:'Catálogo autenticado respondeu com modelos.'};}
    catch(error:any){return{status:error?.code==='PROVIDER_NOT_CONFIGURED'||String(error?.code||'').includes('401')?'UNAVAILABLE':'DEGRADED',checked_at:new Date().toISOString(),message:String(error?.message||error)};}
  },
  async listModels(){
    return(await catalog()).map((row):RoutingV2CatalogModel=>({provider_model_identifier:identifier(row),name:String(row?.name||identifier(row)),vendor:String(row?.vendor||'WaveSpeed'),metadata:{source_reference:CATALOG,base_price:price(row)}})).filter(row=>Boolean(row.provider_model_identifier));
  },
  async getPrice(_provider:RoutingV2Provider,modelIdentifier:string){
    const row=(await catalog()).find(item=>identifier(item)===modelIdentifier);
    if(!row)throw new Error('Modelo não encontrado no catálogo autenticado da WaveSpeed.');
    const amount=price(row);if(!amount)throw new Error('Catálogo WaveSpeed não publicou preço positivo para o modelo.');
    return{billing_config:{type:'PER_GENERATION' as const,currency:'USD' as const,price_per_generation:amount},source:'PROVIDER_CATALOG_API' as const,source_reference:`${CATALOG}#${encodeURIComponent(modelIdentifier)}`,fetched_at:new Date().toISOString()};
  },
  async submitGeneration(provider,input){const adapter=createRoutingV2LegacyWrapperAdapter(provider.provider_id);if(!adapter?.submitGeneration)throw new Error('Executor WaveSpeed indisponível.');return adapter.submitGeneration(provider,input);},
  async checkGeneration(provider,id){const adapter=createRoutingV2LegacyWrapperAdapter(provider.provider_id);if(!adapter?.checkGeneration)throw new Error('Executor WaveSpeed indisponível.');return adapter.checkGeneration(provider,id);},
  async cancelGeneration(provider,id){const adapter=createRoutingV2LegacyWrapperAdapter(provider.provider_id);return adapter?.cancelGeneration?adapter.cancelGeneration(provider,id):false;},
};

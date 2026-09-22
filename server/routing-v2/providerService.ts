import { routingV2Repository } from './repository.js';
import { RoutingV2Provider, RoutingV2ProviderStatus, RoutingV2ProviderType } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { ensureRoutingV2LegacyAdapter } from './legacyAdapterBridge.js';
import { createRoutingV2LegacyWrapperAdapter } from './legacyWrapperAdapter.js';

const now=()=>new Date().toISOString();
const slugify=(value:string)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export interface CreateRoutingV2ProviderInput{
  provider_id:string;
  name:string;
  type:RoutingV2ProviderType;
  adapter_id?:string;
  secret_reference?:string|null;
  priority?:number;
}

export interface UpdateRoutingV2ProviderInput{
  name?:string;
  status?:RoutingV2ProviderStatus;
  priority?:number;
  adapter_id?:string;
  secret_reference?:string|null;
}

function resolveAdapter(adapterId:string){
  const registered=routingV2AdapterRegistry.get(adapterId);
  if(registered)return registered;
  if(adapterId.startsWith('legacy:')){
    const providerId=adapterId.slice('legacy:'.length).trim();
    return providerId?ensureRoutingV2LegacyAdapter(providerId):null;
  }
  if(adapterId.startsWith('wrapper:')){
    const providerId=adapterId.slice('wrapper:'.length).trim();
    return providerId?createRoutingV2LegacyWrapperAdapter(providerId):null;
  }
  return null;
}

function validateId(value:string,label:string){
  const id=String(value||'').trim();
  if(!id)throw new Error(`${label} é obrigatório.`);
  if(!/^[a-zA-Z0-9._-]+$/.test(id))throw new Error(`${label} contém caracteres inválidos.`);
  return id;
}
function validateAdapterId(value:string){
  const id=String(value||'').trim();
  if(!id)throw new Error('adapter_id é obrigatório.');
  if(!/^[a-zA-Z0-9._:-]+$/.test(id))throw new Error('adapter_id contém caracteres inválidos.');
  return id;
}


export const ROUTING_V2_CORE_PROVIDERS=[
  {provider_id:'provider-wavespeed',name:'WaveSpeed AI',type:'AGGREGATOR' as const,adapter_id:'v2:provider-wavespeed',priority:110},
  {provider_id:'provider-atlas',name:'Atlas Cloud',type:'AGGREGATOR' as const,adapter_id:'wrapper:provider-atlas',priority:100},
  {provider_id:'provider-runware',name:'Runware',type:'AGGREGATOR' as const,adapter_id:'wrapper:provider-runware',priority:90},
];

export const routingV2ProviderService={
  async list(){
    return routingV2Repository.listProviders();
  },

  async get(providerId:string){
    return routingV2Repository.getProvider(providerId);
  },

  async bootstrapCore(){
    const result:{created:string[];existing:string[];failed:Array<{provider_id:string;error:string}>}={created:[],existing:[],failed:[]};
    for(const input of ROUTING_V2_CORE_PROVIDERS){
      try{
        const existing=await routingV2Repository.getProvider(input.provider_id);
        if(existing){
          await this.update(input.provider_id,{adapter_id:input.adapter_id,priority:input.priority});
          result.existing.push(input.provider_id);continue;
        }
        await this.create(input);
        result.created.push(input.provider_id);
      }catch(error:any){
        result.failed.push({provider_id:input.provider_id,error:String(error?.message||error)});
      }
    }
    return result;
  },

  async create(input:CreateRoutingV2ProviderInput){
    const providerId=validateId(input.provider_id,'provider_id');
    const name=String(input.name||'').trim();
    const known=ROUTING_V2_CORE_PROVIDERS.find(row=>row.provider_id===providerId);
    const adapterId=validateAdapterId(input.adapter_id||known?.adapter_id||`wrapper:${providerId}`);
    if(!name)throw new Error('Nome do provider é obrigatório.');
    if(await routingV2Repository.getProvider(providerId))throw new Error('Provider V2 já existe.');
    const adapter=resolveAdapter(adapterId);
    if(!adapter)throw new Error('Adapter V2 não registrado.');

    const timestamp=now();
    const provider:RoutingV2Provider={
      provider_id:providerId,
      name,
      slug:slugify(name)||providerId,
      type:input.type,
      status:'ACTIVE',
      priority:Number.isFinite(Number(input.priority))?Number(input.priority):100,
      adapter_id:adapterId,
      secret_reference:input.secret_reference?.trim()||null,
      supports_catalog_sync:Boolean(adapter.listModels),
      supports_pricing_sync:Boolean(adapter.getPrice),
      supports_balance:Boolean(adapter.balance),
      balance_amount:null,
      balance_currency:null,
      balance_updated_at:null,
      health_status:'UNKNOWN',
      last_health_check_at:null,
      created_at:timestamp,
      updated_at:timestamp,
    };
    return routingV2Repository.saveProvider(provider);
  },

  async update(providerId:string,input:UpdateRoutingV2ProviderInput){
    const current=await routingV2Repository.getProvider(providerId);
    if(!current)throw new Error('Provider V2 não encontrado.');
    const adapterId=input.adapter_id===undefined?current.adapter_id:validateAdapterId(input.adapter_id);
    const adapter=resolveAdapter(adapterId);
    if(!adapter)throw new Error('Adapter V2 não registrado.');
    const next:RoutingV2Provider={
      ...current,
      name:input.name===undefined?current.name:String(input.name).trim()||current.name,
      slug:input.name===undefined?current.slug:slugify(String(input.name))||current.slug,
      status:input.status??current.status,
      priority:input.priority===undefined?current.priority:Number(input.priority),
      adapter_id:adapterId,
      secret_reference:input.secret_reference===undefined?current.secret_reference:(input.secret_reference?.trim()||null),
      supports_catalog_sync:Boolean(adapter.listModels),
      supports_pricing_sync:Boolean(adapter.getPrice),
      supports_balance:Boolean(adapter.balance),
      updated_at:now(),
    };
    if(!Number.isFinite(next.priority))throw new Error('Prioridade do provider é inválida.');
    return routingV2Repository.saveProvider(next);
  },

  async disable(providerId:string){
    return this.update(providerId,{status:'DISABLED'});
  },
};

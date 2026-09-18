import { routingV2Repository } from './repository.js';
import { RoutingV2Provider, RoutingV2ProviderStatus, RoutingV2ProviderType } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';

const now=()=>new Date().toISOString();
const slugify=(value:string)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export interface CreateRoutingV2ProviderInput{
  provider_id:string;
  name:string;
  type:RoutingV2ProviderType;
  adapter_id:string;
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

function validateId(value:string,label:string){
  const id=String(value||'').trim();
  if(!id)throw new Error(`${label} é obrigatório.`);
  if(!/^[a-zA-Z0-9._-]+$/.test(id))throw new Error(`${label} contém caracteres inválidos.`);
  return id;
}

export const routingV2ProviderService={
  async list(){
    return routingV2Repository.listProviders();
  },

  async get(providerId:string){
    return routingV2Repository.getProvider(providerId);
  },

  async create(input:CreateRoutingV2ProviderInput){
    const providerId=validateId(input.provider_id,'provider_id');
    const name=String(input.name||'').trim();
    const adapterId=validateId(input.adapter_id,'adapter_id');
    if(!name)throw new Error('Nome do provider é obrigatório.');
    if(await routingV2Repository.getProvider(providerId))throw new Error('Provider V2 já existe.');
    const adapter=routingV2AdapterRegistry.get(adapterId);
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
    const adapterId=input.adapter_id===undefined?current.adapter_id:validateId(input.adapter_id,'adapter_id');
    const adapter=routingV2AdapterRegistry.get(adapterId);
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

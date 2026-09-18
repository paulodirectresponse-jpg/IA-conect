import { RoutingV2BillingConfig, RoutingV2Currency, RoutingV2RuntimeStatus } from './domain.js';

export interface RoutingV2ProviderHealth{
  status:RoutingV2RuntimeStatus;
  checked_at:string;
  detail?:string|null;
}

export interface RoutingV2ProviderBalance{
  amount:number|null;
  currency:RoutingV2Currency|null;
  checked_at:string;
}

export interface RoutingV2CatalogModel{
  provider_model_identifier:string;
  name:string;
  description?:string|null;
  metadata?:Record<string,unknown>;
}

export interface RoutingV2PriceResult{
  billing_config:RoutingV2BillingConfig;
  fetched_at:string;
  source_reference?:string|null;
}

export interface RoutingV2PriceRequest{
  provider_model_identifier:string;
  capability_id:string;
  billing_config:RoutingV2BillingConfig;
}

export interface RoutingV2ProviderAdapter{
  readonly adapterId:string;
  readonly name:string;
  isConfigured():boolean;
  health?():Promise<RoutingV2ProviderHealth>;
  balance?():Promise<RoutingV2ProviderBalance>;
  listModels?(query?:string):Promise<RoutingV2CatalogModel[]>;
  fetchPrice?(request:RoutingV2PriceRequest):Promise<RoutingV2PriceResult>;
}

class RoutingV2AdapterRegistry{
  private adapters=new Map<string,RoutingV2ProviderAdapter>();

  register(adapter:RoutingV2ProviderAdapter){
    const id=String(adapter.adapterId||'').trim();
    if(!id)throw new Error('Adapter V2 exige adapterId.');
    if(this.adapters.has(id))throw new Error(`Adapter V2 duplicado: ${id}.`);
    this.adapters.set(id,adapter);
    return adapter;
  }

  get(adapterId:string){
    return this.adapters.get(String(adapterId||'').trim())||null;
  }

  has(adapterId:string){
    return this.adapters.has(String(adapterId||'').trim());
  }

  list(){
    return Array.from(this.adapters.values());
  }

  clearForTests(){
    this.adapters.clear();
  }
}

export const routingV2AdapterRegistry=new RoutingV2AdapterRegistry();

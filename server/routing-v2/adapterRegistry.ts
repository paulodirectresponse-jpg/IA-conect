import { RoutingV2ProviderAdapter } from './adapter.js';

class RoutingV2AdapterRegistry{
  private adapters=new Map<string,RoutingV2ProviderAdapter>();

  register(adapter:RoutingV2ProviderAdapter){
    const id=String(adapter.adapter_id||'').trim();
    if(!id)throw new Error('Adapter V2 exige adapter_id.');
    if(this.adapters.has(id))throw new Error(`Adapter V2 já registrado: ${id}`);
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

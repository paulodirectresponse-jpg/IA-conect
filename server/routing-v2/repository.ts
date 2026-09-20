import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import {
  RoutingV2Model,
  RoutingV2PricingSettings,
  RoutingV2Provider,
  RoutingV2ProviderRoute,
  assertRoutingV2Route,
} from './domain.js';

function namespace(){
  const value=String(process.env.ROUTING_V2_NAMESPACE||'').trim().toLowerCase();
  if(!value)return'';
  if(!/^[a-z0-9_-]{1,32}$/.test(value))throw new Error('ROUTING_V2_NAMESPACE inválido.');
  return`${value}_`;
}
const names=()=>({
  providers:`${namespace()}routing_v2_providers`,
  models:`${namespace()}routing_v2_models`,
  routes:`${namespace()}routing_v2_routes`,
  settings:`${namespace()}routing_v2_pricing_settings`,
  runtime:`${namespace()}routing_v2_runtime_state`,
});
const safe=(value:string)=>encodeURIComponent(String(value).trim());

async function listCollection<T>(collectionId:string,limit=500):Promise<T[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId}],limit:Math.min(500,Math.max(1,limit))});
  return rows.map(row=>row.data as T);
}

export const routingV2Repository={
  get collections(){const current=names();return{providers:current.providers,models:current.models,routes:current.routes,settings:current.settings};},

  async getProvider(providerId:string):Promise<RoutingV2Provider|null>{
    const row=await firestoreAdminRest.get(`${names().providers}/${safe(providerId)}`);
    return row.exists?row.data as RoutingV2Provider:null;
  },

  async listProviders():Promise<RoutingV2Provider[]>{
    return listCollection<RoutingV2Provider>(names().providers);
  },

  async saveProvider(provider:RoutingV2Provider){
    await firestoreAdminRest.set(`${names().providers}/${safe(provider.provider_id)}`,provider);
    return provider;
  },

  async getModel(modelId:string):Promise<RoutingV2Model|null>{
    const row=await firestoreAdminRest.get(`${names().models}/${safe(modelId)}`);
    return row.exists?row.data as RoutingV2Model:null;
  },

  async listModels():Promise<RoutingV2Model[]>{
    return listCollection<RoutingV2Model>(names().models);
  },

  async saveModel(model:RoutingV2Model){
    await firestoreAdminRest.set(`${names().models}/${safe(model.model_id)}`,model);
    return model;
  },

  async getRoute(routeId:string):Promise<RoutingV2ProviderRoute|null>{
    const row=await firestoreAdminRest.get(`${names().routes}/${safe(routeId)}`);
    return row.exists?row.data as RoutingV2ProviderRoute:null;
  },

  async listRoutes():Promise<RoutingV2ProviderRoute[]>{
    return listCollection<RoutingV2ProviderRoute>(names().routes);
  },

  async saveRoute(route:RoutingV2ProviderRoute){
    assertRoutingV2Route(route);
    await firestoreAdminRest.set(`${names().routes}/${safe(route.route_id)}`,route);
    return route;
  },

  async getCutoverState():Promise<{mode:'HYBRID'|'V2_ONLY';updated_at:string;updated_by?:string|null}>{
    const row=await firestoreAdminRest.get(`${names().runtime}/cutover`);
    if(row.exists&&['HYBRID','V2_ONLY'].includes(String(row.data?.mode||''))){
      return{mode:row.data!.mode as 'HYBRID'|'V2_ONLY',updated_at:String(row.data?.updated_at||new Date(0).toISOString()),updated_by:row.data?.updated_by||null};
    }
    return{mode:'HYBRID',updated_at:new Date(0).toISOString(),updated_by:null};
  },

  async saveCutoverState(state:{mode:'HYBRID'|'V2_ONLY';updated_at:string;updated_by?:string|null}){
    await firestoreAdminRest.set(`${names().runtime}/cutover`,state);
    return state;
  },

  async getPriceSyncCursor():Promise<number>{
    const row=await firestoreAdminRest.get(`${names().runtime}/price_sync`);
    const cursor=row.exists?Number(row.data?.cursor||0):0;
    return Number.isFinite(cursor)&&cursor>=0?Math.floor(cursor):0;
  },

  async savePriceSyncCursor(cursor:number){
    const normalized=Number.isFinite(cursor)&&cursor>=0?Math.floor(cursor):0;
    await firestoreAdminRest.set(`${names().runtime}/price_sync`,{cursor:normalized,updated_at:new Date().toISOString()});
    return normalized;
  },

  async getPricingSettings():Promise<RoutingV2PricingSettings|null>{
    const row=await firestoreAdminRest.get(`${names().settings}/default`);
    return row.exists?row.data as RoutingV2PricingSettings:null;
  },

  async savePricingSettings(settings:RoutingV2PricingSettings){
    await firestoreAdminRest.set(`${names().settings}/default`,settings);
    return settings;
  },

  async resetInventoryForPreview(){
    if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true'){
      throw Object.assign(new Error('Reset do Routing V2 só é permitido no preview isolado.'),{code:'ROUTING_V2_RESET_PREVIEW_ONLY'});
    }
    const[providers,models,routes]=await Promise.all([
      this.listProviders(),this.listModels(),this.listRoutes(),
    ]);
    if(!namespace())throw Object.assign(new Error('Reset exige namespace isolado.'),{code:'ROUTING_V2_RESET_NAMESPACE_REQUIRED'});
    const current=names();
    const deletes=[
      ...providers.map(row=>`${current.providers}/${safe(row.provider_id)}`),
      ...models.map(row=>`${current.models}/${safe(row.model_id)}`),
      ...routes.map(row=>`${current.routes}/${safe(row.route_id)}`),
      `${current.settings}/default`,
      `${current.runtime}/price_sync`,
      `${current.runtime}/cutover`,
    ];
    const chunkSize=100;
    for(let i=0;i<deletes.length;i+=chunkSize){
      const chunk=deletes.slice(i,i+chunkSize);
      await firestoreAdminRest.commit(chunk.map(path=>({delete:firestoreAdminRest.docName(path)})));
    }
    const state={mode:'HYBRID' as const,updated_at:new Date().toISOString(),updated_by:'preview-reset'};
    await this.saveCutoverState(state);
    return{
      deleted:{providers:providers.length,models:models.length,routes:routes.length},
      cutover:state,
    };
  },
};

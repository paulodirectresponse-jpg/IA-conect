import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import {
  RoutingV2Model,
  RoutingV2PricingSettings,
  RoutingV2Provider,
  RoutingV2ProviderRoute,
  assertRoutingV2Route,
} from './domain.js';

const COLLECTIONS={
  providers:'routing_v2_providers',
  models:'routing_v2_models',
  routes:'routing_v2_routes',
  settings:'routing_v2_pricing_settings',
} as const;

const RUNTIME_STATE='routing_v2_runtime_state';
const safe=(value:string)=>encodeURIComponent(String(value).trim());

async function listCollection<T>(collectionId:string,limit=500):Promise<T[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId}],limit:Math.min(500,Math.max(1,limit))});
  return rows.map(row=>row.data as T);
}

export const routingV2Repository={
  collections:COLLECTIONS,

  async getProvider(providerId:string):Promise<RoutingV2Provider|null>{
    const row=await firestoreAdminRest.get(`${COLLECTIONS.providers}/${safe(providerId)}`);
    return row.exists?row.data as RoutingV2Provider:null;
  },

  async listProviders():Promise<RoutingV2Provider[]>{
    return listCollection<RoutingV2Provider>(COLLECTIONS.providers);
  },

  async saveProvider(provider:RoutingV2Provider){
    await firestoreAdminRest.set(`${COLLECTIONS.providers}/${safe(provider.provider_id)}`,provider);
    return provider;
  },

  async getModel(modelId:string):Promise<RoutingV2Model|null>{
    const row=await firestoreAdminRest.get(`${COLLECTIONS.models}/${safe(modelId)}`);
    return row.exists?row.data as RoutingV2Model:null;
  },

  async listModels():Promise<RoutingV2Model[]>{
    return listCollection<RoutingV2Model>(COLLECTIONS.models);
  },

  async saveModel(model:RoutingV2Model){
    await firestoreAdminRest.set(`${COLLECTIONS.models}/${safe(model.model_id)}`,model);
    return model;
  },

  async getRoute(routeId:string):Promise<RoutingV2ProviderRoute|null>{
    const row=await firestoreAdminRest.get(`${COLLECTIONS.routes}/${safe(routeId)}`);
    return row.exists?row.data as RoutingV2ProviderRoute:null;
  },

  async listRoutes():Promise<RoutingV2ProviderRoute[]>{
    return listCollection<RoutingV2ProviderRoute>(COLLECTIONS.routes);
  },

  async saveRoute(route:RoutingV2ProviderRoute){
    assertRoutingV2Route(route);
    await firestoreAdminRest.set(`${COLLECTIONS.routes}/${safe(route.route_id)}`,route);
    return route;
  },

  async getPriceSyncCursor():Promise<number>{
    const row=await firestoreAdminRest.get(`${RUNTIME_STATE}/price_sync`);
    const cursor=row.exists?Number(row.data?.cursor||0):0;
    return Number.isFinite(cursor)&&cursor>=0?Math.floor(cursor):0;
  },

  async savePriceSyncCursor(cursor:number){
    const normalized=Number.isFinite(cursor)&&cursor>=0?Math.floor(cursor):0;
    await firestoreAdminRest.set(`${RUNTIME_STATE}/price_sync`,{cursor:normalized,updated_at:new Date().toISOString()});
    return normalized;
  },

  async getPricingSettings():Promise<RoutingV2PricingSettings|null>{
    const row=await firestoreAdminRest.get(`${COLLECTIONS.settings}/default`);
    return row.exists?row.data as RoutingV2PricingSettings:null;
  },

  async savePricingSettings(settings:RoutingV2PricingSettings){
    await firestoreAdminRest.set(`${COLLECTIONS.settings}/default`,settings);
    return settings;
  },
};

import { apiRequest } from './apiClient.js';

export type RoutingV2ProviderType='AGGREGATOR'|'OFFICIAL';
export type RoutingV2ProviderStatus='ACTIVE'|'DEGRADED'|'DISABLED';
export type RoutingV2RuntimeStatus='UNKNOWN'|'HEALTHY'|'DEGRADED'|'UNAVAILABLE';
export type RoutingV2RouteStatus='DISCOVERED'|'MAPPED'|'PRICED'|'READY'|'DEGRADED'|'DISABLED';
export type RoutingV2PricingStatus='UNKNOWN'|'CURRENT'|'STALE'|'INVALID';
export type RoutingV2BillingType='PER_GENERATION'|'PER_OUTPUT'|'PER_SECOND'|'PER_MINUTE'|'PER_CHARACTER'|'FIXED_MATRIX'|'CUSTOM_FORMULA';

export interface RoutingV2ProviderAdmin{
  provider_id:string;name:string;slug:string;type:RoutingV2ProviderType;status:RoutingV2ProviderStatus;priority:number;adapter_id:string;
  secret_reference?:string|null;supports_catalog_sync:boolean;supports_pricing_sync:boolean;supports_balance:boolean;
  balance_amount?:number|null;balance_currency?:'USD'|'BRL'|null;balance_updated_at?:string|null;
  health_status:RoutingV2RuntimeStatus;last_health_check_at?:string|null;created_at:string;updated_at:string;
}
export interface RoutingV2ModelAdmin{
  model_id:string;name:string;slug:string;vendor:string;category:'VIDEO'|'IMAGE'|'AUDIO'|'MODEL_3D'|'OTHER';description:string;
  capabilities:string[];supported_controls?:Record<string,unknown>;status:'ACTIVE'|'DISABLED';created_at:string;updated_at:string;
}
export interface RoutingV2RouteAdmin{
  route_id:string;model_id:string;capability_id:string;provider_id:string;provider_model_identifier:string;
  status:RoutingV2RouteStatus;pricing_status:RoutingV2PricingStatus;runtime_status:RoutingV2RuntimeStatus;
  billing_type:RoutingV2BillingType;billing_config:any;pricing_snapshot?:{provider_cost_reference:number;safe_cogs_brl:number|null;retail_price_credits:number|null;expected_margin_percent:number|null;fetched_at:string;valid_until:string}|null;
  priority:number;last_price_sync_at?:string|null;last_runtime_check_at?:string|null;created_at:string;updated_at:string;
}
export interface RoutingV2CatalogModelAdmin{provider_model_identifier:string;name:string;vendor?:string|null;capabilities?:string[];metadata?:Record<string,unknown>;}
export interface RoutingV2UnifiedCatalogProviderAdmin{provider_id:string;provider_name:string;provider_model_identifier:string;capabilities:string[];metadata?:Record<string,unknown>;}
export interface RoutingV2UnifiedCatalogModelAdmin{catalog_key:string;name:string;vendor:string;capabilities:string[];providers:RoutingV2UnifiedCatalogProviderAdmin[];}
export interface RoutingV2UnifiedCatalogDiagnosticAdmin{provider_id:string;provider_name:string;status:'OK'|'ERROR';count:number;attempts?:number;message?:string;}
export interface RoutingV2UnifiedCatalogResponseAdmin{rows:RoutingV2UnifiedCatalogModelAdmin[];failures:Array<{provider_id:string;message:string}>;provider_diagnostics:RoutingV2UnifiedCatalogDiagnosticAdmin[];}
export interface RoutingV2BulkImportResultAdmin{created_models:string[];existing_models:string[];created_routes:string[];skipped_routes:string[];failed:Array<{model_id:string;error:string}>;}
export interface RoutingV2PricingSettingsAdmin{target_margin_percent:number;safety_buffer_percent:number;reference_credit_value_brl:number;price_sync_interval_minutes:number;price_freshness_ttl_minutes:number;stale_grace_minutes:number;updated_at:string;}
export interface RoutingV2ReadinessAdmin{
  checked_at:string;
  v2:{models:number;active_models:number;routes:number;ready_routes:number};
  coverage:{required_model_capabilities:number;ready_model_capabilities:number;missing:Array<{model_id:string;capability_id:string}>};
}
export interface RoutingV2CutoverAdmin{
  mode:'HYBRID'|'V2_ONLY';updated_at:string;updated_by?:string|null;
  readiness:RoutingV2ReadinessAdmin['coverage'];
}
export interface RoutingV2HealthAdmin{
  checked_at:string;
  providers:{total:number;active:number;healthy:number;rows:RoutingV2ProviderAdmin[]};
  models:{total:number;active:number};
  routes:{total:number;ready:number;degraded:number;stale:number;disabled:number};
  pricing:{price_sync_interval_minutes:number;price_freshness_ttl_minutes:number};
}

const post=<T>(url:string,body:any={})=>apiRequest<T>(url,{method:'POST',body:JSON.stringify(body)});
const patch=<T>(url:string,body:any)=>apiRequest<T>(url,{method:'PATCH',body:JSON.stringify(body)});

export const routingV2AdminService={
  listProviders:()=>apiRequest<RoutingV2ProviderAdmin[]>('/api/admin/routing-v2/providers'),
  createProvider:(data:any)=>post<RoutingV2ProviderAdmin>('/api/admin/routing-v2/providers',data),
  bootstrapCoreProviders:()=>post<{created:string[];existing:string[];failed:Array<{provider_id:string;error:string}>}>('/api/admin/routing-v2/providers/bootstrap-core'),
  updateProvider:(id:string,data:any)=>patch<RoutingV2ProviderAdmin>(`/api/admin/routing-v2/providers/${encodeURIComponent(id)}`,data),
  disableProvider:(id:string)=>post<RoutingV2ProviderAdmin>(`/api/admin/routing-v2/providers/${encodeURIComponent(id)}/disable`),
  searchProviderModels:(id:string,q='')=>apiRequest<RoutingV2CatalogModelAdmin[]>(`/api/admin/routing-v2/providers/${encodeURIComponent(id)}/catalog-models?q=${encodeURIComponent(q)}`),
  searchUnifiedCatalog:(q='')=>apiRequest<RoutingV2UnifiedCatalogResponseAdmin>(`/api/admin/routing-v2/catalog-unified?q=${encodeURIComponent(q)}`),

  listModels:()=>apiRequest<RoutingV2ModelAdmin[]>('/api/admin/routing-v2/models'),
  createModel:(data:any)=>post<RoutingV2ModelAdmin>('/api/admin/routing-v2/models',data),
  bulkImportModels:(items:any[])=>post<RoutingV2BulkImportResultAdmin>('/api/admin/routing-v2/models/bulk-import',{items}),
  setModelCapabilities:(id:string,capabilities:string[])=>patch<RoutingV2ModelAdmin>(`/api/admin/routing-v2/models/${encodeURIComponent(id)}/capabilities`,{capabilities}),
  disableModel:(id:string)=>post<RoutingV2ModelAdmin>(`/api/admin/routing-v2/models/${encodeURIComponent(id)}/disable`),

  listRoutes:()=>apiRequest<RoutingV2RouteAdmin[]>('/api/admin/routing-v2/routes'),
  createRoute:(data:any)=>post<RoutingV2RouteAdmin>('/api/admin/routing-v2/routes',data),
  updateRoute:(id:string,data:any)=>patch<RoutingV2RouteAdmin>(`/api/admin/routing-v2/routes/${encodeURIComponent(id)}`,data),
  disableRoute:(id:string)=>post<RoutingV2RouteAdmin>(`/api/admin/routing-v2/routes/${encodeURIComponent(id)}/disable`),

  getPricingSettings:()=>apiRequest<RoutingV2PricingSettingsAdmin>('/api/admin/routing-v2/pricing/settings'),
  savePricingSettings:(data:Partial<RoutingV2PricingSettingsAdmin>)=>post<RoutingV2PricingSettingsAdmin>('/api/admin/routing-v2/pricing/settings',data),
  syncPricing:(cursor=0,limit=10)=>post<any>('/api/admin/routing-v2/pricing/sync',{cursor,limit}),
  operationalize:(cursor=0,limit=5)=>post<any>('/api/admin/routing-v2/operationalize',{cursor,limit}),
  getHealth:()=>apiRequest<RoutingV2HealthAdmin>('/api/admin/routing-v2/health'),
  getReadiness:()=>apiRequest<RoutingV2ReadinessAdmin>('/api/admin/routing-v2/readiness'),
  resetPreview:()=>post<any>('/api/admin/routing-v2/reset-preview',{confirm:'RESET_ROUTING_V2_PREVIEW'}),
  getCutover:()=>apiRequest<RoutingV2CutoverAdmin>('/api/admin/routing-v2/cutover'),
  setCutover:(mode:'HYBRID'|'V2_ONLY')=>post<RoutingV2CutoverAdmin>('/api/admin/routing-v2/cutover',{mode}),
};

import { apiRequest } from './apiClient.js';
import { UserProfile, ModelRegistryItem, ProviderRegistryItem, ProviderModelMapping, PromotionEntry, FeatureFlag, AuditLog } from '../types/index.js';
import { CreditAccount, CreditTransaction } from '../types/credits.js';

export interface SystemHealthSnapshot {status:'OK'|'DEGRADED'|'ERROR';checked_at:string;checks:Array<{key:string;label:string;status:'OK'|'DEGRADED'|'ERROR';detail:string}>;}
export interface ProviderFinanceSnapshot {provider_id:string;provider_name:string;configured:boolean;balance_usd:number|null;balance_brl_cents:number|null;fx_rate_usd_brl:number;low_balance_threshold_brl_cents:number;low_balance:boolean;status:'OPERATIONAL'|'LOW_BALANCE'|'UNAVAILABLE'|'NOT_CONFIGURED';fetched_at:string;source:'LIVE_API'|'UNAVAILABLE';error?:string;}
export interface ProviderScanCandidate {provider_id:string;provider_model_identifier:string;name:string;category?:string|null;capabilities?:string[];pricing?:unknown;metadata?:Record<string,unknown>;}
export type CuratedModelFunction='IMAGE_GENERATION'|'IMAGE_EDIT'|'VIDEO_GENERATION'|'VIDEO_EDIT'|'VIDEO_EXTEND'|'VOICE'|'MUSIC'|'SFX'|'THREE_D';
export interface ProviderModelMatchProposal {provider_id:string;model_id:string;model_name:string;function_id:CuratedModelFunction;capability_id:string;provider_model_identifier:string;candidate_name:string;confidence:number;match_reason:string;already_mapped:boolean;provider_pricing_metadata?:unknown;}
export interface ProviderScanResult {scan_id:string;provider_id:string;provider_name:string;configured:boolean;discovery_mode:'CATALOG_API'|'SEARCH_API'|'CURATED_REQUIRED';candidate_count:number;candidate_sample_count:number;candidates:ProviderScanCandidate[];matched_count:number;matches:ProviderModelMatchProposal[];pricing_synced_count?:number;pricing_metadata_count?:number;pricing_sync_error?:string|null;warning?:string|null;error?:string|null;scanned_at:string;}
export interface ProviderPricingAdmin {pricing_id:string;provider_id:string;provider_model_identifier:string;capability_id?:string|null;unit:'REQUEST'|'OUTPUT'|'SECOND'|'MINUTE'|'CHARACTER';unit_price_usd:number;minimum_usd?:number|null;resolution_prices_usd?:Record<string,number>;verified:boolean;source:'LIVE_CATALOG'|'PROVIDER_DOCS'|'MANUAL_VERIFIED';quote_mode?:'STATIC_RULE'|'LIVE_PROVIDER';base_price_usd?:number|null;verified_at:string;updated_at:string;}
export interface CuratedModelInventoryItem {model_id:string;name:string;function_id:CuratedModelFunction;category:string;aliases:string[];status:'EXISTING'|'PLANNED';}
export interface CuratedModelInventory {total_positions:number;counts:Record<CuratedModelFunction,number>;models:CuratedModelInventoryItem[];}
export interface VerifiedLaunchRouteAdmin {
  key:string;label:string;media:'VOICE'|'MUSIC'|'THREE_D';model_id:string;model_name:string;
  provider_id:string;provider_name:string;provider_model_identifier:string;capability_ids:string[];
  pricing_label:string;source_url:string;provider_ready:boolean;mapping_ready:boolean;pricing_ready:boolean;policy_ready:boolean;model_ready:boolean;ready:boolean;
}
export interface PricingSettings { gross_margin_percent:number; target_margin_percent?:number; normal_floor_margin_percent?:number; emergency_floor_margin_percent?:number; updated_at:string; updated_by?:string; }
export interface CouponAdminEntry {coupon_id:string;code:string;version:number;name:string;active:boolean;redemption_mode:'CHECKOUT'|'DIRECT_CREDIT';starts_at:string;expires_at:string|null;benefit_type:'BONUS_PERCENT'|'BONUS_FIXED'|'BRL_PERCENT'|'BRL_FIXED'|'DIRECT_CREDITS';benefit_value:number;eligible_pack_ids:string[];min_purchase_cents:number;max_purchase_cents:number|null;max_global_redemptions:number|null;max_redemptions_per_user:number;first_purchase_only:boolean;bonus_expires_days:number|null;budget_max_credits:number|null;campaign_id:string|null;created_at:string;created_by:string;notes:string;usage?:{reserved:number;redeemed:number;reversed:number;bonus_credits_committed:number};}
export interface EconomicCampaign {campaign_id:string;name:string;type:'BETA'|'FOUNDERS'|'COUPON'|'WELCOME'|'CREATOR'|'SUPPORT'|'OTHER';active:boolean;budget_credits:number|null;starts_at:string|null;ends_at:string|null;notes:string;created_at:string;created_by:string;updated_at:string;updated_by:string;}
export interface BetaCatalogAdminModel {model_id:string;name:string;category:string;status:string;capability_ids:string[];supported_capability_ids:string[];pricing_policy_id:string;enabled:boolean;eligible:boolean;auto_routing_enabled:boolean;quote_ttl_seconds:number;}
export interface BetaPricingPolicyAdmin {pricing_policy_id:string;name:string;quote_ttl_seconds:number;active:boolean;created_at:string;updated_at:string;updated_by?:string|null;}
export interface BetaEconomicLedgerAdmin {event_id:string;event_type:string;user_id:string;job_id:string;generation_id?:string|null;requested_model_id:string;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';pricing_policy_id:string;retail_pricing_id:string;pricing_signature_hash:string;credit_price:number;quote_expires_at:string;created_at:string;}
export interface StablePublicationStatus {model_id:string;name:string;status:string;beta_only:boolean;published:boolean;ready:boolean;supported_capability_ids:string[];ready_capability_ids:string[];missing_capability_ids:string[];ready_routes:number;}
export type PricingAuditStage='MODEL'|'CAPABILITY'|'MAPPING'|'PROVIDER'|'IDENTIFIER'|'PRICING'|'QUOTE'|'SMART_ROUTER'|'RETAIL_PRICING';
export interface PricingAuditAttempt {provider_id:string;provider_name:string;provider_model_identifier:string;provider_active:boolean;provider_configured:boolean;identifier_valid:boolean;pricing_verified:boolean;pricing_unit?:string|null;pricing_source?:string|null;quote_mode?:string|null;quote_ok:boolean;quote_error?:string|null;provider_cost_usd?:number|null;safe_cogs_cents?:number|null;smart_router_eligible:boolean;smart_router_reason?:string|null;}
export interface PricingAuditRow {model_id:string;model_name:string;category:string;capability_id:string;mode:string|null;price_available:boolean;failed_stage:PricingAuditStage|null;failure_reason:string|null;retail_pricing_id?:string|null;retail_credit_price?:number|null;retail_version?:number|null;attempts:PricingAuditAttempt[];}
export interface PricingAuditResult {checked_at:string;models_checked:number;routes_checked:number;missing_price_count:number;priced_count:number;stage_counts:Record<string,number>;rows:PricingAuditRow[];cursor:number;next_cursor:number|null;done:boolean;total_targets:number;}

const ADMIN_CACHE_TTL_MS=30*60*1000;
type CacheEntry<T=unknown>={expires:number;value?:T;promise?:Promise<T>};
const adminReadCache=new Map<string,CacheEntry<any>>();

function cachedGet<T>(url:string,force=false):Promise<T>{
 const now=Date.now(),existing=adminReadCache.get(url) as CacheEntry<T>|undefined;
 if(!force&&existing?.value!==undefined&&existing.expires>now)return Promise.resolve(existing.value);
 if(!force&&existing?.promise)return existing.promise;
 const promise=apiRequest<T>(url).then(value=>{adminReadCache.set(url,{value,expires:Date.now()+ADMIN_CACHE_TTL_MS});return value;},error=>{adminReadCache.delete(url);throw error;});
 adminReadCache.set(url,{promise,expires:now+ADMIN_CACHE_TTL_MS});
 return promise;
}
function remember<T>(url:string,value:T){adminReadCache.set(url,{value,expires:Date.now()+ADMIN_CACHE_TTL_MS});return value;}
export function invalidateAdminCache(){adminReadCache.clear();}
async function mutate<T>(url:string,init:any){const value=await apiRequest<T>(url,init);invalidateAdminCache();return value;}

export const adminService = {
  cacheTtlMs:ADMIN_CACHE_TTL_MS,
  invalidateCache:invalidateAdminCache,
  async getDashboardStats(){return cachedGet<any>('/api/admin/dashboard-stats');},
  async getSystemHealth(){return cachedGet<SystemHealthSnapshot>('/api/admin/system-health');},
  async listUsers(search='',limit=20,offset=0){const q=encodeURIComponent(search);return cachedGet<{users:UserProfile[];total:number}>(`/api/admin/users?search=${q}&limit=${limit}&offset=${offset}`);},
  async getUserDetails(userId:string){return cachedGet<{user:UserProfile;wallet:CreditAccount;recent_transactions:CreditTransaction[]}>(`/api/admin/users/${userId}`);},
  async updateUserStatus(userId:string,status:'ACTIVE'|'SUSPENDED',reason:string){return mutate<UserProfile>(`/api/admin/users/${userId}/status`,{method:'POST',body:JSON.stringify({status,reason})});},
  async adjustCredits(userId:string,type:'ADMIN_CREDIT'|'ADMIN_DEBIT',amount_credits:number,reason:string,idempotency_key?:string){return mutate<{account:CreditAccount}>(`/api/admin/users/${userId}/adjust-credits`,{method:'POST',body:JSON.stringify({type,amount_credits,reason,idempotency_key})});},
  async listModels(){return cachedGet<ModelRegistryItem[]>('/api/admin/models');},
  async listStablePublicationStatus(){return cachedGet<StablePublicationStatus[]>('/api/admin/models/publication-status');},
  async publishStableModel(modelId:string){return mutate<any>(`/api/admin/models/${encodeURIComponent(modelId)}/publish-stable`,{method:'POST',body:'{}'});},
  async publishStableModelsBulk(model_ids:string[]){return mutate<{published:any[]}>('/api/admin/models/publish-stable-bulk',{method:'POST',body:JSON.stringify({model_ids})});},
  async saveModel(data:Partial<ModelRegistryItem>){return mutate<ModelRegistryItem>('/api/admin/models',{method:'POST',body:JSON.stringify(data)});},
  async bulkAddCuratedModels(model_ids:string[]){return mutate<{added:Array<{model_id:string;name:string;status:string;beta_only:boolean}>;already_present:Array<{model_id:string;name:string}>;rejected:string[]}>('/api/admin/models/bulk-curated',{method:'POST',body:JSON.stringify({model_ids})});},
  async updateModel(modelId:string,data:Partial<ModelRegistryItem>){return mutate<ModelRegistryItem>(`/api/admin/models/${modelId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async listProviders(){return cachedGet<ProviderRegistryItem[]>('/api/catalog/providers');},
  async getProviderFinance(refresh=false){
    const base='/api/admin/provider-finance';
    if(!refresh)return cachedGet<{providers:ProviderFinanceSnapshot[];total_brl_cents:number;fx_rate_usd_brl:number;updated_at:string}>(base);
    const value=await apiRequest<{providers:ProviderFinanceSnapshot[];total_brl_cents:number;fx_rate_usd_brl:number;updated_at:string}>(`${base}?refresh=1`);
    return remember(base,value);
  },
  async getProviderScans(){return cachedGet<{latest:ProviderScanResult[];pricing:ProviderPricingAdmin[];mappings:ProviderModelMapping[]}>('/api/admin/provider-scan');},
  async getProviderScanInventory(){return cachedGet<CuratedModelInventory>('/api/admin/provider-scan/inventory');},
  async listVerifiedLaunchRoutes(){return cachedGet<VerifiedLaunchRouteAdmin[]>('/api/admin/provider-launch-routes');},
  async applyVerifiedLaunchRoute(routeKey:string){return mutate<any>(`/api/admin/provider-launch-routes/${encodeURIComponent(routeKey)}/apply`,{method:'POST',body:'{}'});},
  async scanProviders(provider_id?:string){return mutate<ProviderScanResult|ProviderScanResult[]>('/api/admin/provider-scan',{method:'POST',body:JSON.stringify(provider_id?{provider_id}:{})});},
  async saveProviderPricing(data:Partial<ProviderPricingAdmin>&Pick<ProviderPricingAdmin,'provider_id'|'provider_model_identifier'|'unit'|'unit_price_usd'>){return mutate<ProviderPricingAdmin>('/api/admin/provider-pricing',{method:'POST',body:JSON.stringify(data)});},
  async approveProviderMapping(data:{provider_id:string;model_id:string;provider_model_identifier:string;capability_id:string}){return mutate<{mapping:ProviderModelMapping;pricing:ProviderPricingAdmin;model_status:string;beta_only:boolean}>('/api/admin/provider-scan/approve-mapping',{method:'POST',body:JSON.stringify(data)});},
  async approveProviderMappingsBulk(items:Array<{provider_id:string;model_id:string;provider_model_identifier:string;capability_id:string}>){return mutate<{approved:Array<{mapping:ProviderModelMapping;pricing:ProviderPricingAdmin;policy:any;model_status:string;beta_only:boolean}>}>('/api/admin/provider-scan/approve-mappings-bulk',{method:'POST',body:JSON.stringify({items})});},
  async saveProvider(data:Partial<ProviderRegistryItem>){return mutate<ProviderRegistryItem>('/api/admin/providers',{method:'POST',body:JSON.stringify(data)});},
  async updateProvider(providerId:string,data:Partial<ProviderRegistryItem>){return mutate<ProviderRegistryItem>(`/api/admin/providers/${providerId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async getPricingSettings(){return cachedGet<PricingSettings>('/api/admin/pricing/settings');},
  async runPricingAudit(cursor=0,limit=2){return apiRequest<PricingAuditResult>('/api/admin/pricing/audit',{method:'POST',body:JSON.stringify({cursor,limit})});},
  async updatePricingSettings(gross_margin_percent:number){return mutate<{settings:PricingSettings;snapshot:any}>('/api/admin/pricing/settings',{method:'POST',body:JSON.stringify({gross_margin_percent})});},
  async listPromotions(){return cachedGet<PromotionEntry[]>('/api/catalog/promotions');},
  async savePromotion(data:Partial<PromotionEntry>){return mutate<PromotionEntry>('/api/admin/promotions',{method:'POST',body:JSON.stringify(data)});},
  async updatePromotion(promotionId:string,data:Partial<PromotionEntry>){return mutate<PromotionEntry>(`/api/admin/promotions/${promotionId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async listCoupons(){return cachedGet<CouponAdminEntry[]>('/api/admin/coupons');},
  async saveCoupon(data:any){return mutate<CouponAdminEntry>('/api/admin/coupons',{method:'POST',body:JSON.stringify(data)});},
  async setCouponStatus(code:string,active:boolean){return mutate<CouponAdminEntry>(`/api/admin/coupons/${encodeURIComponent(code)}/status`,{method:'POST',body:JSON.stringify({active})});},
  async getEconomicsOverview(range='30d'){return cachedGet<any>(`/api/admin/economics/overview?range=${encodeURIComponent(range)}`);},
  async getEconomicsGenerations(range='30d',limit=100){return cachedGet<any[]>(`/api/admin/economics/generations?range=${encodeURIComponent(range)}&limit=${limit}`);},
  async listEconomicCampaigns(){return cachedGet<EconomicCampaign[]>('/api/admin/economics/campaigns');},
  async saveEconomicCampaign(data:Partial<EconomicCampaign>){return mutate<EconomicCampaign>('/api/admin/economics/campaigns',{method:'POST',body:JSON.stringify(data)});},
  async listBetaCatalog(){return cachedGet<BetaCatalogAdminModel[]>('/api/admin/beta/catalog');},
  async listBetaPricingPolicies(){return cachedGet<BetaPricingPolicyAdmin[]>('/api/admin/beta/pricing-policies');},
  async saveBetaPricingPolicy(data:Partial<BetaPricingPolicyAdmin>&{reason?:string}){return mutate<BetaPricingPolicyAdmin>('/api/admin/beta/pricing-policies',{method:'POST',body:JSON.stringify(data)});},
  async updateBetaModelPolicy(modelId:string,data:{pricing_policy_id?:string;capability_ids?:string[];enabled?:boolean;auto_routing_enabled?:boolean;reason?:string}){return mutate<BetaCatalogAdminModel>(`/api/admin/beta/models/${encodeURIComponent(modelId)}/policy`,{method:'PATCH',body:JSON.stringify(data)});},
  async listBetaEconomicLedger(limit=100){return cachedGet<BetaEconomicLedgerAdmin[]>(`/api/admin/beta/economic-ledger?limit=${Math.min(500,Math.max(1,limit))}`);},
  async listFeatureFlags(){return cachedGet<FeatureFlag[]>('/api/admin/feature-flags');},
  async toggleFeatureFlag(flag_key:string,is_enabled:boolean,reason:string){return mutate<FeatureFlag>('/api/admin/feature-flags/toggle',{method:'POST',body:JSON.stringify({flag_key,is_enabled,reason})});},
  async listAuditLogs(entity_type='',limit=20,offset=0){const q=entity_type?`&entity_type=${encodeURIComponent(entity_type)}`:'';return cachedGet<{logs:AuditLog[];total:number}>(`/api/admin/audit-logs?limit=${limit}&offset=${offset}${q}`);},
};

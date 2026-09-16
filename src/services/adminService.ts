import { apiRequest } from './apiClient.js';
import { UserProfile, ModelRegistryItem, ProviderRegistryItem, PromotionEntry, FeatureFlag, AuditLog } from '../types/index.js';
import { CreditAccount, CreditTransaction } from '../types/credits.js';

export interface SystemHealthSnapshot {status:'OK'|'DEGRADED'|'ERROR';checked_at:string;checks:Array<{key:string;label:string;status:'OK'|'DEGRADED'|'ERROR';detail:string}>;}
export interface ProviderFinanceSnapshot {provider_id:'provider-atlas'|'provider-wavespeed';provider_name:string;configured:boolean;balance_usd:number|null;balance_brl_cents:number|null;fx_rate_usd_brl:number;low_balance_threshold_brl_cents:number;low_balance:boolean;status:'OPERATIONAL'|'LOW_BALANCE'|'UNAVAILABLE'|'NOT_CONFIGURED';fetched_at:string;source:'LIVE_API'|'UNAVAILABLE';error?:string;}
export interface PricingSettings { gross_margin_percent:number; target_margin_percent?:number; normal_floor_margin_percent?:number; emergency_floor_margin_percent?:number; updated_at:string; updated_by?:string; }
export interface CouponAdminEntry {coupon_id:string;code:string;version:number;name:string;active:boolean;redemption_mode:'CHECKOUT'|'DIRECT_CREDIT';starts_at:string;expires_at:string|null;benefit_type:'BONUS_PERCENT'|'BONUS_FIXED'|'BRL_PERCENT'|'BRL_FIXED'|'DIRECT_CREDITS';benefit_value:number;eligible_pack_ids:string[];min_purchase_cents:number;max_purchase_cents:number|null;max_global_redemptions:number|null;max_redemptions_per_user:number;first_purchase_only:boolean;bonus_expires_days:number|null;budget_max_credits:number|null;campaign_id:string|null;created_at:string;created_by:string;notes:string;usage?:{reserved:number;redeemed:number;reversed:number;bonus_credits_committed:number};}
export interface EconomicCampaign {campaign_id:string;name:string;type:'BETA'|'FOUNDERS'|'COUPON'|'WELCOME'|'CREATOR'|'SUPPORT'|'OTHER';active:boolean;budget_credits:number|null;starts_at:string|null;ends_at:string|null;notes:string;created_at:string;created_by:string;updated_at:string;updated_by:string;}
export interface BetaCatalogAdminModel {model_id:string;name:string;category:string;status:string;capability_ids:string[];supported_capability_ids:string[];pricing_policy_id:string;enabled:boolean;eligible:boolean;auto_routing_enabled:boolean;quote_ttl_seconds:number;}
export interface BetaPricingPolicyAdmin {pricing_policy_id:string;name:string;quote_ttl_seconds:number;active:boolean;created_at:string;updated_at:string;updated_by?:string|null;}
export interface BetaEconomicLedgerAdmin {event_id:string;event_type:string;user_id:string;job_id:string;generation_id?:string|null;requested_model_id:string;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';pricing_policy_id:string;retail_pricing_id:string;pricing_signature_hash:string;credit_price:number;quote_expires_at:string;created_at:string;}

export const adminService = {
  async getDashboardStats(){return apiRequest<any>('/api/admin/dashboard-stats');},
  async getSystemHealth(){return apiRequest<SystemHealthSnapshot>('/api/admin/system-health');},
  async listUsers(search='',limit=20,offset=0){const q=encodeURIComponent(search);return apiRequest<{users:UserProfile[];total:number}>(`/api/admin/users?search=${q}&limit=${limit}&offset=${offset}`);},
  async getUserDetails(userId:string){return apiRequest<{user:UserProfile;wallet:CreditAccount;recent_transactions:CreditTransaction[]}>(`/api/admin/users/${userId}`);},
  async updateUserStatus(userId:string,status:'ACTIVE'|'SUSPENDED',reason:string){return apiRequest<UserProfile>(`/api/admin/users/${userId}/status`,{method:'POST',body:JSON.stringify({status,reason})});},
  async adjustCredits(userId:string,type:'ADMIN_CREDIT'|'ADMIN_DEBIT',amount_credits:number,reason:string,idempotency_key?:string){return apiRequest<{account:CreditAccount}>(`/api/admin/users/${userId}/adjust-credits`,{method:'POST',body:JSON.stringify({type,amount_credits,reason,idempotency_key})});},
  async listModels(){return apiRequest<ModelRegistryItem[]>('/api/catalog/models');},
  async saveModel(data:Partial<ModelRegistryItem>){return apiRequest<ModelRegistryItem>('/api/admin/models',{method:'POST',body:JSON.stringify(data)});},
  async updateModel(modelId:string,data:Partial<ModelRegistryItem>){return apiRequest<ModelRegistryItem>(`/api/admin/models/${modelId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async listProviders(){return apiRequest<ProviderRegistryItem[]>('/api/catalog/providers');},
  async getProviderFinance(refresh=false){return apiRequest<{providers:ProviderFinanceSnapshot[];total_brl_cents:number;fx_rate_usd_brl:number;updated_at:string}>(`/api/admin/provider-finance${refresh?'?refresh=1':''}`);},
  async saveProvider(data:Partial<ProviderRegistryItem>){return apiRequest<ProviderRegistryItem>('/api/admin/providers',{method:'POST',body:JSON.stringify(data)});},
  async updateProvider(providerId:string,data:Partial<ProviderRegistryItem>){return apiRequest<ProviderRegistryItem>(`/api/admin/providers/${providerId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async getPricingSettings(){return apiRequest<PricingSettings>('/api/admin/pricing/settings');},
  async updatePricingSettings(gross_margin_percent:number){return apiRequest<{settings:PricingSettings;snapshot:any}>('/api/admin/pricing/settings',{method:'POST',body:JSON.stringify({gross_margin_percent})});},
  async listPromotions(){return apiRequest<PromotionEntry[]>('/api/catalog/promotions');},
  async savePromotion(data:Partial<PromotionEntry>){return apiRequest<PromotionEntry>('/api/admin/promotions',{method:'POST',body:JSON.stringify(data)});},
  async updatePromotion(promotionId:string,data:Partial<PromotionEntry>){return apiRequest<PromotionEntry>(`/api/admin/promotions/${promotionId}`,{method:'PATCH',body:JSON.stringify(data)});},
  async listCoupons(){return apiRequest<CouponAdminEntry[]>('/api/admin/coupons');},
  async saveCoupon(data:any){return apiRequest<CouponAdminEntry>('/api/admin/coupons',{method:'POST',body:JSON.stringify(data)});},
  async setCouponStatus(code:string,active:boolean){return apiRequest<CouponAdminEntry>(`/api/admin/coupons/${encodeURIComponent(code)}/status`,{method:'POST',body:JSON.stringify({active})});},
  async getEconomicsOverview(range='30d'){return apiRequest<any>(`/api/admin/economics/overview?range=${encodeURIComponent(range)}`);},
  async getEconomicsGenerations(range='30d',limit=100){return apiRequest<any[]>(`/api/admin/economics/generations?range=${encodeURIComponent(range)}&limit=${limit}`);},
  async listEconomicCampaigns(){return apiRequest<EconomicCampaign[]>('/api/admin/economics/campaigns');},
  async saveEconomicCampaign(data:Partial<EconomicCampaign>){return apiRequest<EconomicCampaign>('/api/admin/economics/campaigns',{method:'POST',body:JSON.stringify(data)});},
  async listBetaCatalog(){return apiRequest<BetaCatalogAdminModel[]>('/api/admin/beta/catalog');},
  async listBetaPricingPolicies(){return apiRequest<BetaPricingPolicyAdmin[]>('/api/admin/beta/pricing-policies');},
  async saveBetaPricingPolicy(data:Partial<BetaPricingPolicyAdmin>&{reason?:string}){return apiRequest<BetaPricingPolicyAdmin>('/api/admin/beta/pricing-policies',{method:'POST',body:JSON.stringify(data)});},
  async updateBetaModelPolicy(modelId:string,data:{pricing_policy_id?:string;capability_ids?:string[];enabled?:boolean;auto_routing_enabled?:boolean;reason?:string}){return apiRequest<BetaCatalogAdminModel>(`/api/admin/beta/models/${encodeURIComponent(modelId)}/policy`,{method:'PATCH',body:JSON.stringify(data)});},
  async listBetaEconomicLedger(limit=100){return apiRequest<BetaEconomicLedgerAdmin[]>(`/api/admin/beta/economic-ledger?limit=${Math.min(500,Math.max(1,limit))}`);},
  async listFeatureFlags(){return apiRequest<FeatureFlag[]>('/api/admin/feature-flags');},
  async toggleFeatureFlag(flag_key:string,is_enabled:boolean,reason:string){return apiRequest<FeatureFlag>('/api/admin/feature-flags/toggle',{method:'POST',body:JSON.stringify({flag_key,is_enabled,reason})});},
  async listAuditLogs(entity_type='',limit=20,offset=0){const q=entity_type?`&entity_type=${encodeURIComponent(entity_type)}`:'';return apiRequest<{logs:AuditLog[];total:number}>(`/api/admin/audit-logs?limit=${limit}&offset=${offset}${q}`);},
};

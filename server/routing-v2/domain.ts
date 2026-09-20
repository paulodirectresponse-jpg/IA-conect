import { CapabilityId } from '../beta/capabilityRegistry.js';
import { ModelCategory } from '../../src/types/index.js';

export type RoutingV2ProviderType='AGGREGATOR'|'OFFICIAL';
export type RoutingV2ProviderStatus='ACTIVE'|'DEGRADED'|'DISABLED';
export type RoutingV2ModelStatus='ACTIVE'|'DISABLED';
export type RoutingV2RouteStatus='DISCOVERED'|'MAPPED'|'PRICED'|'READY'|'DEGRADED'|'DISABLED';
export type RoutingV2PricingStatus='UNKNOWN'|'CURRENT'|'STALE'|'INVALID';
export type RoutingV2RuntimeStatus='UNKNOWN'|'HEALTHY'|'DEGRADED'|'UNAVAILABLE';
export type RoutingV2BillingType='PER_GENERATION'|'PER_OUTPUT'|'PER_SECOND'|'PER_MINUTE'|'PER_CHARACTER'|'FIXED_MATRIX'|'CUSTOM_FORMULA';
export type RoutingV2PriceSource='PROVIDER_QUOTE_API'|'PROVIDER_CATALOG_API'|'PROVIDER_DOCS'|'SCRAPER'|'MANUAL_VERIFIED';
export type RoutingV2Currency='USD'|'BRL';

export interface RoutingV2Provider{
  provider_id:string;
  name:string;
  slug:string;
  type:RoutingV2ProviderType;
  status:RoutingV2ProviderStatus;
  priority:number;
  adapter_id:string;
  secret_reference?:string|null;
  supports_catalog_sync:boolean;
  supports_pricing_sync:boolean;
  supports_balance:boolean;
  balance_amount?:number|null;
  balance_currency?:RoutingV2Currency|null;
  balance_updated_at?:string|null;
  health_status:RoutingV2RuntimeStatus;
  last_health_check_at?:string|null;
  created_at:string;
  updated_at:string;
}

export interface RoutingV2Model{
  model_id:string;
  name:string;
  slug:string;
  vendor:string;
  category:ModelCategory;
  description:string;
  capabilities:CapabilityId[];
  supported_controls?:Record<string,unknown>;
  status:RoutingV2ModelStatus;
  created_at:string;
  updated_at:string;
}

export interface RoutingV2FixedMatrixEntry{
  match:Record<string,string|number|boolean>;
  price:number;
}

export type RoutingV2BillingConfig=
 | {type:'PER_GENERATION';currency:RoutingV2Currency;price_per_generation:number;}
 | {type:'PER_OUTPUT';currency:RoutingV2Currency;price_per_output:number;}
 | {type:'PER_SECOND';currency:RoutingV2Currency;price_per_second:number;}
 | {type:'PER_MINUTE';currency:RoutingV2Currency;price_per_minute:number;}
 | {type:'PER_CHARACTER';currency:RoutingV2Currency;price_per_unit:number;characters_per_unit:number;}
 | {type:'FIXED_MATRIX';currency:RoutingV2Currency;entries:RoutingV2FixedMatrixEntry[];}
 | {type:'CUSTOM_FORMULA';currency:RoutingV2Currency;formula_id:string;parameters?:Record<string,string|number|boolean>;};

export interface RoutingV2PriceSnapshot{
  billing_config:RoutingV2BillingConfig;
  source:RoutingV2PriceSource;
  source_reference?:string|null;
  provider_cost_reference:number;
  safe_cogs_brl:number|null;
  retail_price_credits:number|null;
  expected_margin_percent:number|null;
  fx_rate_usd_brl?:number|null;
  fetched_at:string;
  valid_until:string;
}

export interface RoutingV2RouteMetrics{
  success_rate?:number|null;
  error_rate?:number|null;
  latency_p50_ms?:number|null;
  latency_p95_ms?:number|null;
  last_success_at?:string|null;
  last_failure_at?:string|null;
}

export interface RoutingV2ProviderRoute{
  route_id:string;
  model_id:string;
  capability_id:CapabilityId;
  provider_id:string;
  provider_model_identifier:string;
  mapping_source:'PROVIDER_CATALOG_API'|'PROVIDER_DOCS'|'MANUAL_VERIFIED';
  mapping_source_reference:string;
  mapping_verified_at:string;
  status:RoutingV2RouteStatus;
  pricing_status:RoutingV2PricingStatus;
  runtime_status:RoutingV2RuntimeStatus;
  billing_type:RoutingV2BillingType;
  billing_config:RoutingV2BillingConfig;
  pricing_snapshot?:RoutingV2PriceSnapshot|null;
  metrics?:RoutingV2RouteMetrics;
  priority:number;
  last_price_sync_at?:string|null;
  last_runtime_check_at?:string|null;
  created_at:string;
  updated_at:string;
}

export interface RoutingV2PricingSettings{
  settings_id:'default';
  target_margin_percent:number;
  safety_buffer_percent:number;
  reference_credit_value_brl:number;
  price_sync_interval_minutes:number;
  price_freshness_ttl_minutes:number;
  stale_grace_minutes:number;
  updated_at:string;
}

export function routingV2RouteId(modelId:string,capabilityId:CapabilityId,providerId:string,providerModelIdentifier:string){
  const raw=[modelId,capabilityId,providerId,providerModelIdentifier].map(v=>String(v).trim().toLowerCase()).join('|');
  let hash=2166136261;
  for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return `route_v2_${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function assertRoutingV2BillingConfig(config:RoutingV2BillingConfig){
  const positive=(n:number)=>Number.isFinite(n)&&n>=0;
  if(config.type==='PER_GENERATION'&&!positive(config.price_per_generation))throw new Error('Preço por geração inválido.');
  if(config.type==='PER_OUTPUT'&&!positive(config.price_per_output))throw new Error('Preço por output inválido.');
  if(config.type==='PER_SECOND'&&!positive(config.price_per_second))throw new Error('Preço por segundo inválido.');
  if(config.type==='PER_MINUTE'&&!positive(config.price_per_minute))throw new Error('Preço por minuto inválido.');
  if(config.type==='PER_CHARACTER'&&(!positive(config.price_per_unit)||!Number.isInteger(config.characters_per_unit)||config.characters_per_unit<=0))throw new Error('Preço por caractere inválido.');
  if(config.type==='FIXED_MATRIX'&&(!config.entries.length||config.entries.some(entry=>!positive(entry.price))))throw new Error('Matriz de preço inválida.');
  if(config.type==='CUSTOM_FORMULA'&&!config.formula_id.trim())throw new Error('CUSTOM_FORMULA exige formula_id.');
}

export function assertRoutingV2Route(route:RoutingV2ProviderRoute){
  if(!route.route_id||!route.model_id||!route.provider_id||!route.provider_model_identifier)throw new Error('Route V2 incompleta.');
  if(!route.mapping_source||!route.mapping_source_reference?.trim()||!Number.isFinite(Date.parse(route.mapping_verified_at)))throw new Error('Route V2 exige mapping verificável.');
  if(route.billing_type!==route.billing_config.type)throw new Error('billing_type deve corresponder a billing_config.type.');
  if(!Number.isFinite(route.priority))throw new Error('Prioridade da Route V2 inválida.');
  assertRoutingV2BillingConfig(route.billing_config);
  if(route.status==='READY'){
    const pricing=route.pricing_snapshot;
    if(route.pricing_status!=='CURRENT'||route.runtime_status!=='HEALTHY'||!pricing||!pricing.source_reference?.trim()||!Number.isFinite(Date.parse(pricing.fetched_at))||!Number.isFinite(Date.parse(pricing.valid_until))||Date.parse(pricing.valid_until)<=Date.parse(pricing.fetched_at)||!Number.isFinite(pricing.safe_cogs_brl)||Number(pricing.safe_cogs_brl)<=0||!Number.isFinite(pricing.retail_price_credits)||Number(pricing.retail_price_credits)<=0||!Number.isFinite(pricing.expected_margin_percent)||Number(pricing.expected_margin_percent)<0){
      throw new Error('Route READY exige mapping, pricing e economics verificáveis, frescos e health real.');
    }
  }
}

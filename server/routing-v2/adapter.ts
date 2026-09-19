import { CapabilityId } from '../beta/capabilityRegistry.js';
import {
  RoutingV2BillingConfig,
  RoutingV2PriceSource,
  RoutingV2Provider,
  RoutingV2RuntimeStatus,
} from './domain.js';

export interface RoutingV2ProviderHealth{
  status:RoutingV2RuntimeStatus;
  checked_at:string;
  message?:string|null;
}

export interface RoutingV2ProviderBalance{
  amount:number;
  currency:'USD'|'BRL';
  checked_at:string;
}

export interface RoutingV2CatalogModel{
  provider_model_identifier:string;
  name:string;
  vendor?:string|null;
  capabilities?:CapabilityId[];
  metadata?:Record<string,unknown>;
}

export interface RoutingV2ProviderPrice{
  billing_config:RoutingV2BillingConfig;
  source:RoutingV2PriceSource;
  source_reference?:string|null;
  fetched_at:string;
}

export interface RoutingV2GenerationInput{
  generation_id:string;
  user_id:string;
  route_id:string;
  model_id:string;
  capability_id:CapabilityId;
  provider_model_identifier:string;
  prompt?:string;
  negative_prompt?:string;
  duration_seconds?:number;
  number_of_outputs?:number;
  character_count?:number;
  parameters?:Record<string,string|number|boolean|null|undefined>;
  references?:Array<{url:string;type:string;role?:string;asset_id?:string;alias?:string;name?:string;category?:string;storage_path?:string;mime_type?:string;slot_type?:'INITIAL'|'END'|'GENERAL'}>;
}

export interface RoutingV2GenerationSubmission{
  provider_job_id:string;
  status:'QUEUED'|'PROCESSING'|'SUCCEEDED';
}

export interface RoutingV2GenerationStatus{
  provider_job_id:string;
  status:'QUEUED'|'PROCESSING'|'SUCCEEDED'|'FAILED';
  progress_percent?:number|null;
  result_urls?:string[];
  error_code?:string|null;
  error_message?:string|null;
}

export interface RoutingV2ProviderAdapter{
  readonly adapter_id:string;
  readonly provider_id:string;
  isConfigured(provider:RoutingV2Provider):boolean;
  health(provider:RoutingV2Provider):Promise<RoutingV2ProviderHealth>;
  balance?(provider:RoutingV2Provider):Promise<RoutingV2ProviderBalance>;
  listModels?(provider:RoutingV2Provider):Promise<RoutingV2CatalogModel[]>;
  getPrice?(provider:RoutingV2Provider,providerModelIdentifier:string,capabilityId:CapabilityId):Promise<RoutingV2ProviderPrice>;
  submitGeneration?(provider:RoutingV2Provider,input:RoutingV2GenerationInput):Promise<RoutingV2GenerationSubmission>;
  checkGeneration?(provider:RoutingV2Provider,providerJobId:string):Promise<RoutingV2GenerationStatus>;
  cancelGeneration?(provider:RoutingV2Provider,providerJobId:string):Promise<boolean>;
}

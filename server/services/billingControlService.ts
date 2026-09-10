import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export interface BillingControl{
  credit_v2_enabled:boolean;
  new_generations_enabled:boolean;
  provider_execution_enabled:boolean;
  yellow_execution_enabled:boolean;
  updated_at:string;
  updated_by?:string;
}
const DOC='app_config/billing_control';
const DEFAULTS:BillingControl={credit_v2_enabled:true,new_generations_enabled:true,provider_execution_enabled:true,yellow_execution_enabled:false,updated_at:new Date(0).toISOString()};
let cache:BillingControl|null=null,cacheAt=0;const TTL=5000;
function normalize(raw:any={}):BillingControl{return{credit_v2_enabled:raw.credit_v2_enabled!==false,new_generations_enabled:raw.new_generations_enabled!==false,provider_execution_enabled:raw.provider_execution_enabled!==false,yellow_execution_enabled:Boolean(raw.yellow_execution_enabled),updated_at:String(raw.updated_at||new Date(0).toISOString()),updated_by:raw.updated_by};}
export const billingControlService={
 async get(force=false){if(!force&&cache&&Date.now()-cacheAt<TTL)return cache;try{const d=await firestoreAdminRest.get(DOC);cache=d.exists?normalize(d.data):DEFAULTS;}catch{cache=DEFAULTS;}cacheAt=Date.now();return cache;},
 async set(patch:Partial<BillingControl>,updatedBy?:string){const next=normalize({...await this.get(true),...patch,updated_at:new Date().toISOString(),updated_by:updatedBy});await firestoreAdminRest.set(DOC,next);cache=next;cacheAt=Date.now();return next;},
 async assertNewGenerationAllowed(){const c=await this.get(false);if(!c.credit_v2_enabled)throw Object.assign(new Error('Billing em créditos está temporariamente indisponível.'),{code:'CREDIT_BILLING_DISABLED'});if(!c.new_generations_enabled)throw Object.assign(new Error('Novas gerações estão temporariamente pausadas.'),{code:'NEW_GENERATIONS_DISABLED'});if(!c.provider_execution_enabled)throw Object.assign(new Error('Execução em provedores está temporariamente pausada.'),{code:'PROVIDER_EXECUTION_DISABLED'});return c;},
 invalidate(){cache=null;cacheAt=0;},
};

import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export interface PricingSettings {
  gross_margin_percent:number;
  target_margin_percent:number;
  normal_floor_margin_percent:number;
  emergency_floor_margin_percent:number;
  conservative_credit_value_micros:number;
  safety_buffer_percent:number;
  stale_buffer_percent:number;
  pricing_snapshot_max_age_minutes:number;
  variable_overhead_percent:number;
  yellow_execution_enabled:boolean;
  updated_at:string;
  updated_by?:string;
}

const DOC='app_config/pricing';
const DEFAULTS:PricingSettings={gross_margin_percent:45,target_margin_percent:45,normal_floor_margin_percent:35,emergency_floor_margin_percent:25,conservative_credit_value_micros:7500,safety_buffer_percent:5,stale_buffer_percent:8,pricing_snapshot_max_age_minutes:60,variable_overhead_percent:2,yellow_execution_enabled:false,updated_at:new Date(0).toISOString()};
let cache:PricingSettings|null=null,cacheAt=0;const CACHE_MS=5_000;
const pct=(v:any,d:number,min=0,max=90)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.round(Number(v)*100)/100)):d;
function normalize(raw:any={}):PricingSettings{return{gross_margin_percent:pct(raw.gross_margin_percent??raw.target_margin_percent,45,10,80),target_margin_percent:pct(raw.target_margin_percent??raw.gross_margin_percent,45,10,80),normal_floor_margin_percent:pct(raw.normal_floor_margin_percent,35,5,80),emergency_floor_margin_percent:pct(raw.emergency_floor_margin_percent,25,0,70),conservative_credit_value_micros:Math.max(1,Math.round(Number(raw.conservative_credit_value_micros||7500))),safety_buffer_percent:pct(raw.safety_buffer_percent,5,0,25),stale_buffer_percent:pct(raw.stale_buffer_percent,8,0,50),pricing_snapshot_max_age_minutes:Math.max(30,Math.round(Number(raw.pricing_snapshot_max_age_minutes||60))),variable_overhead_percent:pct(raw.variable_overhead_percent,2,0,50),yellow_execution_enabled:Boolean(raw.yellow_execution_enabled),updated_at:String(raw.updated_at||new Date(0).toISOString()),updated_by:raw.updated_by};}
export const pricingSettingsService={
 async get(force=false):Promise<PricingSettings>{if(!force&&cache&&Date.now()-cacheAt<CACHE_MS)return cache;try{const d=await firestoreAdminRest.get(DOC);cache=d.exists?normalize(d.data):DEFAULTS;}catch{cache=DEFAULTS;}cacheAt=Date.now();return cache;},
 async set(grossMarginPercent:number,updatedBy?:string){const current=await this.get(true);return this.setAll({...current,gross_margin_percent:grossMarginPercent,target_margin_percent:grossMarginPercent,updated_by:updatedBy});},
 async setAll(input:Partial<PricingSettings>){const next=normalize({...await this.get(true),...input,updated_at:new Date().toISOString()});await firestoreAdminRest.set(DOC,next);cache=next;cacheAt=Date.now();return next;},
 invalidate(){cache=null;cacheAt=0;},
};
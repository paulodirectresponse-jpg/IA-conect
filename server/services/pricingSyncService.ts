import { STUDIO_FALLBACK_MODELS } from '../../src/config/studioCatalog.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { quoteCacheService } from './quoteCacheService.js';
import { providerFinanceService } from './providerFinanceService.js';
import { fxRateService } from './fxRateService.js';
import { GenerationMode } from '../../src/types/index.js';

export interface PricingHealthRow {
  key:string;
  provider_id:string;
  provider_name:string;
  model_id:string;
  mode:GenerationMode;
  duration_seconds:number;
  resolution:string;
  provider_cost_usd:number|null;
  provider_cost_brl_cents:number|null;
  safe_cost_brl_cents:number|null;
  customer_price_cents:number|null;
  margin_percent:number|null;
  status:'OK'|'FAILED';
  checked_at:string;
  error?:string;
}

export interface PricingHealthSnapshot {
  checked_at:string|null;
  checked:number;
  healthy:number;
  failed:number;
  fx_rate:number|null;
  fx_source:string|null;
  cache_ttl_minutes:number;
  provider_finance:any[];
  rows:PricingHealthRow[];
}

let latestSnapshot:PricingHealthSnapshot={
  checked_at:null,checked:0,healthy:0,failed:0,fx_rate:null,fx_source:null,
  cache_ttl_minutes:30,provider_finance:[],rows:[],
};

function modeFor(model:(typeof STUDIO_FALLBACK_MODELS)[number]):GenerationMode{
  if(model.category==='IMAGE')return 'TEXT_TO_IMAGE';
  if(model.supported_modes.includes('TEXT_TO_VIDEO'))return 'TEXT_TO_VIDEO';
  return model.supported_modes[0] as GenerationMode;
}
function durationFor(model:(typeof STUDIO_FALLBACK_MODELS)[number]){
  if(model.category==='IMAGE')return 1;
  if(model.supported_durations.includes(15))return 15;
  return model.supported_durations[Math.floor(model.supported_durations.length/2)]||5;
}
function resolutionFor(model:(typeof STUDIO_FALLBACK_MODELS)[number]){
  const preferred=model.category==='IMAGE'?['2K','1K','4K']:['720p','768p','540p','480p','1080p'];
  return preferred.find(r=>model.supported_resolutions.includes(r))||model.supported_resolutions[0];
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
  const out=new Array<R>(items.length);let cursor=0;
  async function worker(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return out;
}

export const pricingSyncService={
  async getLatestSnapshot(){return latestSnapshot;},

  async runHourlySync(){
    const checkedAt=new Date().toISOString();
    const [fx,providerFinance]=await Promise.all([
      fxRateService.get(true),
      providerFinanceService.getAll(true).catch(()=>[]),
    ]);
    quoteCacheService.invalidateAll();

    const jobs:{adapter:any;model:(typeof STUDIO_FALLBACK_MODELS)[number];mode:GenerationMode;resolution:string;duration:number}[]=[];
    for(const model of STUDIO_FALLBACK_MODELS.filter(m=>m.status==='ACTIVE')){
      const mode=modeFor(model),resolution=resolutionFor(model),duration=durationFor(model);
      for(const adapter of providerRegistry.listAdapters()){
        if(!adapter.isConfigured()||!adapter.quoteCostUsd||!adapter.supports(model.model_id,mode))continue;
        jobs.push({adapter,model,mode,resolution,duration});
      }
    }

    const rows=await mapWithConcurrency(jobs,4,async(job):Promise<PricingHealthRow>=>{
      const {adapter,model,mode,resolution,duration}=job;
      const key=`${adapter.providerId}:${model.model_id}:${mode}:${resolution}:${duration}`;
      try{
        const quote=await quoteCacheService.getOrQuote(adapter,{
          userId:'pricing-health',model_id:model.model_id,mode,duration_seconds:duration,resolution,
          aspect_ratio:model.recommended_aspect_ratio||'16:9',number_of_outputs:1,
        },true);
        return {
          key,provider_id:adapter.providerId,provider_name:adapter.name,model_id:model.model_id,mode,
          duration_seconds:duration,resolution,provider_cost_usd:quote.provider_cost_usd,
          provider_cost_brl_cents:quote.provider_cost_brl_cents,safe_cost_brl_cents:quote.safe_cost_brl_cents,
          customer_price_cents:quote.customer_price_cents,margin_percent:quote.effective_margin*100,
          status:'OK',checked_at:checkedAt,
        };
      }catch(err:any){
        return {
          key,provider_id:adapter.providerId,provider_name:adapter.name,model_id:model.model_id,mode,
          duration_seconds:duration,resolution,provider_cost_usd:null,provider_cost_brl_cents:null,
          safe_cost_brl_cents:null,customer_price_cents:null,margin_percent:null,status:'FAILED',
          checked_at:checkedAt,error:err?.message||'Provider não retornou cotação válida.',
        };
      }
    });

    latestSnapshot={
      checked_at:checkedAt,checked:rows.length,healthy:rows.filter(r=>r.status==='OK').length,
      failed:rows.filter(r=>r.status==='FAILED').length,fx_rate:fx.rate,fx_source:fx.source,
      cache_ttl_minutes:Math.round(quoteCacheService.ttl_ms()/60000),provider_finance:providerFinance,rows,
    };
    return latestSnapshot;
  },
};

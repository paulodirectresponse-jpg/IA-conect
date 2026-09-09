import { STUDIO_FALLBACK_MODELS } from '../../src/config/studioCatalog.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { pricingGuardService } from './pricingGuardService.js';
import { providerFinanceService } from './providerFinanceService.js';
import { fxRateService } from './fxRateService.js';
import { GenerationMode } from '../../src/types/index.js';

export interface PricingHealthRow {
  key: string;
  provider_id: string;
  model_id: string;
  mode: GenerationMode;
  duration_seconds: number;
  resolution: string;
  provider_cost_usd: number | null;
  provider_cost_brl_cents: number | null;
  safe_cost_brl_cents: number | null;
  customer_price_cents: number | null;
  margin_percent: number | null;
  fx_rate: number;
  status: 'OK' | 'FAILED';
  checked_at: string;
  error?: string;
}

function referenceDuration(model: (typeof STUDIO_FALLBACK_MODELS)[number]) {
  if (model.category === 'IMAGE') return 1;
  if (model.supported_durations.includes(15)) return 15;
  return Math.max(...model.supported_durations);
}

function providerIdsForModel(modelId:string,mappings:any[]){
  const ids=mappings.filter((m)=>m.model_id===modelId&&m.status==='ACTIVE').map((m)=>m.provider_id);
  if(modelId==='seedance-2-0'&&!ids.includes('provider-wavespeed'))ids.push('provider-wavespeed');
  return Array.from(new Set(ids));
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
  const out=new Array<R>(items.length);let cursor=0;
  async function worker(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return out;
}

export const pricingSyncService = {
  async getLatestSnapshot(){
    const db=getAdminDb();
    if(!db)return {checked_at:null,checked:0,healthy:0,failed:0,rows:[] as PricingHealthRow[]};
    const [stateSnap,rowsSnap]=await Promise.all([
      db.collection('system_state').doc('pricing_sync').get(),
      db.collection('pricing_health').get(),
    ]);
    const state:any=stateSnap.exists?stateSnap.data():{};
    const rows=rowsSnap.docs.map((d)=>d.data() as PricingHealthRow).sort((a,b)=>
      a.model_id.localeCompare(b.model_id)||a.mode.localeCompare(b.mode)||a.resolution.localeCompare(b.resolution)||a.provider_id.localeCompare(b.provider_id)
    );
    return {
      checked_at:state?.last_run_at||rows[0]?.checked_at||null,
      fx_rate:state?.fx_rate||null,
      fx_source:state?.fx_source||null,
      checked:rows.length,
      healthy:rows.filter((r)=>r.status==='OK').length,
      failed:rows.filter((r)=>r.status==='FAILED').length,
      rows,
    };
  },

  async runHourlySync() {
    const checkedAt = new Date().toISOString();
    const [providers, mappings, fx] = await Promise.all([
      catalogRepository.listProviders(),
      catalogRepository.listMappings(),
      fxRateService.get(true),
      providerFinanceService.getAll(true).catch(() => []),
    ]).then(([providersRows, mappingRows, fxSnapshot]) => [providersRows, mappingRows, fxSnapshot] as const);

    const activeProviders = new Map(providers.filter((p) => p.status !== 'INACTIVE').map((p) => [p.provider_id, p]));
    const jobs:{providerId:string;model:(typeof STUDIO_FALLBACK_MODELS)[number];mode:GenerationMode;resolution:string;duration:number}[]=[];

    for(const model of STUDIO_FALLBACK_MODELS.filter((m)=>m.status==='ACTIVE')){
      const duration=referenceDuration(model);
      const providerIds=providerIdsForModel(model.model_id,mappings);
      for(const mode of model.supported_modes as GenerationMode[]){
        for(const resolution of model.supported_resolutions){
          for(const providerId of providerIds){
            const provider=activeProviders.get(providerId);
            const adapter=providerRegistry.getAdapter(providerId);
            if(!provider||!adapter||!adapter.isConfigured()||!adapter.quoteCostUsd||!adapter.supports(model.model_id,mode))continue;
            jobs.push({providerId,model,mode,resolution,duration});
          }
        }
      }
    }

    const rows=await mapWithConcurrency(jobs,8,async(job):Promise<PricingHealthRow>=>{
      const {providerId,model,mode,resolution,duration}=job;
      const key=`${providerId}:${model.model_id}:${mode}:${resolution}:${duration}`;
      const adapter=providerRegistry.getAdapter(providerId)!;
      try{
        const quote=await pricingGuardService.quote(adapter,{
          userId:'pricing-sync',model_id:model.model_id,mode,duration_seconds:duration,resolution,
          aspect_ratio:model.recommended_aspect_ratio||'16:9',number_of_outputs:1,
        });
        return {
          key,provider_id:providerId,model_id:model.model_id,mode,duration_seconds:duration,resolution,
          provider_cost_usd:quote.provider_cost_usd,provider_cost_brl_cents:quote.provider_cost_brl_cents,
          safe_cost_brl_cents:quote.safe_cost_brl_cents,customer_price_cents:quote.customer_price_cents,
          margin_percent:quote.effective_margin*100,fx_rate:quote.fx_rate,status:'OK',checked_at:checkedAt,
        };
      }catch(err:any){
        return {
          key,provider_id:providerId,model_id:model.model_id,mode,duration_seconds:duration,resolution,
          provider_cost_usd:null,provider_cost_brl_cents:null,safe_cost_brl_cents:null,customer_price_cents:null,
          margin_percent:null,fx_rate:fx.rate,status:'FAILED',checked_at:checkedAt,error:err?.message||'Falha na verificação de preço.',
        };
      }
    });

    const db=getAdminDb();
    if(db){
      const existing=await db.collection('pricing_health').get();
      const batch=db.batch();
      for(const doc of existing.docs)batch.delete(doc.ref);
      for(const row of rows)batch.set(db.collection('pricing_health').doc(row.key.replace(/[^a-zA-Z0-9:_-]/g,'_')),row);
      batch.set(db.collection('system_state').doc('pricing_sync'),{
        last_run_at:checkedAt,fx_rate:fx.rate,fx_source:fx.source,checked:rows.length,
        healthy:rows.filter((r)=>r.status==='OK').length,failed:rows.filter((r)=>r.status==='FAILED').length,
      },{merge:true});
      await batch.commit();
    }

    return {
      checked_at:checkedAt,fx_rate:fx.rate,fx_source:fx.source,checked:rows.length,
      healthy:rows.filter((r)=>r.status==='OK').length,failed:rows.filter((r)=>r.status==='FAILED').length,rows,
    };
  },
};

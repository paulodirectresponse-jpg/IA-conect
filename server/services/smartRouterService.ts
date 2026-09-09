import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { providerFinanceService } from './providerFinanceService.js';
import { GenerationMode, RoutingLogEntry, ProviderStatus, ProviderModelMapping, PricingEntry } from '../../src/types/index.js';

export interface RoutingCandidate{
  provider_id:string;
  provider_name:string;
  provider_cost_cents:number;
  customer_price_cents:number;
  priority:number;
  status:ProviderStatus;
  is_healthy:boolean;
  balance_brl_cents?:number|null;
  low_balance?:boolean;
}
export interface RoutingDecision{selected:RoutingCandidate;candidates:RoutingCandidate[];reason:string;strategy:'CHEAPEST_RELIABLE';}

const nowIso='2026-09-09T00:00:00.000Z';
const seedance20WaveMapping:ProviderModelMapping={mapping_id:'map-seed20-wave-runtime',model_id:'seedance-2-0',provider_id:'provider-wavespeed',provider_model_identifier:'bytedance/seedance-2.0',status:'ACTIVE',updated_at:nowIso};
const seedance20WavePricing:PricingEntry[]=[
  {pricing_id:'seed20-wave-480-runtime',provider_id:'provider-wavespeed',model_id:'seedance-2-0',resolution:'480p',duration_seconds:1,unit:'PER_SECOND',provider_cost_cents:61,customer_price_cents:69,currency:'BRL',effective_from:nowIso,active:true,updated_at:nowIso},
  {pricing_id:'seed20-wave-720-runtime',provider_id:'provider-wavespeed',model_id:'seedance-2-0',resolution:'720p',duration_seconds:1,unit:'PER_SECOND',provider_cost_cents:122,customer_price_cents:137,currency:'BRL',effective_from:nowIso,active:true,updated_at:nowIso},
  {pricing_id:'seed20-wave-1080-runtime',provider_id:'provider-wavespeed',model_id:'seedance-2-0',resolution:'1080p',duration_seconds:1,unit:'PER_SECOND',provider_cost_cents:306,customer_price_cents:343,currency:'BRL',effective_from:nowIso,active:true,updated_at:nowIso},
];

export const smartRouterService={
 async selectProvider(params:{userId:string;model_id:string;mode:GenerationMode;duration_seconds:number;resolution:string;number_of_outputs:number;generation_id?:string}):Promise<RoutingDecision>{
  const [providers,baseMappings,basePricing,financeRows]=await Promise.all([
    catalogRepository.listProviders(),
    catalogRepository.listMappings(),
    catalogRepository.listPricing(),
    providerFinanceService.getAll(false).catch(()=>[]),
  ]);
  const financeById=new Map(financeRows.map(row=>[row.provider_id,row]));
  const mappings=[...baseMappings];
  if(!mappings.some(m=>m.model_id==='seedance-2-0'&&m.provider_id==='provider-wavespeed'))mappings.push(seedance20WaveMapping);
  const pricing=[...basePricing];
  for(const row of seedance20WavePricing){if(!pricing.some(p=>p.pricing_id===row.pricing_id||p.model_id===row.model_id&&p.provider_id===row.provider_id&&p.resolution===row.resolution))pricing.push(row);}

  const mapProviders=new Set(mappings.filter(m=>m.model_id===params.model_id&&m.status==='ACTIVE').map(m=>m.provider_id));
  const candidates:RoutingCandidate[]=[];
  const now=Date.now();
  for(const p of providers){
    if(p.status==='INACTIVE'||!mapProviders.has(p.provider_id))continue;
    const adapter=providerRegistry.getAdapter(p.provider_id);
    if(!adapter||!adapter.isConfigured()||!adapter.supports(params.model_id,params.mode))continue;
    const entries=pricing.filter(x=>x.active&&x.provider_id===p.provider_id&&x.model_id===params.model_id&&x.resolution.toLowerCase()===params.resolution.toLowerCase()&&Date.parse(x.effective_from)<=now&&(!x.effective_until||Date.parse(x.effective_until)>now));
    if(!entries.length)continue;
    const e=entries.sort((a,b)=>b.updated_at.localeCompare(a.updated_at))[0];
    const base=Math.max(1,e.duration_seconds||1);
    const multiplier=(params.duration_seconds/base)*Math.max(1,params.number_of_outputs);
    const providerCost=Math.ceil(e.provider_cost_cents*multiplier);
    const customerPrice=Math.ceil(e.customer_price_cents*multiplier);
    // Cost protection: a generation is never routed without a positive, known price.
    if(providerCost<=0||customerPrice<=0)continue;
    const finance=financeById.get(p.provider_id as any);
    // If the provider reported a live balance and it cannot cover this job, do not submit there.
    if(finance?.balance_brl_cents!=null&&finance.balance_brl_cents<providerCost)continue;
    const lowBalance=Boolean(finance?.low_balance);
    candidates.push({
      provider_id:p.provider_id,
      provider_name:p.name,
      provider_cost_cents:providerCost,
      customer_price_cents:customerPrice,
      priority:p.priority,
      status:p.status,
      is_healthy:p.status==='ACTIVE'&&!lowBalance,
      balance_brl_cents:finance?.balance_brl_cents,
      low_balance:lowBalance,
    });
  }
  if(!candidates.length){const err:any=new Error('Nenhum provider possui rota, preço e saldo operacional válidos para esta geração.');err.code='NO_PROVIDER_AVAILABLE';throw err;}
  candidates.sort((a,b)=>(a.is_healthy===b.is_healthy?a.provider_cost_cents-b.provider_cost_cents:a.is_healthy?-1:1)||b.priority-a.priority);
  const selected=candidates[0];
  const reason=`${selected.provider_name} selecionado por custo, disponibilidade e saldo entre rotas compatíveis.`;
  const log:RoutingLogEntry={log_id:`route_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,generation_id:params.generation_id,user_id:params.userId,model_id:params.model_id,selected_provider_id:selected.provider_id,strategy:'CHEAPEST_RELIABLE',candidate_providers:candidates.map(c=>({provider_id:c.provider_id,provider_cost_cents:c.provider_cost_cents,customer_price_cents:c.customer_price_cents,status:c.status,priority:c.priority,is_healthy:c.is_healthy})),reason,created_at:new Date().toISOString()};
  const db=getAdminDb();if(db)await db.collection('routing_logs').doc(log.log_id).set({...log, provider_balance_snapshot:candidates.map(c=>({provider_id:c.provider_id,balance_brl_cents:c.balance_brl_cents??null,low_balance:Boolean(c.low_balance)}))});
  return {selected,candidates,reason,strategy:'CHEAPEST_RELIABLE'};
 },
 async listRoutingLogs(limit=50){const db=getAdminDb();if(!db)return[];const snap=await db.collection('routing_logs').orderBy('created_at','desc').limit(limit).get();return snap.docs.map(d=>d.data() as RoutingLogEntry);}
};

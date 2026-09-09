import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { providerFinanceService, ProviderFinanceSnapshot } from './providerFinanceService.js';
import { quoteCacheService } from './quoteCacheService.js';
import { GenerationMode, RoutingLogEntry, ProviderStatus, ProviderModelMapping } from '../../src/types/index.js';

export interface RoutingCandidate{
  provider_id:string;
  provider_name:string;
  provider_cost_cents:number;
  safe_cost_cents:number;
  customer_price_cents:number;
  provider_cost_usd:number;
  margin_percent:number;
  quoted_at:string;
  quote_estimated:boolean;
  priority:number;
  status:ProviderStatus;
  is_healthy:boolean;
  balance_brl_cents?:number|null;
  low_balance?:boolean;
}
export interface RoutingDecision{selected:RoutingCandidate;candidates:RoutingCandidate[];reason:string;strategy:'CHEAPEST_RELIABLE';}

const nowIso='2026-09-09T00:00:00.000Z';
const seedance20WaveMapping:ProviderModelMapping={mapping_id:'map-seed20-wave-runtime',model_id:'seedance-2-0',provider_id:'provider-wavespeed',provider_model_identifier:'bytedance/seedance-2.0',status:'ACTIVE',updated_at:nowIso};

export const smartRouterService={
 async selectProvider(params:{
   userId:string;model_id:string;mode:GenerationMode;duration_seconds:number;resolution:string;number_of_outputs:number;
   aspect_ratio?:string;prompt?:string;negative_prompt?:string;seed?:number|null;motion_strength?:number|null;generation_id?:string;force_live_quote?:boolean;
 }):Promise<RoutingDecision>{
  const [providers,baseMappings,financeRows]=await Promise.all([
    catalogRepository.listProviders(),
    catalogRepository.listMappings(),
    providerFinanceService.getAll(false).catch(()=>[] as ProviderFinanceSnapshot[]),
  ]);
  const financeById=new Map<string,ProviderFinanceSnapshot>();
  for(const row of financeRows)financeById.set(row.provider_id,row);
  const mappings=[...baseMappings];
  if(!mappings.some(m=>m.model_id==='seedance-2-0'&&m.provider_id==='provider-wavespeed'))mappings.push(seedance20WaveMapping);
  const mapProviders=new Set(mappings.filter(m=>m.model_id===params.model_id&&m.status==='ACTIVE').map(m=>m.provider_id));

  const attempts=await Promise.all(providers.map(async(p):Promise<RoutingCandidate|null>=>{
    if(p.status==='INACTIVE'||!mapProviders.has(p.provider_id))return null;
    const adapter=providerRegistry.getAdapter(p.provider_id);
    if(!adapter||!adapter.isConfigured()||!adapter.supports(params.model_id,params.mode)||!adapter.quoteCostUsd)return null;
    try{
      const quote=await quoteCacheService.getOrQuote(adapter,{
        userId:params.userId,model_id:params.model_id,mode:params.mode,prompt:params.prompt,negative_prompt:params.negative_prompt,
        duration_seconds:params.duration_seconds,resolution:params.resolution,aspect_ratio:params.aspect_ratio||'16:9',
        number_of_outputs:params.number_of_outputs,seed:params.seed,motion_strength:params.motion_strength,
      },Boolean(params.force_live_quote));
      const finance=financeById.get(p.provider_id);
      if(finance?.balance_brl_cents!=null&&finance.balance_brl_cents<quote.provider_cost_brl_cents)return null;
      const lowBalance=Boolean(finance?.low_balance);
      return {
        provider_id:p.provider_id,provider_name:p.name,provider_cost_cents:quote.provider_cost_brl_cents,
        safe_cost_cents:quote.safe_cost_brl_cents,customer_price_cents:quote.customer_price_cents,
        provider_cost_usd:quote.provider_cost_usd,margin_percent:quote.effective_margin*100,quoted_at:quote.quoted_at,
        quote_estimated:quote.estimated,priority:p.priority,status:p.status,is_healthy:p.status==='ACTIVE'&&!lowBalance,
        balance_brl_cents:finance?.balance_brl_cents,low_balance:lowBalance,
      };
    }catch(err:any){
      console.warn('[SmartRouterQuote]',p.provider_id,params.model_id,err?.code||err?.message||err);
      return null;
    }
  }));

  const candidates=attempts.filter((row):row is RoutingCandidate=>Boolean(row));
  if(!candidates.length){const err:any=new Error('Nenhum provider retornou uma cotação ao vivo segura, possui saldo suficiente e suporta esta configuração.');err.code='NO_SAFE_PROVIDER_AVAILABLE';throw err;}
  candidates.sort((a,b)=>(a.is_healthy===b.is_healthy?a.provider_cost_cents-b.provider_cost_cents:a.is_healthy?-1:1)||b.priority-a.priority);
  const selected=candidates[0];
  const reason=`${selected.provider_name} selecionado por cotação ao vivo, custo, disponibilidade, saldo e margem protegida.`;
  const log:RoutingLogEntry={log_id:`route_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,generation_id:params.generation_id,user_id:params.userId,model_id:params.model_id,selected_provider_id:selected.provider_id,strategy:'CHEAPEST_RELIABLE',candidate_providers:candidates.map(c=>({provider_id:c.provider_id,provider_cost_cents:c.provider_cost_cents,customer_price_cents:c.customer_price_cents,status:c.status,priority:c.priority,is_healthy:c.is_healthy})),reason,created_at:new Date().toISOString()};
  const db=getAdminDb();if(db)await db.collection('routing_logs').doc(log.log_id).set({...log, pricing_snapshot:{selected_provider_id:selected.provider_id,provider_cost_usd:selected.provider_cost_usd,provider_cost_brl_cents:selected.provider_cost_cents,safe_cost_brl_cents:selected.safe_cost_cents,customer_price_cents:selected.customer_price_cents,margin_percent:selected.margin_percent,quoted_at:selected.quoted_at,quote_estimated:selected.quote_estimated},provider_balance_snapshot:candidates.map(c=>({provider_id:c.provider_id,balance_brl_cents:c.balance_brl_cents??null,low_balance:Boolean(c.low_balance)}))}).catch(()=>{});
  return {selected,candidates,reason,strategy:'CHEAPEST_RELIABLE'};
 },
 async listRoutingLogs(limit=50){const db=getAdminDb();if(!db)return[];const snap=await db.collection('routing_logs').orderBy('created_at','desc').limit(limit).get();return snap.docs.map(d=>d.data() as RoutingLogEntry);}
};

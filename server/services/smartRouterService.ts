import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { ProviderGenerationReference } from '../adapters/videoProviderAdapter.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { providerFinanceService, ProviderFinanceSnapshot } from './providerFinanceService.js';
import { providerCatalogService } from './providerCatalogService.js';
import { quoteCacheService } from './quoteCacheService.js';
import { GenerationMode, ProviderStatus, ProviderModelMapping } from '../../src/types/index.js';

export interface RoutingCandidate{
  provider_id:string;
  provider_name:string;
  provider_model_identifier:string;
  provider_cost_cents:number;
  safe_cost_cents:number;
  fully_loaded_safe_cogs_cents:number;
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
  billing_policy:'CHARGE_ON_SUCCESS'|'CHARGE_ON_SUBMISSION'|'CHARGE_ON_PROCESSING'|'UNKNOWN';
}
export interface RoutingDecision{
  selected:RoutingCandidate;
  candidates:RoutingCandidate[];
  reason:string;
  strategy:'CHEAPEST_RELIABLE';
  remaining_cogs_budget_cents:number|null;
}

const nowIso='2026-09-09T00:00:00.000Z';
const seedance20WaveMapping:ProviderModelMapping={
  mapping_id:'map-seed20-wave-runtime',model_id:'seedance-2-0',provider_id:'provider-wavespeed',
  provider_model_identifier:'bytedance/seedance-2.0',status:'ACTIVE',updated_at:nowIso,
};

export const smartRouterService={
  async selectProvider(params:{
    userId:string;model_id:string;mode:GenerationMode;capability_id?:string;
    duration_seconds:number;resolution:string;number_of_outputs:number;aspect_ratio?:string;
    prompt?:string;negative_prompt?:string;seed?:number|null;motion_strength?:number|null;
    audio_enabled?:boolean;model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
    provider_references?:ProviderGenerationReference[];
    generation_id?:string;force_live_quote?:boolean;max_allowed_cogs_cents?:number;incurred_cogs_cents?:number;exclude_provider_ids?:string[];
  }):Promise<RoutingDecision>{
    const[providers,baseMappings,financeRows]=await Promise.all([
      providerCatalogService.listProviders(),catalogRepository.listMappings(),
      providerFinanceService.getAll(false).catch(()=>[] as ProviderFinanceSnapshot[]),
    ]);
    const financeById=new Map<string,ProviderFinanceSnapshot>();
    for(const row of financeRows)financeById.set(String(row.provider_id),row);
    const mappings=[...baseMappings];
    if(!mappings.some(m=>m.model_id==='seedance-2-0'&&m.provider_id==='provider-wavespeed'))mappings.push(seedance20WaveMapping);
    const activeMappings=new Map(
      mappings.filter(m=>m.model_id===params.model_id&&m.status==='ACTIVE'&&(!params.capability_id||!m.capabilities?.length||m.capabilities.includes(params.capability_id))).map(m=>[String(m.provider_id),m]),
    );
    const excluded=new Set((params.exclude_provider_ids||[]).map(String));
    const preferredProviderId=String(params.pricing_options?.preferred_provider_id||'').trim();
    const providerPricingOptions={...(params.pricing_options||{})};
    delete providerPricingOptions.preferred_provider_id;
    const max=Number.isFinite(Number(params.max_allowed_cogs_cents))?Math.max(0,Number(params.max_allowed_cogs_cents)):null;
    const incurred=Math.max(0,Number(params.incurred_cogs_cents||0));
    const remaining=max==null?null:Math.max(0,max-incurred);

    const attempts=await Promise.all(providers.map(async provider=>{
      const providerId=String(provider.provider_id);
      const mapping=activeMappings.get(providerId);
      if(preferredProviderId&&providerId!==preferredProviderId)return null;
      if(provider.status==='INACTIVE'||excluded.has(providerId)||!mapping)return null;
      const adapter=providerRegistry.getAdapter(provider.provider_id as any);
      if(!adapter||!adapter.isConfigured()||!adapter.supports(params.model_id,params.mode,mapping.provider_model_identifier)||!adapter.quoteCostUsd)return null;
      try{
        const quote=await quoteCacheService.getOrQuote(adapter,{
          userId:params.userId,model_id:params.model_id,mode:params.mode,capability_id:params.capability_id,
          provider_model_identifier:mapping.provider_model_identifier,prompt:params.prompt,negative_prompt:params.negative_prompt,
          duration_seconds:params.duration_seconds,resolution:params.resolution,aspect_ratio:params.aspect_ratio||'16:9',
          number_of_outputs:params.number_of_outputs,seed:params.seed,motion_strength:params.motion_strength,
          audio_enabled:params.audio_enabled,model_variant:params.model_variant,pricing_options:providerPricingOptions,
          provider_references:params.provider_references,
        },Boolean(params.force_live_quote));
        const finance=financeById.get(providerId);
        if(finance?.balance_brl_cents!=null&&finance.balance_brl_cents<quote.provider_cost_brl_cents)return null;
        const loaded=Number(quote.fully_loaded_safe_cogs_cents||quote.safe_cost_brl_cents);
        if(remaining!=null&&loaded>remaining)return null;
        const low=Boolean(finance?.low_balance);
        return{
          provider_id:providerId,provider_name:provider.name,
          provider_model_identifier:mapping.provider_model_identifier,
          provider_cost_cents:quote.provider_cost_brl_cents,safe_cost_cents:quote.safe_cost_brl_cents,
          fully_loaded_safe_cogs_cents:loaded,customer_price_cents:quote.customer_price_cents,
          provider_cost_usd:quote.provider_cost_usd,margin_percent:quote.effective_margin*100,
          quoted_at:quote.quoted_at,quote_estimated:quote.estimated,priority:provider.priority,status:provider.status,
          is_healthy:provider.status==='ACTIVE'&&!low,balance_brl_cents:finance?.balance_brl_cents,low_balance:low,
          billing_policy:quote.billing_policy||'UNKNOWN',
        } as RoutingCandidate;
      }catch(err:any){
        console.warn('[SmartRouterQuote]',provider.provider_id,params.model_id,err?.code||err?.message||err);
        return null;
      }
    }));
    const candidates=attempts.filter((item):item is RoutingCandidate=>Boolean(item));
    if(!candidates.length){
      const error:any=new Error(preferredProviderId
        ?'O provider escolhido não possui uma rota segura para esta configuração agora.'
        :remaining!=null
          ?'Nenhum provider consegue executar esta configuração dentro do orçamento econômico seguro.'
          :'Nenhum provider retornou uma cotação segura, possui saldo suficiente e suporta esta configuração.');
      error.code=preferredProviderId?'PREFERRED_PROVIDER_UNAVAILABLE':'NO_SAFE_PROVIDER_AVAILABLE';error.remaining_cogs_budget_cents=remaining;throw error;
    }
    candidates.sort((a,b)=>(a.is_healthy===b.is_healthy
      ?a.fully_loaded_safe_cogs_cents-b.fully_loaded_safe_cogs_cents
      :a.is_healthy?-1:1)||b.priority-a.priority);
    const selected=candidates[0];
    const reason=preferredProviderId
      ?`${selected.provider_name} usado por escolha explícita do usuário, após validação econômica e operacional.`
      :`${selected.provider_name} selecionado por custo seguro, disponibilidade e orçamento de COGS.`;
    const log={
      log_id:`route_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,generation_id:params.generation_id,
      user_id:params.userId,model_id:params.model_id,capability_id:params.capability_id||null,
      selected_provider_id:selected.provider_id,strategy:'CHEAPEST_RELIABLE',preferred_provider_id:preferredProviderId||null,
      candidate_providers:candidates.map(candidate=>({
        provider_id:candidate.provider_id,provider_cost_cents:candidate.provider_cost_cents,
        safe_cost_cents:candidate.safe_cost_cents,fully_loaded_safe_cogs_cents:candidate.fully_loaded_safe_cogs_cents,
        status:candidate.status,priority:candidate.priority,is_healthy:candidate.is_healthy,
      })),
      reason,max_allowed_cogs_cents:max,incurred_cogs_cents:incurred,remaining_cogs_budget_cents:remaining,
      excluded_provider_ids:[...excluded],created_at:new Date().toISOString(),
    };
    await firestoreAdminRest.set(`routing_logs/${encodeURIComponent(log.log_id)}`,log).catch(()=>{});
    return{selected,candidates,reason,strategy:'CHEAPEST_RELIABLE',remaining_cogs_budget_cents:remaining};
  },

  async listRoutingLogs(limit=50){
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:'routing_logs'}],orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit,
    }).catch(()=>[]as any[]);
    return rows.map((row:any)=>row.data);
  },
};
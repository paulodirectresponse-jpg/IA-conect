import crypto from 'crypto';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { creditWalletService } from '../../services/creditWalletService.js';
import { betaFlowService } from './flowService.js';
import { BetaFlowNodeRun } from './flowRuntimeTypes.js';
import { betaFlowEconomicsRepository } from './flowEconomicsRepository.js';
import { BetaFlowBudgetQuote,BetaFlowEconomicSummary,BetaFlowRunEconomics } from './flowEconomicsTypes.js';

const now=()=>new Date().toISOString();
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
async function assertEnabled(){
  const [economics,guard]=await Promise.all([
    catalogRepository.getFeatureFlag('beta.flow_economics'),
    catalogRepository.getFeatureFlag('beta.flow_economics.budget_guard'),
  ]);
  if(!economics?.is_enabled)fail('FLOW_ECONOMICS_DISABLED','A economia de Fluxos está temporariamente indisponível.');
  if(!guard?.is_enabled)fail('FLOW_BUDGET_GUARD_DISABLED','A proteção de orçamento de Fluxos está temporariamente indisponível.');
}
function budget(value:any){
  const parsed=Math.floor(Number(value));
  if(!Number.isFinite(parsed)||parsed<1||parsed>1_000_000)fail('FLOW_BUDGET_INVALID','Defina um orçamento entre 1 e 1.000.000 créditos.');
  return parsed;
}
export const betaFlowEconomicsService={
  async quote(userId:string,flowId:string,input:any):Promise<BetaFlowBudgetQuote>{
    await assertEnabled();
    const flow=await betaFlowService.get(userId,flowId);
    const account=await creditWalletService.getAccount(userId);
    const limit=budget(input?.max_credits??account.available_credits);
    const simulation=await creditWalletService.simulateReserve(userId,limit);
    if(!simulation.has_sufficient_credits)fail('FLOW_BUDGET_INSUFFICIENT_CREDITS',`Faltam ${simulation.missing_credits} créditos para autorizar este orçamento.`);
    const timestamp=new Date(),quoteId=`fquote_${crypto.randomUUID()}`;
    const quote:BetaFlowBudgetQuote={
      flow_quote_id:quoteId,user_id:userId,flow_id:flow.flow_id,flow_revision:flow.revision,budget_credit_limit:limit,
      available_credits:account.available_credits,covered:true,
      signature_hash:hash(`${userId}:${flow.flow_id}:${flow.revision}:${limit}`),created_at:timestamp.toISOString(),expires_at:new Date(timestamp.getTime()+10*60*1000).toISOString(),
    };
    return betaFlowEconomicsRepository.save(quote);
  },
  async authorizeRun(userId:string,flowId:string,flowRevision:number,quoteId:string){
    await assertEnabled();
    const quote=await betaFlowEconomicsRepository.get(String(quoteId||''),userId);
    if(!quote||quote.flow_id!==flowId)fail('FLOW_QUOTE_NOT_FOUND','Autorização econômica do Flow não encontrada.');
    if(quote.flow_revision!==flowRevision)fail('FLOW_QUOTE_REVISION_CHANGED','O Flow mudou após a autorização. Gere um novo orçamento.');
    if(Date.parse(quote.expires_at)<=Date.now())fail('FLOW_QUOTE_EXPIRED','A autorização de orçamento expirou. Gere uma nova.');
    const simulation=await creditWalletService.simulateReserve(userId,quote.budget_credit_limit);
    if(!simulation.has_sufficient_credits)fail('FLOW_BUDGET_INSUFFICIENT_CREDITS','Os créditos disponíveis mudaram. Autorize um novo orçamento.');
    return quote;
  },
  async bindRun(userId:string,run:{run_id:string;flow_id:string;flow_revision:number},quote:BetaFlowBudgetQuote){
    const timestamp=now();
    const binding:BetaFlowRunEconomics={run_id:run.run_id,user_id:userId,flow_id:run.flow_id,flow_revision:run.flow_revision,flow_quote_id:quote.flow_quote_id,budget_credit_limit:quote.budget_credit_limit,created_at:timestamp,updated_at:timestamp};
    return betaFlowEconomicsRepository.bindRun(binding);
  },
  async binding(userId:string,runId:string){
    await assertEnabled();
    const binding=await betaFlowEconomicsRepository.getRun(runId,userId);
    if(!binding)fail('FLOW_BUDGET_REQUIRED','Esta execução não possui autorização econômica.');
    return binding;
  },
  summarize(limitValue:number,nodeRuns:BetaFlowNodeRun[]):BetaFlowEconomicSummary{
    const limit=Math.max(0,Number(limitValue||0));
    const captured=nodeRuns.filter(item=>item.status==='SUCCEEDED').reduce((sum,item)=>sum+Math.max(0,Number(item.authorized_credit_price||0)),0);
    const released=nodeRuns.filter(item=>item.status==='FAILED'||item.status==='CANCELLED').reduce((sum,item)=>sum+Math.max(0,Number(item.authorized_credit_price||0)),0);
    const inFlight=nodeRuns.filter(item=>item.status==='RUNNING').reduce((sum,item)=>sum+Math.max(0,Number(item.authorized_credit_price||0)),0);
    const authorized=captured+inFlight;
    const remaining=Math.max(0,limit-authorized);
    const status=authorized>limit?'EXCEEDED':authorized===limit&&limit>0?'AT_LIMIT':'WITHIN_BUDGET';
    return{budget_credit_limit:limit,authorized_credits_total:authorized,captured_credits_total:captured,released_credits_total:released,in_flight_credits_total:inFlight,remaining_budget_credits:remaining,status};
  },
  committed(nodeRuns:BetaFlowNodeRun[]){
    return nodeRuns.filter(item=>item.status==='SUCCEEDED'||item.status==='RUNNING').reduce((sum,item)=>sum+Math.max(0,Number(item.authorized_credit_price||0)),0);
  },
};

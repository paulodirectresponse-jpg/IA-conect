import { betaFlowService } from './flowService.js';
import { betaFlowRuntimeService } from './flowRuntimeService.js';
import { betaFlowEconomicsService } from './flowEconomicsService.js';
import { betaFlowEconomicsRepository } from './flowEconomicsRepository.js';
import { flowEconomicsContext } from './flowEconomicsContext.js';

async function decorate(userId:string,run:any){
  const binding=await betaFlowEconomicsRepository.getRun(run.run_id,userId);
  if(!binding)return{...run,economics:null};
  const economics=betaFlowEconomicsService.summarize(binding.budget_credit_limit,run.node_runs||[]);
  return{...run,flow_quote_id:binding.flow_quote_id,budget_credit_limit:binding.budget_credit_limit,economics};
}
async function ensureBinding(userId:string,run:any){
  const existing=await betaFlowEconomicsRepository.getRun(run.run_id,userId);
  if(existing)return existing;
  const quote=await betaFlowEconomicsService.quote(userId,run.flow_id,{});
  return betaFlowEconomicsService.bindRun(userId,run,quote);
}
async function runWithBudget<T>(userId:string,run:any,binding:any,work:()=>Promise<T>){
  const committed=betaFlowEconomicsService.committed(run.node_runs||[]);
  return flowEconomicsContext.run({run_id:run.run_id,budget_credit_limit:binding.budget_credit_limit,committed_credits:committed},work);
}

export const betaFlowEconomicRuntimeService={
  quote(userId:string,flowId:string,input:any){return betaFlowEconomicsService.quote(userId,flowId,input);},

  async start(userId:string,flowId:string,input:any,idempotencyKey:string,reqHost?:string,idToken?:string){
    const flow=await betaFlowService.get(userId,flowId);
    const quote=input?.flow_quote_id
      ?await betaFlowEconomicsService.authorizeRun(userId,flowId,flow.revision,String(input.flow_quote_id))
      :await betaFlowEconomicsService.quote(userId,flowId,{max_credits:input?.max_credits});
    const run=await flowEconomicsContext.run({run_id:null,budget_credit_limit:quote.budget_credit_limit,committed_credits:0},()=>betaFlowRuntimeService.start(userId,flowId,input,idempotencyKey,reqHost,idToken));
    await betaFlowEconomicsService.bindRun(userId,run,quote);
    return decorate(userId,run);
  },

  async advance(userId:string,runId:string,reqHost?:string,idToken?:string){
    const current=await betaFlowRuntimeService.getPublic(userId,runId);
    const binding=await ensureBinding(userId,current);
    const run=await runWithBudget(userId,current,binding,()=>betaFlowRuntimeService.advance(userId,runId,reqHost,idToken));
    return decorate(userId,run);
  },

  async retry(userId:string,runId:string,reqHost?:string,idToken?:string){
    const current=await betaFlowRuntimeService.getPublic(userId,runId);
    const binding=await ensureBinding(userId,current);
    const run=await runWithBudget(userId,current,binding,()=>betaFlowRuntimeService.retry(userId,runId,reqHost,idToken));
    return decorate(userId,run);
  },

  async cancel(userId:string,runId:string){return decorate(userId,await betaFlowRuntimeService.cancel(userId,runId));},
  async getPublic(userId:string,runId:string){return decorate(userId,await betaFlowRuntimeService.getPublic(userId,runId));},
  async listPublic(userId:string,limit=30){return Promise.all((await betaFlowRuntimeService.listPublic(userId,limit)).map(run=>decorate(userId,run)));},
};

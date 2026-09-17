import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaFlowBudgetQuote,BetaFlowRunEconomics } from './flowEconomicsTypes.js';

const safe=(value:string)=>encodeURIComponent(value);
const QUOTES='beta_flow_budget_quotes';
const RUNS='beta_flow_run_economics';

export const betaFlowEconomicsRepository={
  async get(quoteId:string,userId:string):Promise<BetaFlowBudgetQuote|null>{
    const doc=await firestoreAdminRest.get(`${QUOTES}/${safe(quoteId)}`);
    if(!doc.exists)return null;
    const quote=doc.data as BetaFlowBudgetQuote;
    return quote.user_id===userId?quote:null;
  },
  async save(quote:BetaFlowBudgetQuote){
    await firestoreAdminRest.set(`${QUOTES}/${safe(quote.flow_quote_id)}`,quote);
    return quote;
  },
  async bindRun(binding:BetaFlowRunEconomics){
    const path=`${RUNS}/${safe(binding.run_id)}`;
    const existing=await firestoreAdminRest.get(path);
    if(existing.exists){
      const row=existing.data as BetaFlowRunEconomics;
      if(row.user_id!==binding.user_id||row.flow_quote_id!==binding.flow_quote_id)throw Object.assign(new Error('A execução já possui outra autorização econômica.'),{code:'FLOW_ECONOMICS_CONFLICT'});
      return row;
    }
    await firestoreAdminRest.set(path,binding);
    return binding;
  },
  async getRun(runId:string,userId:string):Promise<BetaFlowRunEconomics|null>{
    const doc=await firestoreAdminRest.get(`${RUNS}/${safe(runId)}`);
    if(!doc.exists)return null;
    const row=doc.data as BetaFlowRunEconomics;
    return row.user_id===userId?row:null;
  },
};

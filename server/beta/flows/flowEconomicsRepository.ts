import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaFlowBudgetQuote } from './flowEconomicsTypes.js';

const safe=(value:string)=>encodeURIComponent(value);
const COLLECTION='beta_flow_budget_quotes';

export const betaFlowEconomicsRepository={
  async get(quoteId:string,userId:string):Promise<BetaFlowBudgetQuote|null>{
    const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(quoteId)}`);
    if(!doc.exists)return null;
    const quote=doc.data as BetaFlowBudgetQuote;
    return quote.user_id===userId?quote:null;
  },
  async save(quote:BetaFlowBudgetQuote){
    await firestoreAdminRest.set(`${COLLECTION}/${safe(quote.flow_quote_id)}`,quote);
    return quote;
  },
};

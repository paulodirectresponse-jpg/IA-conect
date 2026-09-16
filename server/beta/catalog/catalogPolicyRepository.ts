import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaEconomicLedgerEvent, BetaModelPolicy, BetaPricingPolicy } from './catalogPolicyTypes.js';

const safe=(value:string)=>encodeURIComponent(value);
const now=()=>new Date().toISOString();

const DEFAULT_PRICING_POLICY:BetaPricingPolicy={
  pricing_policy_id:'beta-default-v1',
  name:'Beta Default',
  quote_ttl_seconds:600,
  active:true,
  created_at:new Date(0).toISOString(),
  updated_at:new Date(0).toISOString(),
  updated_by:null,
};

async function list<T>(collectionId:string,limit=500):Promise<T[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId}],limit});
  return rows.map((row:any)=>row.data as T);
}

export const catalogPolicyRepository={
  async listPricingPolicies():Promise<BetaPricingPolicy[]>{
    const rows=await list<BetaPricingPolicy>('beta_pricing_policies',100);
    if(rows.some(row=>row.pricing_policy_id===DEFAULT_PRICING_POLICY.pricing_policy_id))return rows;
    try{
      await firestoreAdminRest.commit([{
        update:{name:firestoreAdminRest.docName(`beta_pricing_policies/${safe(DEFAULT_PRICING_POLICY.pricing_policy_id)}`),fields:firestoreAdminRest.fields(DEFAULT_PRICING_POLICY)},
        currentDocument:{exists:false},
      }]);
      return [...rows,DEFAULT_PRICING_POLICY];
    }catch{
      return list<BetaPricingPolicy>('beta_pricing_policies',100);
    }
  },

  async getPricingPolicy(id:string):Promise<BetaPricingPolicy|null>{
    await this.listPricingPolicies();
    const doc=await firestoreAdminRest.get(`beta_pricing_policies/${safe(id)}`);
    return doc.exists?doc.data as BetaPricingPolicy:null;
  },

  async savePricingPolicy(value:BetaPricingPolicy){
    const next={...value,updated_at:now()};
    await firestoreAdminRest.set(`beta_pricing_policies/${safe(value.pricing_policy_id)}`,next);
    return next;
  },

  async listModelPolicies():Promise<BetaModelPolicy[]>{
    return list<BetaModelPolicy>('beta_model_policies',500);
  },

  async getModelPolicy(modelId:string):Promise<BetaModelPolicy|null>{
    const doc=await firestoreAdminRest.get(`beta_model_policies/${safe(modelId)}`);
    return doc.exists?doc.data as BetaModelPolicy:null;
  },

  async saveModelPolicy(value:BetaModelPolicy){
    const next={...value,updated_at:now()};
    await firestoreAdminRest.set(`beta_model_policies/${safe(value.model_id)}`,next);
    return next;
  },

  async recordEconomicEvent(event:BetaEconomicLedgerEvent){
    const path=`beta_economic_ledger/${safe(event.event_id)}`;
    try{
      await firestoreAdminRest.commit([{
        update:{name:firestoreAdminRest.docName(path),fields:firestoreAdminRest.fields(event)},
        currentDocument:{exists:false},
      }]);
      return event;
    }catch{
      const existing=await firestoreAdminRest.get(path);
      if(existing.exists)return existing.data as BetaEconomicLedgerEvent;
      throw new Error('Não foi possível registrar o evento econômico Beta.');
    }
  },

  async listEconomicLedger(limit=100):Promise<BetaEconomicLedgerEvent[]>{
    const bounded=Math.min(500,Math.max(1,limit));
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:'beta_economic_ledger'}],
      orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],
      limit:bounded,
    });
    return rows.map((row:any)=>row.data as BetaEconomicLedgerEvent);
  },
};

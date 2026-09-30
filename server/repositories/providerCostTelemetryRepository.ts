import { firestoreAdminRest } from './firestoreAdminRest.js';

const collection='generation_economics';

export function normalizeProviderCostUsd(value:unknown):number|null{
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
  return value;
}

export async function saveRunwareProviderCost(generationId:string,costUsd:number){
  const cost=normalizeProviderCostUsd(costUsd);
  if(!String(generationId||'').trim()||cost===null)throw Object.assign(new Error('Custo Runware inválido para registro.'),{code:'PROVIDER_COST_INVALID'});
  const path=`${collection}/${encodeURIComponent(generationId)}`;
  for(let attempt=0;attempt<3;attempt++){
    const existing=await firestoreAdminRest.get(path);
    const previous=existing.exists?(existing.data as Record<string,any>):{};
    const previousCost=normalizeProviderCostUsd(previous.provider_reported_cost_usd);
    if(previousCost!==null){
      if(previousCost===cost)return previous;
      throw Object.assign(new Error('O Runware retornou custos diferentes para a mesma geração.'),{code:'PROVIDER_COST_CONFLICT'});
    }
    const now=new Date().toISOString();
    const next={...previous,generation_id:generationId,provider_reported_cost_usd:cost,provider_reported_cost_currency:'USD',provider_reported_cost_source:'RUNWARE_TASK_RESPONSE',provider_reported_cost_recorded_at:now,updated_at:now};
    try{
      await firestoreAdminRest.commit([{
        update:{name:firestoreAdminRest.docName(path),fields:firestoreAdminRest.fields(next)},
        currentDocument:existing.exists?{updateTime:existing.updateTime}:{exists:false},
      }]);
      return next;
    }catch(error){
      const latest=await firestoreAdminRest.get(path).catch(()=>({exists:false,data:null,updateTime:null} as any));
      const latestCost=normalizeProviderCostUsd(latest.data?.provider_reported_cost_usd);
      if(latestCost===cost)return latest.data;
      if(latestCost!==null)throw Object.assign(new Error('O Runware retornou custos diferentes para a mesma geração.'),{code:'PROVIDER_COST_CONFLICT'});
      if(attempt===2)throw error;
    }
  }
  throw new Error('Não foi possível registrar o custo informado pelo Runware.');
}

import { AsyncLocalStorage } from 'node:async_hooks';

interface FlowBudgetContext{
  run_id:string|null;
  budget_credit_limit:number;
  committed_credits:number;
  authorized_in_request:number;
}

const storage=new AsyncLocalStorage<FlowBudgetContext>();

export const flowEconomicsContext={
  run<T>(input:{run_id?:string|null;budget_credit_limit:number;committed_credits:number},work:()=>Promise<T>){
    return storage.run({run_id:input.run_id||null,budget_credit_limit:Math.max(0,Math.floor(input.budget_credit_limit)),committed_credits:Math.max(0,Math.floor(input.committed_credits)),authorized_in_request:0},work);
  },
  authorize(credits:number){
    const ctx=storage.getStore();
    if(!ctx)return;
    const price=Math.max(0,Math.floor(Number(credits||0)));
    const projected=ctx.committed_credits+ctx.authorized_in_request+price;
    if(projected>ctx.budget_credit_limit){
      throw Object.assign(new Error(`A próxima etapa elevaria o Flow para ${projected} créditos, acima do limite autorizado de ${ctx.budget_credit_limit}.`),{code:'FLOW_BUDGET_EXCEEDED'});
    }
    ctx.authorized_in_request+=price;
  },
  current(){return storage.getStore()||null;},
};

import { RoutingV2BillingInput, RoutingV2BillingResult } from './billingEngine.js';
import { RoutingV2BillingConfig } from './domain.js';

export type RoutingV2CustomFormulaConfig=Extract<RoutingV2BillingConfig,{type:'CUSTOM_FORMULA'}>;
export type RoutingV2CustomFormulaEvaluator=(config:RoutingV2CustomFormulaConfig,input:RoutingV2BillingInput)=>Omit<RoutingV2BillingResult,'currency'|'billing_type'>;

class RoutingV2CustomFormulaRegistry{
  private formulas=new Map<string,RoutingV2CustomFormulaEvaluator>();

  register(formulaId:string,evaluator:RoutingV2CustomFormulaEvaluator){
    const id=String(formulaId||'').trim();
    if(!id)throw new Error('CUSTOM_FORMULA exige formula_id.');
    if(this.formulas.has(id))throw new Error(`CUSTOM_FORMULA já registrada: ${id}`);
    this.formulas.set(id,evaluator);
  }

  evaluate(config:RoutingV2CustomFormulaConfig,input:RoutingV2BillingInput){
    const evaluator=this.formulas.get(config.formula_id);
    if(!evaluator)throw Object.assign(new Error(`CUSTOM_FORMULA não registrada: ${config.formula_id}`),{code:'ROUTING_V2_CUSTOM_FORMULA_UNAVAILABLE'});
    const result=evaluator(config,input);
    if(!Number.isFinite(result.amount)||result.amount<0)throw new Error('CUSTOM_FORMULA retornou custo inválido.');
    if(!Number.isFinite(result.quantity)||result.quantity<=0)throw new Error('CUSTOM_FORMULA retornou quantidade inválida.');
    if(!String(result.unit_label||'').trim())throw new Error('CUSTOM_FORMULA retornou unidade inválida.');
    return result;
  }

  has(formulaId:string){
    return this.formulas.has(String(formulaId||'').trim());
  }

  clearForTests(){
    this.formulas.clear();
  }
}

export const routingV2CustomFormulaRegistry=new RoutingV2CustomFormulaRegistry();

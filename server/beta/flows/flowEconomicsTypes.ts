export type BetaFlowEconomicStatus='WITHIN_BUDGET'|'AT_LIMIT'|'EXCEEDED';

export interface BetaFlowBudgetQuote{
  flow_quote_id:string;
  user_id:string;
  flow_id:string;
  flow_revision:number;
  budget_credit_limit:number;
  available_credits:number;
  covered:boolean;
  signature_hash:string;
  created_at:string;
  expires_at:string;
}

export interface BetaFlowEconomicSummary{
  budget_credit_limit:number;
  authorized_credits_total:number;
  captured_credits_total:number;
  released_credits_total:number;
  in_flight_credits_total:number;
  remaining_budget_credits:number;
  status:BetaFlowEconomicStatus;
}

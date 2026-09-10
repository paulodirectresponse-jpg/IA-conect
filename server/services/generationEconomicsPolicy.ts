export interface GenerationExecutionEconomics {
  authorized_credit_price:number;
  cash_backing_micros:number;
  cash_backing_cents:number;
  execution_cogs_cap_cents:number;
  subsidy_gap_cents:number;
}

/**
 * Credits are a spendable customer entitlement.
 * Promotional/bonus credits may intentionally have zero cash backing and must
 * still be executable. Cash backing remains an internal profitability metric;
 * it is never a per-generation authorization gate.
 *
 * One IA Connect credit has a face value of one centavo for execution caps.
 * The hard execution cap prevents a provider route from costing more than the
 * authorized retail face value while allowing intentional pack/coupon subsidy.
 */
export function generationExecutionEconomics(
  authorizedCreditPrice:number,
  cashBackingMicros:number,
):GenerationExecutionEconomics {
  const credits=Math.max(0,Math.floor(Number(authorizedCreditPrice)||0));
  const backingMicros=Math.max(0,Math.floor(Number(cashBackingMicros)||0));
  const backingCents=Math.max(0,Math.floor(backingMicros/10000));
  const executionCap=Math.max(1,credits);
  return {
    authorized_credit_price:credits,
    cash_backing_micros:backingMicros,
    cash_backing_cents:backingCents,
    execution_cogs_cap_cents:executionCap,
    subsidy_gap_cents:Math.max(0,executionCap-backingCents),
  };
}

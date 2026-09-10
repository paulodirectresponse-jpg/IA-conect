import { describe, expect, it } from 'vitest';
import { generationExecutionEconomics } from './generationEconomicsPolicy.js';

describe('generation execution economics',()=>{
  it('allows promotional credits to execute even with zero cash backing',()=>{
    const result=generationExecutionEconomics(375,0);
    expect(result.execution_cogs_cap_cents).toBe(375);
    expect(result.cash_backing_cents).toBe(0);
    expect(result.subsidy_gap_cents).toBe(375);
  });

  it('keeps purchased backing as analytics without shrinking the execution right',()=>{
    const result=generationExecutionEconomics(375,3_450_000);
    expect(result.cash_backing_cents).toBe(345);
    expect(result.execution_cogs_cap_cents).toBe(375);
    expect(result.subsidy_gap_cents).toBe(30);
  });

  it('uses one credit as one centavo of execution face value',()=>{
    expect(generationExecutionEconomics(80,736_000).execution_cogs_cap_cents).toBe(80);
  });
});

import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-14 Flow Economics contracts',()=>{
 it('defines budget quote and runtime economic summary contracts',()=>{
  const types=read('server/beta/flows/flowEconomicsTypes.ts');
  expect(types).toContain('BetaFlowBudgetQuote');
  expect(types).toContain('budget_credit_limit:number');
  expect(types).toContain('captured_credits_total:number');
  expect(types).toContain('released_credits_total:number');
  expect(types).toContain('in_flight_credits_total:number');
  expect(types).toContain("'WITHIN_BUDGET'|'AT_LIMIT'|'EXCEEDED'");
 });
 it('binds authorizations to exact Flow revision and expiry',()=>{
  const service=read('server/beta/flows/flowEconomicsService.ts');
  expect(service).toContain('quote.flow_revision!==flowRevision');
  expect(service).toContain('FLOW_QUOTE_REVISION_CHANGED');
  expect(service).toContain('Date.parse(quote.expires_at)<=Date.now()');
  expect(service).toContain('FLOW_QUOTE_EXPIRED');
 });
 it('preflights available credits without reserving them twice',()=>{
  const service=read('server/beta/flows/flowEconomicsService.ts');
  expect(service).toContain('creditWalletService.simulateReserve');
  expect(service).toContain('FLOW_BUDGET_INSUFFICIENT_CREDITS');
  expect(service).not.toContain('reserveForGeneration');
 });
 it('exposes frontend quote and optional explicit budget authorization',()=>{
  const client=read('src/beta/flowRuntimeClient.ts');
  expect(client).toContain('quoteBudget(flowId:string,maxCredits:number)');
  expect(client).toContain('flow_quote_id?:string');
  expect(client).toContain('max_credits?:number');
 });
});

import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-14 Flow Economics architecture',()=>{
 it('keeps Universal Jobs as the only credit charging path',()=>{
  const flow=read('server/beta/flows/flowEconomicsService.ts');
  const wrapper=read('server/beta/flows/flowEconomicRuntimeService.ts');
  expect(flow).toContain('creditWalletService.simulateReserve');
  expect(flow).not.toMatch(/reserveForGeneration|captureForGeneration|settleGeneration/);
  expect(wrapper).toContain('betaFlowRuntimeService.start');
  expect(wrapper).not.toMatch(/generationService|providerAdapter|wavespeed|atlas/i);
 });
 it('guards every node quote before Universal Job queueing',()=>{
  const economics=read('server/beta/catalog/betaEconomicsService.ts');
  const context=read('server/beta/flows/flowEconomicsContext.ts');
  expect(economics).toContain('flowEconomicsContext.authorize');
  expect(context).toContain('FLOW_BUDGET_EXCEEDED');
  expect(context).toContain('projected>ctx.budget_credit_limit');
 });
 it('scopes budget accounting to one async Flow request',()=>{
  const context=read('server/beta/flows/flowEconomicsContext.ts');
  expect(context).toContain("AsyncLocalStorage");
  expect(context).toContain('authorized_in_request');
  expect(context).toContain('committed_credits+ctx.authorized_in_request+price');
 });
 it('persists quotes and immutable run bindings separately from wallet data',()=>{
  const repo=read('server/beta/flows/flowEconomicsRepository.ts');
  expect(repo).toContain("beta_flow_budget_quotes");
  expect(repo).toContain("beta_flow_run_economics");
  expect(repo).toContain('FLOW_ECONOMICS_CONFLICT');
  expect(repo).not.toMatch(/credit_accounts|credit_lots|credit_reservations/);
 });
 it('routes all public runtime calls through the economic wrapper',()=>{
  const routes=read('server/routes/betaFlowRuntimeRoutes.ts');
  expect(routes).toContain('betaFlowEconomicRuntimeService.start');
  expect(routes).toContain('betaFlowEconomicRuntimeService.advance');
  expect(routes).toContain('betaFlowEconomicRuntimeService.retry');
  expect(routes).toContain("/economics/quote");
  expect(routes).not.toContain('betaFlowRuntimeService.');
 });
});

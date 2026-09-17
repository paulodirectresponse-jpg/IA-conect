import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-14 Flow Economics release',()=>{
 it('ships public economics and private budget-guard kill switches',()=>{
  const flags=read('src/beta/betaFlags.ts');
  expect(flags).toContain("flag_key: 'beta.flow_economics'");
  expect(flags).toContain("flag_key: 'beta.flow_economics.budget_guard'");
  expect(flags).toContain("name: 'Beta · Flow Budget Guard'");
 });
 it('keeps run creation idempotency under the economic wrapper',()=>{
  const wrapper=read('server/beta/flows/flowEconomicRuntimeService.ts');
  const runtime=read('server/beta/flows/flowRuntimeRepository.ts');
  expect(wrapper).toContain('idempotencyKey');
  expect(wrapper).toContain('betaFlowRuntimeService.start(userId,flowId,input,idempotencyKey');
  expect(runtime).toContain('beta_flow_run_idempotency');
 });
 it('makes a repeated run unable to silently switch economic authorization',()=>{
  const repo=read('server/beta/flows/flowEconomicsRepository.ts');
  expect(repo).toContain('row.flow_quote_id!==binding.flow_quote_id');
  expect(repo).toContain('FLOW_ECONOMICS_CONFLICT');
 });
 it('does not expose provider economics or COGS authority in React',()=>{
  const client=read('src/beta/flowRuntimeClient.ts');
  expect(client).not.toMatch(/provider_cost|safe_cogs|fully_loaded|provider_id|wavespeed|atlas/i);
 });
});

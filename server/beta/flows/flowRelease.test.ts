import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-12 Flow Editor release',()=>{
 it('releases beta.flows through a one-shot migration and keeps a kill switch',()=>{
  const flags=read('src/beta/betaFlags.ts');
  const catalog=read('server/repositories/catalogRepository.ts');
  expect(flags).toContain("flag_key: 'beta.flows'");
  expect(flags).toContain("is_enabled: true");
  expect(catalog).toContain('PR-12_FLOWS_EDITOR_V1');
  expect(catalog).toContain('beta_flows_v1_release');
 });
 it('registers the Flow router without altering Stable routes',()=>{
  const routes=read('server/routes/index.ts');
  expect(routes).toContain("import { betaFlowRouter } from './betaFlowRoutes.js'");
  expect(routes).toContain('apiRootRouter.use(betaFlowRouter)');
 });
 it('makes the module available from Beta Home and nav only',()=>{
  const home=read('src/beta/views/BetaHomeView.tsx');
  const app=read('src/beta/BetaApp.tsx');
  expect(home).toContain('flowsEnabled');
  expect(home).toContain('Abrir Flows Editor');
  expect(app).toContain("flags['beta.flows']");
 });
});

import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-15 Templates architecture',()=>{
 it('keeps templates as Flow snapshots instead of a second runtime',()=>{const service=read('server/beta/templates/templateService.ts');expect(service).toContain('betaFlowService.create');expect(service).not.toMatch(/betaJobOrchestrator|creditWalletService|createAndStartGeneration/);});
 it('converts private asset nodes into typed inputs',()=>{const service=read('server/beta/templates/templateService.ts');expect(service).toContain("node.kind==='ASSET'");expect(service).toContain("kind:'INPUT'");expect(service).toContain('asset_id:null');});
 it('enforces ownership through the source Flow and private template repository',()=>{const service=read('server/beta/templates/templateService.ts');const repo=read('server/beta/templates/templateRepository.ts');expect(service).toContain('betaFlowService.get(userId');expect(repo).toContain("fieldPath:'owner_user_id'");expect(repo).toContain("row.owner_user_id===userId");});
 it('instantiation creates a normal governed Flow',()=>{const service=read('server/beta/templates/templateService.ts');expect(service).toContain('betaFlowService.create(userId');expect(service).toContain('graph:template.graph');});
 it('does not expose providers or pricing in React',()=>{const ui=read('src/beta/views/BetaTemplatesView.tsx');expect(ui).not.toMatch(/wavespeed|atlas|provider_id|provider_model_identifier|credit_price|provider_cost/i);});
 it('lazy-loads Templates and preserves Stable isolation',()=>{const beta=read('src/beta/BetaApp.tsx');const stable=read('src/App.tsx');expect(beta).toContain("lazy(()=>import('./views/BetaTemplatesView.js')");expect(stable).not.toContain('BetaTemplatesView');expect(stable).not.toContain('templateClient');});
});

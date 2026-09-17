import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-15 Templates contracts',()=>{
 it('stores category tags source revision and a Flow graph snapshot',()=>{const types=read('server/beta/templates/templateTypes.ts');expect(types).toContain("'GENERIC'|'IMAGE'|'VIDEO'|'AUDIO'|'THREE_D'|'MULTIMODAL'");expect(types).toContain('source_flow_revision:number');expect(types).toContain('graph:BetaFlowGraph');expect(types).toContain("visibility:'PRIVATE'");});
 it('offers create update instantiate and delete routes',()=>{const routes=read('server/routes/betaTemplateRoutes.ts');expect(routes).toContain("post('/beta/templates'");expect(routes).toContain("patch('/beta/templates/:templateId'");expect(routes).toContain("post('/beta/templates/:templateId/instantiate'");expect(routes).toContain("delete('/beta/templates/:templateId'");});
 it('limits metadata sizes and tag cardinality',()=>{const service=read('server/beta/templates/templateService.ts');expect(service).toContain('clean(input?.name,100)');expect(service).toContain('clean(input?.description,400)');expect(service).toContain('.slice(0,12)');});
 it('persists only a private per-user gallery in V1',()=>{const repo=read('server/beta/templates/templateRepository.ts');expect(repo).toContain("collectionId:COLLECTION");expect(repo).toContain('owner_user_id');const types=read('server/beta/templates/templateTypes.ts');expect(types).toContain("visibility:'PRIVATE'");});
});

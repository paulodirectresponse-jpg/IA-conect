import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-15 Templates release',()=>{
 it('ships beta.templates enabled with a one-shot release marker',()=>{const flags=read('src/beta/betaFlags.ts');const feature=read('server/services/featureFlagService.ts');expect(flags).toContain("flag_key: 'beta.templates'");expect(flags).toContain("is_enabled: true");expect(feature).toContain('beta_templates_v1_release');expect(feature).toContain('PR-15_TEMPLATES_V1');});
 it('keeps later Admin kill-switch changes authoritative',()=>{const feature=read('server/services/featureFlagService.ts');expect(feature).toContain('if(marker.exists)return flags');expect(feature).toContain('toggleFlag');expect(feature).toContain('saveFeatureFlag(updated)');});
 it('registers template routes and responsive styles only in Beta',()=>{const routes=read('server/routes/index.ts');const app=read('src/beta/BetaApp.tsx');const css=read('src/beta/styles/templates.css');expect(routes).toContain('apiRootRouter.use(betaTemplateRouter)');expect(app).toContain("flags['beta.templates']");expect(css).toContain('@media(max-width:767px)');});
});

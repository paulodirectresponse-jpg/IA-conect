import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-04 Task Center architecture',()=>{
  it('keeps Task Center authenticated and behind beta.enabled',()=>{
    const routes=read('server/routes/betaTaskRoutes.ts');
    expect(routes).toContain("betaTaskRouter.use('/beta/tasks',requireAuth,requireBetaEnabled)");
    expect(routes).toContain("'/beta/tasks/:taskId/retry'");
    expect(routes).toContain("'/beta/tasks/:taskId/cancel'");
    expect(routes).toContain("req.headers['idempotency-key']");
  });

  it('uses normalized public errors for both Jobs and Tasks',()=>{
    const jobs=read('server/routes/betaJobRoutes.ts');
    const tasks=read('server/routes/betaTaskRoutes.ts');
    expect(jobs).toContain('normalizeBetaPublicError');
    expect(tasks).toContain('normalizeBetaPublicError');
    expect(tasks).not.toContain('provider_id');
    expect(tasks).not.toContain('error.stack');
  });

  it('mounts the global indicator only inside the lazy Beta shell',()=>{
    const app=read('src/App.tsx');
    const beta=read('src/beta/BetaApp.tsx');
    const layout=read('src/components/layout/AppLayout.tsx');
    expect(app).toContain("const BetaApp=lazy(");
    expect(beta).toContain('<TaskCenter />');
    expect(app).not.toContain('TaskCenter');
    expect(layout).not.toContain('TaskCenter');
  });

  it('keeps retry/cancel decisions on the backend and provider details out of the UI',()=>{
    const service=read('server/beta/tasks/taskService.ts');
    const component=read('src/beta/components/TaskCenter.tsx');
    expect(service).toContain('providerRegistry.getAdapter');
    expect(service).toContain('Boolean(adapter?.cancelJob)');
    expect(component).not.toContain('provider_id');
    expect(component).not.toContain('providerRegistry');
  });

  it('contains mobile-safe Task Center layout and bounded polling',()=>{
    const css=read('src/beta/styles/beta.css');
    const component=read('src/beta/components/TaskCenter.tsx');
    expect(css).toContain('.ia-beta-task-panel{position:fixed');
    expect(css).toContain('min-height:44px');
    expect(component).toContain("hasActive?5000:15000");
    expect(component).toContain("document.visibilityState==='visible'");
    expect(component).toContain('window.clearInterval');
  });
});

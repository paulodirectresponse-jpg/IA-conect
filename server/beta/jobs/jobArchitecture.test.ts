import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-03 architecture',()=>{
  it('requires authenticated Beta routes and Idempotency-Key mutations',()=>{
    const routes=read('server/routes/betaJobRoutes.ts');
    expect(routes).toContain("betaJobRouter.use('/beta/jobs',requireAuth,requireBetaEnabled)");
    expect(routes).toContain("req.headers['idempotency-key']");
    expect(routes).toContain("'/beta/jobs/:jobId/retry'");
  });

  it('routes execution through generationService without direct provider access',()=>{
    const orchestrator=read('server/beta/jobs/jobOrchestrator.ts');
    expect(orchestrator).toContain('generationService.createAndStartGeneration');
    expect(orchestrator).toContain('client_request_id:currentAttempt.execution_key');
    expect(orchestrator).toContain('findByClientRequest(userId,currentAttempt.execution_key)');
    expect(orchestrator).toContain('betaEconomicsService.assertExecutionEnabled');
    const economics=read('server/beta/catalog/betaEconomicsService.ts');
    expect(economics).toContain('billingControlService.assertNewGenerationAllowed');
    expect(orchestrator).not.toContain('providerRegistry');
    expect(orchestrator).not.toContain('submitGeneration(');
  });

  it('preserves the existing credit idempotency guard before any reservation',()=>{
    const generation=read('server/services/generationService.ts');
    const dedupe=generation.indexOf('findByClientRequest(params.userId,clientId)');
    const reserve=generation.indexOf('reserveForGeneration');
    expect(dedupe).toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(dedupe);
  });

  it('keeps a replaceable queue boundary and refresh persistence in the Beta client',()=>{
    const queue=read('server/beta/jobs/jobQueue.ts');
    const client=read('src/beta/jobClient.ts');
    expect(queue).toContain('export interface BetaJobQueue');
    expect(queue).toContain('enqueue(');
    expect(client).toContain('restoreRemembered');
    expect(client).toContain('localStorage');
    expect(client).not.toMatch(/provider_id|providerRegistry|submitGeneration/);
  });
});

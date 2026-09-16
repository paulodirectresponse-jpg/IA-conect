import { describe,expect,it } from 'vitest';
import { idempotencyFingerprint } from './jobRepository.js';
import { publicBetaJob } from './jobOrchestrator.js';
import { BetaJob,BetaJobAttempt } from './jobTypes.js';

describe('PR-03 job contract',()=>{
  it('produces stable scoped idempotency fingerprints',()=>{
    const a=idempotencyFingerprint('user-1','CREATE','same-key');
    const b=idempotencyFingerprint('user-1','CREATE','same-key');
    const c=idempotencyFingerprint('user-1','QUEUE:job-1','same-key');
    const d=idempotencyFingerprint('user-1','CREATE','other-key');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never exposes internal idempotency or execution keys in the public job',()=>{
    const job:BetaJob={
      job_id:'bjob_1',user_id:'user-1',status:'RUNNING',request:{capability_id:'text-to-image',model_id:'gpt-image-2',prompt:'teste',references:[],controls:{}},
      quote:null,linked_generation_id:'gen_1',current_attempt_id:'batt_1',attempt_count:1,idempotency_fingerprint:'internal-create-hash',
      created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',
    };
    const attempt:BetaJobAttempt={
      attempt_id:'batt_1',job_id:'bjob_1',user_id:'user-1',attempt_number:1,status:'RUNNING',
      execution_key:'beta-job:bjob_1:attempt:1',generation_id:'gen_1',created_at:job.created_at,updated_at:job.updated_at,
    };
    const json=JSON.stringify(publicBetaJob(job,[attempt]));
    expect(json).not.toContain('idempotency_fingerprint');
    expect(json).not.toContain('execution_key');
    expect(json).not.toContain('internal-create-hash');
    expect(json).not.toContain('beta-job:bjob_1:attempt:1');
  });
});

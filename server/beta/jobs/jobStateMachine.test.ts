import { describe,expect,it } from 'vitest';
import { canTransitionJob,generationStatusToJobStatus,isTerminalJobStatus } from './jobStateMachine.js';

describe('PR-03 universal job state machine',()=>{
  it('supports the official lifecycle and blocks invalid backwards transitions',()=>{
    expect(canTransitionJob('DRAFT','QUOTED')).toBe(true);
    expect(canTransitionJob('QUOTED','QUEUED')).toBe(true);
    expect(canTransitionJob('QUEUED','RUNNING')).toBe(true);
    expect(canTransitionJob('RUNNING','SUCCEEDED')).toBe(true);
    expect(canTransitionJob('RUNNING','FAILED')).toBe(true);
    expect(canTransitionJob('RUNNING','CANCELLED')).toBe(true);
    expect(canTransitionJob('SUCCEEDED','RUNNING')).toBe(false);
    expect(canTransitionJob('DRAFT','RUNNING')).toBe(false);
  });

  it('maps Stable generation states into universal job states',()=>{
    expect(generationStatusToJobStatus('QUEUED')).toBe('RUNNING');
    expect(generationStatusToJobStatus('PROCESSING')).toBe('RUNNING');
    expect(generationStatusToJobStatus('SUCCEEDED')).toBe('SUCCEEDED');
    expect(generationStatusToJobStatus('FAILED')).toBe('FAILED');
    expect(generationStatusToJobStatus('CANCELLED')).toBe('CANCELLED');
    expect(generationStatusToJobStatus('REFUNDED')).toBe('FAILED');
  });

  it('recognizes only final job states as terminal',()=>{
    expect(isTerminalJobStatus('SUCCEEDED')).toBe(true);
    expect(isTerminalJobStatus('FAILED')).toBe(true);
    expect(isTerminalJobStatus('CANCELLED')).toBe(true);
    expect(isTerminalJobStatus('RUNNING')).toBe(false);
  });
});

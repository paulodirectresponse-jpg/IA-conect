import { describe,expect,it } from 'vitest';
import { betaTaskStatusFromJobStatus } from './taskService.js';

describe('PR-04 Task Center status projection',()=>{
  it('projects only executable job states into the Task Center vocabulary',()=>{
    expect(betaTaskStatusFromJobStatus('QUEUED')).toBe('QUEUED');
    expect(betaTaskStatusFromJobStatus('RUNNING')).toBe('RUNNING');
    expect(betaTaskStatusFromJobStatus('SUCCEEDED')).toBe('COMPLETED');
    expect(betaTaskStatusFromJobStatus('FAILED')).toBe('FAILED');
    expect(betaTaskStatusFromJobStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('does not expose draft or quote-only jobs as execution tasks',()=>{
    expect(betaTaskStatusFromJobStatus('DRAFT')).toBeNull();
    expect(betaTaskStatusFromJobStatus('QUOTED')).toBeNull();
  });
});

import { apiRequest } from '../services/apiClient.js';

export type BetaTaskStatus='QUEUED'|'RUNNING'|'COMPLETED'|'FAILED'|'CANCELLED';
export interface BetaTaskError{
  code:string;
  message:string;
  category:'VALIDATION'|'AUTHORIZATION'|'NOT_FOUND'|'CONFLICT'|'BILLING'|'SERVICE'|'EXECUTION'|'INTERNAL';
  retryable:boolean;
  action:'RETRY'|'REQUOTE'|'ADD_CREDITS'|'CHANGE_INPUT'|'NONE';
}
export interface BetaTaskView{
  task_id:string;
  job_id:string;
  status:BetaTaskStatus;
  capability_id:string;
  model_id:string;
  attempt_count:number;
  can_retry:boolean;
  can_cancel:boolean;
  error:BetaTaskError|null;
  generation_id?:string|null;
  created_at:string;
  updated_at:string;
  started_at?:string|null;
  completed_at?:string|null;
}

function makeKey(scope:string,taskId:string){
  const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `task:${scope}:${taskId}:${id}`;
}

function action(taskId:string,verb:'retry'|'cancel'){
  return apiRequest<BetaTaskView>(`/api/beta/tasks/${taskId}/${verb}`,{
    method:'POST',
    headers:{'Idempotency-Key':makeKey(verb,taskId)},
  });
}

export const betaTaskClient={
  list(limit=30){return apiRequest<BetaTaskView[]>(`/api/beta/tasks?limit=${Math.min(100,Math.max(1,limit))}`);},
  get(taskId:string){return apiRequest<BetaTaskView>(`/api/beta/tasks/${taskId}`);},
  retry(taskId:string){return action(taskId,'retry');},
  cancel(taskId:string){return action(taskId,'cancel');},
};

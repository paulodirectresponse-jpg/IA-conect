import { BetaPublicError } from '../http/publicError.js';

export type BetaTaskStatus='QUEUED'|'RUNNING'|'COMPLETED'|'FAILED'|'CANCELLED';

export interface BetaTaskView {
  task_id:string;
  job_id:string;
  status:BetaTaskStatus;
  capability_id:string;
  model_id:string;
  attempt_count:number;
  can_retry:boolean;
  can_cancel:boolean;
  error:BetaPublicError|null;
  generation_id?:string|null;
  created_at:string;
  updated_at:string;
  started_at?:string|null;
  completed_at?:string|null;
}

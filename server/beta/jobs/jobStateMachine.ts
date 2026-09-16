import { Generation } from '../../../src/types/index.js';
import { BetaJobStatus } from './jobTypes.js';

const ALLOWED:Record<BetaJobStatus,BetaJobStatus[]>={
  DRAFT:['QUOTED','CANCELLED'],
  QUOTED:['QUEUED','CANCELLED'],
  QUEUED:['RUNNING','FAILED','CANCELLED'],
  RUNNING:['SUCCEEDED','FAILED','CANCELLED'],
  SUCCEEDED:[],
  FAILED:['QUOTED','QUEUED','CANCELLED'],
  CANCELLED:['QUOTED','QUEUED'],
};

export function canTransitionJob(from:BetaJobStatus,to:BetaJobStatus){
  return from===to||ALLOWED[from].includes(to);
}

export function assertJobTransition(from:BetaJobStatus,to:BetaJobStatus){
  if(!canTransitionJob(from,to)){
    throw Object.assign(new Error(`Transição de job inválida: ${from} → ${to}.`),{code:'JOB_INVALID_STATE'});
  }
}

export function generationStatusToJobStatus(status:Generation['status']):BetaJobStatus{
  if(status==='SUCCEEDED')return'SUCCEEDED';
  if(status==='FAILED'||status==='REFUNDED')return'FAILED';
  if(status==='CANCELLED')return'CANCELLED';
  return'RUNNING';
}

export function isTerminalJobStatus(status:BetaJobStatus){
  return status==='SUCCEEDED'||status==='FAILED'||status==='CANCELLED';
}

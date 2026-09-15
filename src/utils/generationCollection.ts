import { Generation } from '../types/index.js';

export const GENERATION_WORKING_STATUSES = new Set([
  'DRAFT',
  'QUEUED',
  'RESERVING_FUNDS',
  'ROUTING',
  'SUBMITTED',
  'PROCESSING',
  'CANCELLING',
]);

export const GENERATION_TERMINAL_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
]);

export function isGenerationWorking(status:string|undefined|null) {
  return GENERATION_WORKING_STATUSES.has(String(status||'').toUpperCase());
}

export function isGenerationTerminal(status:string|undefined|null) {
  return GENERATION_TERMINAL_STATUSES.has(String(status||'').toUpperCase());
}

export function mergeGenerationRows(...groups:Array<Generation[]|null|undefined>):Generation[] {
  const byId=new Map<string,Generation>();
  for(const group of groups){
    for(const generation of group||[]){
      if(generation?.generation_id)byId.set(generation.generation_id,generation);
    }
  }
  return [...byId.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}

export function upsertGeneration(rows:Generation[],generation:Generation):Generation[] {
  return mergeGenerationRows(rows,[generation]);
}

import { describe, expect, it } from 'vitest';
import { Generation } from '../types/index.js';
import { isGenerationTerminal, isGenerationWorking, mergeGenerationRows, upsertGeneration } from './generationCollection.js';

function generation(id:string,status:Generation['status'],createdAt:string):Generation {
  return {
    generation_id:id,
    user_id:'user-1',
    status,
    model_id:'model-1',
    provider_id:'provider-1',
    original_prompt:id,
    currency:'CREDITS',
    created_at:createdAt,
  };
}

describe('generationCollection',()=>{
  it('keeps multiple in-flight generations and sorts newest first',()=>{
    const rows=mergeGenerationRows(
      [generation('gen-1','PROCESSING','2026-09-15T10:00:00.000Z')],
      [generation('gen-2','SUBMITTED','2026-09-15T10:01:00.000Z')],
    );
    expect(rows.map(row=>row.generation_id)).toEqual(['gen-2','gen-1']);
    expect(rows.every(row=>isGenerationWorking(row.status))).toBe(true);
  });

  it('lets later sources replace stale copies of the same generation',()=>{
    const stale=generation('gen-1','PROCESSING','2026-09-15T10:00:00.000Z');
    const fresh={...stale,status:'SUCCEEDED' as const,progress_percent:100};
    const rows=mergeGenerationRows([stale],[fresh]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SUCCEEDED');
    expect(isGenerationTerminal(rows[0].status)).toBe(true);
  });

  it('upserts one job without removing other concurrent jobs',()=>{
    const first=generation('gen-1','SUBMITTED','2026-09-15T10:00:00.000Z');
    const second=generation('gen-2','QUEUED','2026-09-15T10:01:00.000Z');
    const next=upsertGeneration([first],second);
    expect(next.map(row=>row.generation_id)).toEqual(['gen-2','gen-1']);
  });

  it('keeps three concurrent jobs isolated when one fails and another succeeds',()=>{
    const rows=[
      generation('gen-1','PROCESSING','2026-09-15T10:00:00.000Z'),
      generation('gen-2','PROCESSING','2026-09-15T10:01:00.000Z'),
      generation('gen-3','PROCESSING','2026-09-15T10:02:00.000Z'),
    ];
    const afterFailure=upsertGeneration(rows,{...rows[1],status:'FAILED',error_message:'provider failed'});
    const afterSuccess=upsertGeneration(afterFailure,{...rows[0],status:'SUCCEEDED',progress_percent:100});
    expect(afterSuccess).toHaveLength(3);
    expect(afterSuccess.find(row=>row.generation_id==='gen-1')?.status).toBe('SUCCEEDED');
    expect(afterSuccess.find(row=>row.generation_id==='gen-2')?.status).toBe('FAILED');
    expect(afterSuccess.find(row=>row.generation_id==='gen-3')?.status).toBe('PROCESSING');
    expect(afterSuccess.filter(row=>isGenerationWorking(row.status)).map(row=>row.generation_id)).toEqual(['gen-3']);
  });
});

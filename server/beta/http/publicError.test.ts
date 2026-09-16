import { describe,expect,it } from 'vitest';
import { normalizeBetaPublicError,publicErrorFromStored } from './publicError.js';

describe('PR-04 normalized public errors',()=>{
  it('preserves safe validation messages and classifies the action',()=>{
    const result=normalizeBetaPublicError({code:'VALIDATION_ERROR',message:'Duração inválida.'});
    expect(result.status).toBe(400);
    expect(result.error).toMatchObject({code:'VALIDATION_ERROR',category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',message:'Duração inválida.'});
  });

  it('never leaks raw provider failures to the public contract',()=>{
    const secret='provider acme internal endpoint key mismatch';
    const result=normalizeBetaPublicError({code:'PROVIDER_UPSTREAM_FAILURE',message:secret});
    expect(result.status).toBe(503);
    expect(result.error.category).toBe('EXECUTION');
    expect(result.error.retryable).toBe(true);
    expect(result.error.message).not.toContain(secret);
    expect(JSON.stringify(result.error)).not.toContain('acme');
  });

  it('normalizes billing recovery actions',()=>{
    expect(normalizeBetaPublicError({code:'CREDIT_INSUFFICIENT_FUNDS'}).error.action).toBe('ADD_CREDITS');
    expect(normalizeBetaPublicError({code:'PRICE_CHANGED_REQUOTE_REQUIRED'}).error.action).toBe('REQUOTE');
  });

  it('normalizes stored task errors without exposing stored provider text',()=>{
    const error=publicErrorFromStored('PROVIDER_NOT_CONFIGURED','internal provider id = secret');
    expect(error?.message).toBe('A rota de execução está temporariamente indisponível.');
    expect(JSON.stringify(error)).not.toContain('secret');
  });
});

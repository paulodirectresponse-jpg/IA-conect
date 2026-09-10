import { describe, expect, it } from 'vitest';
import { publicGenerationError } from './publicGenerationError.js';

describe('public generation errors',()=>{
  it('never exposes provider economics diagnostics',()=>{
    const errors=[
      {code:'NO_SAFE_PROVIDER_AVAILABLE',message:'Margem operacional abaixo do mínimo'},
      {code:'COGS_BUDGET_EXHAUSTED',message:'COGS budget exhausted'},
      {code:'WAVESPEED_HTTP_500',message:'provider cost/backing mismatch'},
      {code:'ATLAS_PRICE_HTTP_503',message:'margin_percent failed'},
    ];
    for(const err of errors){
      const result=publicGenerationError(err,'Falha');
      expect(result.code).toBe('GENERATION_TEMPORARILY_UNAVAILABLE');
      expect(result.message.toLowerCase()).not.toMatch(/margem|margin|cogs|backing|provider|custo interno/);
    }
  });

  it('keeps insufficient credit feedback actionable',()=>{
    expect(publicGenerationError({code:'CREDIT_INSUFFICIENT_FUNDS',missing_credits:25},'Falha')).toEqual({
      code:'CREDIT_INSUFFICIENT_FUNDS',
      message:'Créditos insuficientes para esta geração.',
      missing_credits:25,
    });
  });

  it('keeps validation feedback without exposing technical errors',()=>{
    const result=publicGenerationError({code:'VALIDATION_ERROR',message:'Modelo e prompt são obrigatórios.'},'Falha');
    expect(result.message).toBe('Modelo e prompt são obrigatórios.');
  });
});

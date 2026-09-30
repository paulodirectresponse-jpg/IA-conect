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

  it('explains when no official provider balance covers the route',()=>{
    expect(publicGenerationError({code:'NO_FUNDED_ROUTE_AVAILABLE'},'Falha')).toEqual({
      code:'PROVIDER_BALANCE_UNAVAILABLE',
      message:'Nenhum provider oficial tem saldo suficiente para esta configuração no momento. Tente outro modelo ou aguarde a regularização do saldo.',
    });
  });

  it('explains that file generation is paused without storage and credits were not reserved',()=>{
    expect(publicGenerationError({code:'ASSET_STORAGE_UNAVAILABLE'},'Falha')).toEqual({
      code:'ASSET_STORAGE_UNAVAILABLE',
      message:'Gerações que produzem arquivos estão pausadas porque o armazenamento não passou na verificação. Nenhum crédito foi reservado.',
    });
  });

  it('explains unavailable compatible models and unsupported generation controls',()=>{
    expect(publicGenerationError({code:'AUTO_NO_READY_MODEL'},'Falha').message).toContain('Nenhum modelo compatível');
    expect(publicGenerationError({code:'NO_READY_ROUTE_V2'},'Falha').message).toContain('rota pronta');
    expect(publicGenerationError({code:'ROUTING_V2_PRICE_UNAVAILABLE'},'Falha').message).toContain('preço válido');
    expect(publicGenerationError({code:'MODEL_CONTROLS_UNSUPPORTED',message:'A proporção não é compatível.'},'Falha').message).toBe('A proporção não é compatível.');
  });

  it('reports operational generation pauses without leaking provider economics',()=>{
    const message=publicGenerationError({code:'PROVIDER_EXECUTION_DISABLED'},'Falha').message;
    expect(message).toContain('temporariamente pausada');
    expect(message.toLowerCase()).not.toMatch(/cogs|margem|custo/);
  });
});

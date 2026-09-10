export interface PublicGenerationError {
  code:string;
  message:string;
  missing_credits?:number;
}

const TEMPORARY_CODES=new Set([
  'NO_SAFE_PROVIDER_AVAILABLE',
  'COGS_BUDGET_EXHAUSTED',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_INCOMPATIBLE',
  'PROVIDER_INVALID_RESPONSE',
  'LIVE_QUOTE_UNAVAILABLE',
  'LIVE_QUOTE_INVALID',
  'REFERENCE_URL_UNAVAILABLE',
]);

function isProviderTechnicalCode(code:string){
  return code.startsWith('WAVESPEED_')||
    code.startsWith('ATLAS_')||
    code.startsWith('PROVIDER_')||
    code.startsWith('LIVE_QUOTE_')||
    code.startsWith('COGS_');
}

export function publicGenerationError(err:any,fallback='A geração não pôde ser concluída.'):PublicGenerationError {
  const code=String(err?.code||'GENERATION_ERROR');

  if(code==='CREDIT_INSUFFICIENT_FUNDS'){
    return {
      code,
      message:'Créditos insuficientes para esta geração.',
      missing_credits:Number.isFinite(Number(err?.missing_credits))?Math.max(0,Number(err.missing_credits)):undefined,
    };
  }

  if(code==='PRICE_CHANGED_REQUOTE_REQUIRED'){
    return {code,message:'O preço desta configuração foi atualizado. Revise o valor e tente novamente.'};
  }

  if(TEMPORARY_CODES.has(code)||isProviderTechnicalCode(code)){
    return {
      code:'GENERATION_TEMPORARILY_UNAVAILABLE',
      message:'Esta configuração está temporariamente indisponível. Tente novamente em instantes ou escolha outro modelo.',
    };
  }

  if(code==='MODEL_CONFIGURATION_UNSUPPORTED'||code==='MODEL_NOT_AVAILABLE'){
    return{code,message:String(err?.message||'Esta IA não suporta a configuração selecionada.')};
  }

  if(code==='REFERENCE_NOT_FOUND')return{code,message:'Uma das referências não está mais disponível.'};
  if(code==='REFERENCE_NOT_READY')return{code,message:'Uma das referências ainda está sendo processada.'};
  if(code==='REFERENCE_REQUIRED')return{code,message:'Adicione a referência necessária para esta geração.'};
  if(code==='VALIDATION_ERROR')return{code,message:String(err?.message||fallback)};

  // Never expose provider, pricing, COGS, backing or margin diagnostics to customers.
  return {code:'GENERATION_ERROR',message:fallback};
}

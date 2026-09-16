export type BetaPublicErrorCategory='VALIDATION'|'AUTHORIZATION'|'NOT_FOUND'|'CONFLICT'|'BILLING'|'SERVICE'|'EXECUTION'|'INTERNAL';
export type BetaPublicErrorAction='RETRY'|'REQUOTE'|'ADD_CREDITS'|'CHANGE_INPUT'|'NONE';

export interface BetaPublicError {
  code:string;
  message:string;
  category:BetaPublicErrorCategory;
  retryable:boolean;
  action:BetaPublicErrorAction;
}

interface Rule {
  status:number;
  category:BetaPublicErrorCategory;
  retryable:boolean;
  action:BetaPublicErrorAction;
  message?:string;
  preserveMessage?:boolean;
}

const RULES:Record<string,Rule>={
  VALIDATION_ERROR:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CAPABILITY_UNKNOWN:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  UNKNOWN_CAPABILITY:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CAPABILITY_UNSUPPORTED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CAPABILITY_NOT_SUPPORTED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CONTROL_UNSUPPORTED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CAPABILITY_CONTROL_NOT_SUPPORTED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  CAPABILITY_EXECUTOR_UNAVAILABLE:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'Este recurso ainda não possui execução disponível no Beta.'},
  REFERENCE_REQUIRED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',preserveMessage:true},
  REFERENCE_NOT_FOUND:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',message:'Uma referência não foi encontrada ou não está disponível.'},
  MODEL_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'CHANGE_INPUT',message:'O modelo selecionado não está disponível.'},
  JOB_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'NONE',message:'Tarefa não encontrada.'},
  JOB_INVALID_STATE:{status:409,category:'CONFLICT',retryable:false,action:'NONE',preserveMessage:true},
  JOB_RETRY_UNAVAILABLE:{status:409,category:'CONFLICT',retryable:false,action:'NONE',preserveMessage:true},
  JOB_QUOTE_REQUIRED:{status:409,category:'CONFLICT',retryable:false,action:'REQUOTE',message:'Atualize a cotação antes de executar esta tarefa.'},
  JOB_STATE_PERSISTENCE_PENDING:{status:409,category:'CONFLICT',retryable:true,action:'RETRY',message:'A execução já existe. Atualize a tarefa para recuperar o estado atual.'},
  IDEMPOTENCY_KEY_REQUIRED:{status:400,category:'VALIDATION',retryable:false,action:'NONE',message:'Não foi possível validar esta operação. Atualize a página e tente novamente.'},
  PRICE_CHANGED_REQUOTE_REQUIRED:{status:409,category:'BILLING',retryable:false,action:'REQUOTE',message:'O preço mudou. Atualize a cotação antes de executar.'},
  CREDIT_INSUFFICIENT_FUNDS:{status:402,category:'BILLING',retryable:false,action:'ADD_CREDITS',message:'Créditos insuficientes para executar esta tarefa.'},
  CREDIT_BILLING_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'O sistema de créditos está temporariamente indisponível.'},
  NEW_GENERATIONS_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'Novas gerações estão temporariamente pausadas.'},
  PROVIDER_EXECUTION_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'A execução está temporariamente pausada.'},
  BETA_DISABLED:{status:404,category:'AUTHORIZATION',retryable:false,action:'NONE',message:'A experiência Beta não está disponível.'},
  BETA_ACCESS_UNAVAILABLE:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'Não foi possível validar o acesso ao Beta.'},
  NO_SAFE_PROVIDER_AVAILABLE:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'Nenhuma rota de execução está disponível agora.'},
  COGS_BUDGET_EXHAUSTED:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'A execução foi interrompida por segurança operacional.'},
  PROVIDER_NOT_CONFIGURED:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'A rota de execução está temporariamente indisponível.'},
  JOB_EXECUTION_FAILED:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'A tarefa não pôde ser concluída.'},
  TASK_CANCEL_UNAVAILABLE:{status:409,category:'CONFLICT',retryable:false,action:'NONE',message:'Esta tarefa não pode mais ser cancelada.'},
  ASSET_STORAGE_UNAVAILABLE:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'O armazenamento de assets está temporariamente indisponível.'},
  ASSET_ARCHIVE_FETCH_FAILED:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'O resultado ainda não pôde ser recuperado para a Library.'},
  ASSET_ARCHIVE_UPLOAD_FAILED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'O resultado ainda não pôde ser arquivado na Library.'},
  ASSET_ARCHIVE_TOO_LARGE:{status:409,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',message:'O resultado excede o limite de armazenamento disponível.'},
  ASSET_ARCHIVE_EMPTY:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'O resultado retornado estava vazio e não pôde ser arquivado.'},
  ASSET_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'NONE',message:'Asset não encontrado.'},
  PROJECT_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'NONE',message:'Projeto não encontrado.'},
  COLLECTION_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'NONE',message:'Coleção não encontrada.'},
  COLLECTION_PROJECT_MISMATCH:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'A coleção selecionada pertence a outro projeto.'},
  QUOTE_EXPIRED:{status:409,category:'BILLING',retryable:false,action:'REQUOTE',message:'A cotação expirou. Atualize o preço antes de executar.'},
  QUOTE_POLICY_CHANGED:{status:409,category:'BILLING',retryable:false,action:'REQUOTE',message:'A política do modelo mudou. Atualize a cotação antes de executar.'},
  BETA_EXECUTION_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'Novas execuções Beta estão temporariamente pausadas.'},
  AUTO_ROUTER_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'AUTO router temporariamente indisponível.'},
  AUTO_NO_ELIGIBLE_MODEL:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'Nenhum modelo elegível para esta capability no AUTO.'},
  AUTO_NO_SAFE_MODEL:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'Nenhum modelo AUTO possui rota econômica segura agora.'},
  MODEL_NOT_ELIGIBLE:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'Modelo indisponível para execução Beta.'},
  MODEL_NOT_AUTO_ELIGIBLE:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'Modelo indisponível para o AUTO router.'},
  PRICING_POLICY_INACTIVE:{status:503,category:'BILLING',retryable:true,action:'RETRY',message:'Política de preço temporariamente indisponível.'},
  PRICING_POLICY_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'NONE',message:'Política de preço não encontrada.'},
  AUDIO_MODULE_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'O módulo de áudio está temporariamente indisponível.'},
  THREE_D_MODULE_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'O módulo 3D está temporariamente indisponível.'},
  AUDIO_CAPABILITY_DISABLED:{status:503,category:'SERVICE',retryable:true,action:'RETRY',message:'Este recurso de áudio está temporariamente indisponível.'},
  VOICE_CLONE_CONSENT_REQUIRED:{status:400,category:'VALIDATION',retryable:false,action:'CHANGE_INPUT',message:'Confirme que você possui autorização para usar esta voz.'},
  VOICE_CLONE_RESULT_INVALID:{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'A voz foi processada, mas não pôde ser registrada para reutilização.'},
  AUDIO_VOICE_NOT_FOUND:{status:404,category:'NOT_FOUND',retryable:false,action:'CHANGE_INPUT',message:'A voz selecionada não está disponível.'},
  AUDIO_VOICE_PROVIDER_UNAVAILABLE:{status:409,category:'CONFLICT',retryable:false,action:'CHANGE_INPUT',message:'A voz selecionada não possui uma rota compatível no momento.'},
  REFERENCE_NOT_READY:{status:409,category:'CONFLICT',retryable:true,action:'RETRY',message:'O arquivo de referência ainda não está pronto.'},
};

const SAFE_CODE=/^[A-Z0-9_]{2,80}$/;

function fallbackRule(code:string):Rule{
  if(code.startsWith('PROVIDER_')||code.startsWith('GENERATION_')||code.startsWith('DELIVERY_')){
    return{status:503,category:'EXECUTION',retryable:true,action:'RETRY',message:'A execução encontrou uma indisponibilidade temporária.'};
  }
  if(code.startsWith('CREDIT_')||code.startsWith('PRICING_')){
    return{status:409,category:'BILLING',retryable:true,action:'RETRY',message:'Não foi possível validar a operação de créditos agora.'};
  }
  return{status:500,category:'INTERNAL',retryable:true,action:'RETRY',message:'Não foi possível concluir esta operação agora.'};
}

export function normalizeBetaPublicError(error:any,fallbackMessage='Não foi possível concluir esta operação.'){
  const rawCode=String(error?.code||'BETA_ERROR').toUpperCase();
  const code=SAFE_CODE.test(rawCode)?rawCode:'BETA_ERROR';
  const rule=RULES[code]||fallbackRule(code);
  const message=rule.preserveMessage&&typeof error?.message==='string'&&error.message.trim()
    ?error.message.trim()
    :rule.message||fallbackMessage;
  const publicError:BetaPublicError={code,message,category:rule.category,retryable:rule.retryable,action:rule.action};
  return{status:rule.status,error:publicError};
}

export function publicErrorFromStored(code?:string|null,message?:string|null):BetaPublicError|null{
  if(!code&&!message)return null;
  return normalizeBetaPublicError({code:code||'JOB_EXECUTION_FAILED',message:message||undefined}).error;
}

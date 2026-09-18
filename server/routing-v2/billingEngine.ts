import { RoutingV2BillingConfig, RoutingV2Currency } from './domain.js';

export interface RoutingV2BillingInput{
  duration_seconds?:number;
  number_of_outputs?:number;
  character_count?:number;
  dimensions?:Record<string,string|number|boolean|null|undefined>;
}

export interface RoutingV2BillingResult{
  amount:number;
  currency:RoutingV2Currency;
  billing_type:RoutingV2BillingConfig['type'];
  quantity:number;
  unit_label:string;
}

function positive(value:number|undefined,fallback:number){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?n:fallback;
}

function exactMatrixMatch(config:Extract<RoutingV2BillingConfig,{type:'FIXED_MATRIX'}>,dimensions:RoutingV2BillingInput['dimensions']){
  const values=dimensions||{};
  return config.entries.find(entry=>Object.entries(entry.match).every(([key,expected])=>values[key]===expected))||null;
}

export function calculateRoutingV2ProviderCost(config:RoutingV2BillingConfig,input:RoutingV2BillingInput={}):RoutingV2BillingResult{
  if(config.type==='PER_GENERATION'){
    return{amount:config.price_per_generation,currency:config.currency,billing_type:config.type,quantity:1,unit_label:'generation'};
  }
  if(config.type==='PER_OUTPUT'){
    const quantity=Math.max(1,Math.ceil(positive(input.number_of_outputs,1)));
    return{amount:config.price_per_output*quantity,currency:config.currency,billing_type:config.type,quantity,unit_label:'output'};
  }
  if(config.type==='PER_SECOND'){
    const quantity=positive(input.duration_seconds,1);
    return{amount:config.price_per_second*quantity,currency:config.currency,billing_type:config.type,quantity,unit_label:'second'};
  }
  if(config.type==='PER_MINUTE'){
    const seconds=positive(input.duration_seconds,60);
    const quantity=seconds/60;
    return{amount:config.price_per_minute*quantity,currency:config.currency,billing_type:config.type,quantity,unit_label:'minute'};
  }
  if(config.type==='PER_CHARACTER'){
    const characters=Math.max(1,Math.ceil(positive(input.character_count,1)));
    const quantity=characters/config.characters_per_unit;
    return{amount:config.price_per_unit*quantity,currency:config.currency,billing_type:config.type,quantity,unit_label:`${config.characters_per_unit}_characters`};
  }
  if(config.type==='FIXED_MATRIX'){
    const match=exactMatrixMatch(config,input.dimensions);
    if(!match)throw Object.assign(new Error('Nenhuma entrada da matriz corresponde à configuração solicitada.'),{code:'ROUTING_V2_BILLING_MATRIX_MISS'});
    return{amount:match.price,currency:config.currency,billing_type:config.type,quantity:1,unit_label:'matrix'};
  }
  throw Object.assign(new Error('CUSTOM_FORMULA ainda não possui executor registrado.'),{code:'ROUTING_V2_CUSTOM_FORMULA_UNAVAILABLE'});
}

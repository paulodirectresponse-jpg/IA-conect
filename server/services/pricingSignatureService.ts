import crypto from 'crypto';
import { GenerationMode } from '../../src/types/index.js';

export interface PricingSignatureInput{
  model_id:string;
  mode:GenerationMode;
  resolution:string;
  duration_seconds:number;
  aspect_ratio:string;
  number_of_outputs:number;
  audio_enabled?:boolean;
  reference_mode?:string;
  reference_count?:number;
  model_variant?:string;
  pricing_options?:Record<string,string|number|boolean|null|undefined>;
}
export interface PricingSignature extends PricingSignatureInput{
  reference_count_band:string;
  normalized:string;
  hash:string;
}
function stableOptions(v:Record<string,any>={}){return Object.keys(v).sort().reduce((o,k)=>{if(v[k]!==undefined)o[k]=v[k];return o;},{} as Record<string,any>);}
function band(n:number){if(n<=0)return'0';if(n===1)return'1';if(n<=4)return'2-4';return'5+';}
export const pricingSignatureService={
  create(input:PricingSignatureInput):PricingSignature{
    const canonical={
      model_id:String(input.model_id),mode:input.mode,resolution:String(input.resolution),duration_seconds:Math.max(1,Math.round(input.duration_seconds||1)),
      aspect_ratio:String(input.aspect_ratio||'1:1'),number_of_outputs:Math.max(1,Math.round(input.number_of_outputs||1)),audio_enabled:Boolean(input.audio_enabled),
      reference_mode:String(input.reference_mode||'none'),reference_count_band:band(Number(input.reference_count||0)),model_variant:String(input.model_variant||'default'),pricing_options:stableOptions(input.pricing_options||{}),
    };
    const normalized=JSON.stringify(canonical);
    return {...input,...canonical,normalized,hash:crypto.createHash('sha256').update(normalized).digest('hex').slice(0,32)} as PricingSignature;
  }
};

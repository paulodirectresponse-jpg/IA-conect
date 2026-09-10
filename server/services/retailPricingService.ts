import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { PricingSignature } from './pricingSignatureService.js';

export interface RetailPricingVersion{
  retail_pricing_id:string;
  pricing_signature_hash:string;
  signature:PricingSignature;
  retail_credit_price:number;
  target_margin_percent:number;
  normal_floor_margin_percent:number;
  emergency_floor_margin_percent:number;
  yellow_policy:'BLOCK'|'ALLOW_WITH_TTL';
  yellow_ttl_minutes:number;
  effective_from:string;
  effective_until?:string|null;
  version:number;
  active:boolean;
  bootstrapped_from_safe_cogs_cents?:number;
  created_at:string;
  updated_at:string;
}

function initialCreditsFromSafeCogs(safe:number){
  if(safe<=25)return 60;if(safe<=40)return 100;if(safe<=60)return 150;if(safe<=80)return 200;if(safe<=120)return 300;
  if(safe<=160)return 400;if(safe<=220)return 550;if(safe<=300)return 750;if(safe<=400)return 1000;if(safe<=500)return 1250;
  // Above R$5 safe COGS: bootstrap once using 45% target margin and a conservative
  // R$0.0075 economic value per credit, rounded upward to 50-credit steps.
  const grossBrl=(safe/100)/(1-0.45);const raw=grossBrl/0.0075;return Math.max(1250,Math.ceil(raw/50)*50);
}
function path(hash:string){return `retail_pricing/${encodeURIComponent(hash)}`;}
export const retailPricingService={
  async get(hash:string):Promise<RetailPricingVersion|null>{const d=await firestoreAdminRest.get(path(hash));return d.exists?d.data as RetailPricingVersion:null;},
  async resolveOrBootstrap(signature:PricingSignature,bestSafeCogsCents:number):Promise<RetailPricingVersion>{
    const existing=await this.get(signature.hash);if(existing?.active)return existing;
    const now=new Date().toISOString();const created:RetailPricingVersion={
      retail_pricing_id:`retail_${signature.hash}_v1`,pricing_signature_hash:signature.hash,signature,
      retail_credit_price:initialCreditsFromSafeCogs(Math.max(1,bestSafeCogsCents)),target_margin_percent:45,normal_floor_margin_percent:35,emergency_floor_margin_percent:25,
      yellow_policy:'BLOCK',yellow_ttl_minutes:0,effective_from:now,effective_until:null,version:1,active:true,
      bootstrapped_from_safe_cogs_cents:Math.max(1,bestSafeCogsCents),created_at:now,updated_at:now,
    };
    // First writer wins. A concurrent bootstrap that loses simply re-reads the persisted authority.
    try{await firestoreAdminRest.commit([{update:{name:firestoreAdminRest.docName(path(signature.hash)),fields:firestoreAdminRest.fields(created)},currentDocument:{exists:false}}]);return created;}
    catch{const reread=await this.get(signature.hash);if(reread)return reread;throw new Error('Não foi possível inicializar o preço fixo em créditos.');}
  },
  async set(entry:RetailPricingVersion){await firestoreAdminRest.set(path(entry.pricing_signature_hash),entry);return entry;},
};

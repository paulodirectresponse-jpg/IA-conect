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

const ACTIVE='retail_pricing_active';
const VERSIONS='retail_pricing_versions';
const legacyPath=(hash:string)=>`retail_pricing/${encodeURIComponent(hash)}`;
const activePath=(hash:string)=>`${ACTIVE}/${encodeURIComponent(hash)}`;
const versionPath=(hash:string,version:number)=>`${VERSIONS}/${encodeURIComponent(hash)}_v${version}`;

function initialCreditsFromSafeCogs(safe:number){
  if(safe<=25)return 60;if(safe<=40)return 100;if(safe<=60)return 150;if(safe<=80)return 200;if(safe<=120)return 300;
  if(safe<=160)return 400;if(safe<=220)return 550;if(safe<=300)return 750;if(safe<=400)return 1000;if(safe<=500)return 1250;
  const grossBrl=(safe/100)/(1-0.45);const raw=grossBrl/0.0075;return Math.max(1250,Math.ceil(raw/50)*50);
}
async function readVersioned(hash:string){const pointer=await firestoreAdminRest.get(activePath(hash));if(!pointer.exists)return null;const v=Number((pointer.data as any)?.version||0);if(v<=0)return null;const d=await firestoreAdminRest.get(versionPath(hash,v));return d.exists?d.data as RetailPricingVersion:null;}
async function migrateLegacy(hash:string,legacy:RetailPricingVersion){const version=Math.max(1,Number(legacy.version||1)),now=new Date().toISOString(),entry:RetailPricingVersion={...legacy,pricing_signature_hash:hash,version,retail_pricing_id:legacy.retail_pricing_id||`retail_${hash}_v${version}`,active:legacy.active!==false,created_at:legacy.created_at||now,updated_at:legacy.updated_at||now};try{await firestoreAdminRest.commit([{update:{name:firestoreAdminRest.docName(versionPath(hash,version)),fields:firestoreAdminRest.fields(entry)},currentDocument:{exists:false}},{update:{name:firestoreAdminRest.docName(activePath(hash)),fields:firestoreAdminRest.fields({pricing_signature_hash:hash,version,retail_pricing_id:entry.retail_pricing_id,updated_at:now})},currentDocument:{exists:false}}]);return entry;}catch{const current=await readVersioned(hash);return current||entry;}}

export const retailPricingService={
  async get(hash:string):Promise<RetailPricingVersion|null>{
    const current=await readVersioned(hash);if(current)return current;
    const legacy=await firestoreAdminRest.get(legacyPath(hash));if(!legacy.exists)return null;
    return migrateLegacy(hash,legacy.data as RetailPricingVersion);
  },

  async migrateAllLegacy(){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'retail_pricing'}]}).catch(()=>[]);let migrated=0;for(const row of rows){const legacy=row.data as RetailPricingVersion,hash=String(legacy?.pricing_signature_hash||legacy?.signature?.hash||'');if(!hash)continue;const before=await readVersioned(hash);if(!before){await migrateLegacy(hash,legacy);migrated++;}}return{migrated};},

  async resolveOrBootstrap(signature:PricingSignature,bestSafeCogsCents:number):Promise<RetailPricingVersion>{
    const existing=await this.get(signature.hash);if(existing?.active)return existing;
    const now=new Date().toISOString();const created:RetailPricingVersion={
      retail_pricing_id:`retail_${signature.hash}_v1`,pricing_signature_hash:signature.hash,signature,
      retail_credit_price:initialCreditsFromSafeCogs(Math.max(1,bestSafeCogsCents)),target_margin_percent:45,normal_floor_margin_percent:35,emergency_floor_margin_percent:25,
      yellow_policy:'BLOCK',yellow_ttl_minutes:0,effective_from:now,effective_until:null,version:1,active:true,
      bootstrapped_from_safe_cogs_cents:Math.max(1,bestSafeCogsCents),created_at:now,updated_at:now,
    };
    try{
      await firestoreAdminRest.commit([
        {update:{name:firestoreAdminRest.docName(versionPath(signature.hash,1)),fields:firestoreAdminRest.fields(created)},currentDocument:{exists:false}},
        {update:{name:firestoreAdminRest.docName(activePath(signature.hash)),fields:firestoreAdminRest.fields({pricing_signature_hash:signature.hash,version:1,retail_pricing_id:created.retail_pricing_id,updated_at:now})},currentDocument:{exists:false}},
      ]);
      return created;
    }catch{
      const reread=await this.get(signature.hash);if(reread)return reread;throw new Error('Não foi possível inicializar o preço fixo em créditos.');
    }
  },

  async publish(input:Omit<RetailPricingVersion,'version'|'retail_pricing_id'|'created_at'|'updated_at'>){
    const current=await this.get(input.pricing_signature_hash);const nextVersion=(current?.version||0)+1;const now=new Date().toISOString();
    const entry:RetailPricingVersion={...input,version:nextVersion,retail_pricing_id:`retail_${input.pricing_signature_hash}_v${nextVersion}`,created_at:now,updated_at:now};
    await firestoreAdminRest.commit([
      {update:{name:firestoreAdminRest.docName(versionPath(input.pricing_signature_hash,nextVersion)),fields:firestoreAdminRest.fields(entry)},currentDocument:{exists:false}},
      {update:{name:firestoreAdminRest.docName(activePath(input.pricing_signature_hash)),fields:firestoreAdminRest.fields({pricing_signature_hash:input.pricing_signature_hash,version:nextVersion,retail_pricing_id:entry.retail_pricing_id,updated_at:now})}},
    ]);
    return entry;
  },

  async set(entry:RetailPricingVersion){
    const existing=await firestoreAdminRest.get(versionPath(entry.pricing_signature_hash,entry.version));
    if(existing.exists)throw Object.assign(new Error('RetailPricingVersion publicada é imutável. Publique uma nova versão.'),{code:'RETAIL_VERSION_IMMUTABLE'});
    await firestoreAdminRest.commit([
      {update:{name:firestoreAdminRest.docName(versionPath(entry.pricing_signature_hash,entry.version)),fields:firestoreAdminRest.fields(entry)},currentDocument:{exists:false}},
      {update:{name:firestoreAdminRest.docName(activePath(entry.pricing_signature_hash)),fields:firestoreAdminRest.fields({pricing_signature_hash:entry.pricing_signature_hash,version:entry.version,retail_pricing_id:entry.retail_pricing_id,updated_at:new Date().toISOString()})}},
    ]);
    return entry;
  },
};

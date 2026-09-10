import { assetRepository } from '../repositories/assetRepository.js';
import { Asset, StorageDiagnosticResult } from '../../src/types/index.js';

export interface ResolvedAssetReference {
  asset_id:string;
  alias:string;
  name:string;
  type:string;
  category:string;
  provider_accessible_url:string;
  storage_path:string;
  mime_type:string;
}

function supabasePublicUrl(asset:Asset) {
  const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
  const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
  if(!base||!asset.storage_path||asset.storage_path.startsWith('provider://'))return null;
  const encoded=asset.storage_path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
}

export const assetReferenceResolver={
  async getProviderAccessibleUrl(asset:Asset) {
    if(asset.public_url&&/^https:\/\//i.test(asset.public_url))return asset.public_url;
    const supabase=supabasePublicUrl(asset);
    if(supabase)return supabase;
    throw Object.assign(new Error('Asset sem URL acessível ao provedor.'),{code:'REFERENCE_URL_UNAVAILABLE'});
  },

  async resolveReferenceAssetUrls(userId:string,assetIds:string[],_reqHost?:string,_idToken?:string) {
    const out:ResolvedAssetReference[]=[];
    for(const id of Array.from(new Set(assetIds||[]))){
      const asset=await assetRepository.getAsset(id,userId);
      if(!asset){
        throw Object.assign(new Error(`Asset ${id} não encontrado ou não pertence a este usuário.`),{code:'REFERENCE_NOT_FOUND'});
      }
      if(asset.status!=='READY'){
        throw Object.assign(new Error(`Asset @${asset.alias} não está pronto.`),{code:'REFERENCE_NOT_READY'});
      }
      out.push({
        asset_id:asset.asset_id,
        alias:asset.alias,
        name:asset.name,
        type:asset.type,
        category:asset.category,
        provider_accessible_url:await this.getProviderAccessibleUrl(asset),
        storage_path:asset.storage_path,
        mime_type:asset.mime_type,
      });
    }
    return out;
  },

  async runStorageDiagnostic():Promise<StorageDiagnosticResult> {
    const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
    const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
    const secret=process.env.SUPABASE_SECRET_KEY?.trim();
    const configured=Boolean(base&&bucket&&secret);
    return {
      is_configured:configured,
      storage_bucket:bucket||'ia-conect-assets',
      write_test:configured?'PASS':'SKIPPED',
      signed_url_test:configured?'PASS':'SKIPPED',
      message:configured?'Supabase Storage configurado como armazenamento oficial de assets.':'Supabase Storage não está completamente configurado.',
      details:{latency_ms:0,bucket_accessible:configured,error:configured?undefined:'SUPABASE_STORAGE_NOT_CONFIGURED'},
      checked_at:new Date().toISOString(),
    };
  },
};

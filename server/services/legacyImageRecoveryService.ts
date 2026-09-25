import { Generation } from '../../src/types/index.js';
import { assetRepository, generatedAssetId } from '../repositories/assetRepository.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { generatedAssetStorageService } from './generatedAssetStorageService.js';

type RecoveryOutcome='HEALTHY'|'RECOVERED'|'UNAVAILABLE'|'SKIPPED';

function isImageGeneration(g:Generation){
  return ['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'].includes(String(g.mode||''))||
    ['text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(String(g.capability_id||''));
}
async function readable(url:string){
  if(!/^https:\/\//i.test(url))return false;
  try{
    const response=await fetch(url,{method:'HEAD',redirect:'follow'});
    return response.ok;
  }catch{return false;}
}
function uniqueUrls(values:Array<unknown>){
  return Array.from(new Set(values.map(v=>String(v||'').trim()).filter(v=>/^https:\/\//i.test(v))));
}
function generationUrls(g:any){
  return uniqueUrls([...(Array.isArray(g.result_urls)?g.result_urls:[]),g.result_url,g.thumbnail_url]);
}
function candidatesFor(index:number,g:any,asset:any){
  const resultUrls=Array.isArray(g.result_urls)?g.result_urls:[];
  return uniqueUrls([
    asset?.public_url,
    asset?.preview_url,
    asset?.thumbnail_url,
    resultUrls[index],
    index===0?g.result_url:null,
    index===0?g.thumbnail_url:null,
    ...resultUrls,
  ]);
}

async function recoverOutput(g:any,index:number){
  const listedId=String(g.result_asset_ids?.[index]||((index===0&&g.result_asset_id)||''));
  const assetId=listedId||generatedAssetId(g.generation_id,index);
  const existing=await assetRepository.getAsset(assetId,g.user_id);
  const archived=Boolean(existing?.media_metadata?.archived===true&&existing.storage_path&&!String(existing.storage_path).startsWith('provider://'));
  if(archived&&existing?.public_url&&await readable(existing.public_url)){
    return{outcome:'HEALTHY' as RecoveryOutcome,asset:existing,url:existing.public_url};
  }

  for(const sourceUrl of candidatesFor(index,g,existing)){
    try{
      const stored=await generatedAssetStorageService.archive({
        userId:g.user_id,
        assetId,
        sourceUrl,
        fallbackMime:'image/jpeg',
        fallbackExtension:'jpg',
      });
      const recovered=existing
        ?await assetRepository.updateAsset(assetId,g.user_id,{
          storage_path:stored.storage_path,
          public_url:stored.public_url,
          thumbnail_url:stored.public_url,
          preview_url:stored.public_url,
          preview_mime_type:stored.mime_type,
          status:'READY',
          media_metadata:{...(existing.media_metadata||{}),archived:true,recovery_status:'RECOVERED',recovered_at:new Date().toISOString(),recovery_source_url:sourceUrl},
        })
        :await assetRepository.createAsset({
          asset_id:assetId,
          owner_user_id:g.user_id,
          type:'IMAGE',
          category:'GENERIC',
          name:`Imagem recuperada ${g.generation_id.slice(-6)}`,
          alias:`recuperada_${g.generation_id.slice(-8)}_${index+1}`,
          storage_path:stored.storage_path,
          public_url:stored.public_url,
          thumbnail_url:stored.public_url,
          preview_url:stored.public_url,
          preview_mime_type:stored.mime_type,
          mime_type:stored.mime_type,
          size_bytes:stored.size_bytes,
          status:'READY',
          origin:'GENERATED',
          source_generation_id:g.generation_id,
          source_job_id:g.source_job_id||null,
          derived_from_asset_id:g.derived_from_asset_id||null,
          source_output_index:index,
          source_model_id:g.model_id||null,
          source_provider_id:g.provider_id||null,
          media_metadata:{archived:true,recovery_status:'RECOVERED',recovered_at:new Date().toISOString(),recovery_source_url:sourceUrl},
        });
      return{outcome:'RECOVERED' as RecoveryOutcome,asset:recovered,url:stored.public_url};
    }catch{}
  }

  if(existing){
    await assetRepository.updateAsset(assetId,g.user_id,{
      media_metadata:{...(existing.media_metadata||{}),recovery_status:'UNAVAILABLE',recovery_attempted_at:new Date().toISOString()},
    }).catch(()=>null);
  }
  return{outcome:'UNAVAILABLE' as RecoveryOutcome,asset:existing||null,url:null};
}

async function recoverGeneration(g:Generation){
  const anyG:any=g;
  if(String(g.status)!=='SUCCEEDED'||!isImageGeneration(g)){
    return{outcome:'SKIPPED' as RecoveryOutcome,recovered:0,healthy:0,unavailable:0};
  }
  const knownUrls=generationUrls(anyG);
  const requested=Math.max(
    1,
    Number(anyG.number_of_outputs||0),
    Array.isArray(anyG.result_asset_ids)?anyG.result_asset_ids.length:0,
    Array.isArray(anyG.result_urls)?anyG.result_urls.length:0,
  );
  if(!knownUrls.length&&!anyG.result_asset_id&&!anyG.result_asset_ids?.length){
    anyG.media_recovery_status='UNAVAILABLE';
    anyG.media_recovery_checked_at=new Date().toISOString();
    await generationRepository.saveGeneration(anyG);
    return{outcome:'UNAVAILABLE' as RecoveryOutcome,recovered:0,healthy:0,unavailable:1};
  }

  const urls:string[]=[];
  const assetIds:string[]=[];
  let recovered=0,healthy=0,unavailable=0;
  for(let index=0;index<requested;index++){
    const result=await recoverOutput(anyG,index);
    if(result.asset?.asset_id)assetIds.push(result.asset.asset_id);
    if(result.url)urls.push(result.url);
    if(result.outcome==='RECOVERED')recovered++;
    else if(result.outcome==='HEALTHY')healthy++;
    else if(result.outcome==='UNAVAILABLE')unavailable++;
  }

  if(urls.length){
    anyG.result_asset_ids=assetIds;
    anyG.result_asset_id=assetIds[0]||anyG.result_asset_id||null;
    anyG.result_urls=urls;
    anyG.result_url=urls[0]||null;
    anyG.thumbnail_url=urls[0]||anyG.thumbnail_url||null;
  }
  anyG.media_recovery_status=unavailable>0?(urls.length?'PARTIAL':'UNAVAILABLE'):(recovered>0?'RECOVERED':'HEALTHY');
  anyG.media_recovery_checked_at=new Date().toISOString();
  await generationRepository.saveGeneration(anyG);
  return{
    outcome:anyG.media_recovery_status as RecoveryOutcome,
    recovered,
    healthy,
    unavailable,
  };
}

export const legacyImageRecoveryService={
  async runBatch(params:{userId:string;cursor?:number;limit?:number}){
    const cursor=Math.max(0,Math.floor(params.cursor||0));
    const limit=Math.max(1,Math.min(5,Math.floor(params.limit||3)));
    const rows=await generationRepository.listUserGenerationsPage(params.userId,cursor,limit);
    let recovered=0,healthy=0,unavailable=0,skipped=0;
    const details:Array<{generation_id:string;outcome:string}>=[];
    for(const generation of rows){
      const result=await recoverGeneration(generation);
      recovered+=result.recovered;
      healthy+=result.healthy;
      unavailable+=result.unavailable;
      if(result.outcome==='SKIPPED')skipped++;
      details.push({generation_id:generation.generation_id,outcome:result.outcome});
    }
    const done=rows.length<limit;
    return{
      cursor,
      next_cursor:done?null:cursor+rows.length,
      done,
      processed:rows.length,
      recovered,
      healthy,
      unavailable,
      skipped,
      details,
    };
  },
};

import { Generation } from '../../src/types/index.js';
import { assetRepository, generatedAssetId } from '../repositories/assetRepository.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { generatedAssetStorageService } from './generatedAssetStorageService.js';
import { r2AssetStorageService } from './r2AssetStorageService.js';

type RecoveryOutcome='HEALTHY'|'RECOVERED'|'PARTIAL'|'UNAVAILABLE'|'SKIPPED';
interface RecoveryError {code:string;http_status?:number}
interface OutputRecovery {outcome:RecoveryOutcome;asset:any|null;url:string|null;errors:RecoveryError[]}

function isImageGeneration(g:Generation){
  return ['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'].includes(String(g.mode||''))||
    ['text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(String(g.capability_id||''));
}
function uniqueUrls(values:Array<unknown>){
  return Array.from(new Set(values.map(v=>String(v||'').trim()).filter(v=>/^https:\/\//i.test(v))));
}
function generationUrls(g:any){
  return uniqueUrls([...(Array.isArray(g.result_urls)?g.result_urls:[]),...(Array.isArray(g.provider_result_urls)?g.provider_result_urls:[]),g.result_url,g.thumbnail_url]);
}
function candidatesFor(index:number,g:any,asset:any){
  const resultUrls=Array.isArray(g.result_urls)?g.result_urls:[];
  const providerUrls=Array.isArray(g.provider_result_urls)?g.provider_result_urls:[];
  return uniqueUrls([
    asset?.public_url,
    asset?.preview_url,
    asset?.thumbnail_url,
    resultUrls[index],
    providerUrls[index],
    index===0?g.result_url:null,
    index===0?g.thumbnail_url:null,
  ]);
}
function recoveryError(error:unknown,fallback='ASSET_RECOVERY_FAILED'):RecoveryError{
  const value=error as {code?:unknown;status?:unknown}|null;
  const raw=String(value?.code||fallback);
  const code=/^[A-Z0-9_]{1,64}$/.test(raw)?raw:fallback;
  const status=Number(value?.status);
  return{code,...(Number.isInteger(status)&&status>=100&&status<=599?{http_status:status}:{})};
}
function uniqueErrors(errors:RecoveryError[]){
  const byKey=new Map<string,RecoveryError>();
  for(const error of errors)byKey.set(`${error.code}:${error.http_status||''}`,error);
  return Array.from(byKey.values());
}

async function recoverOutput(g:any,index:number):Promise<OutputRecovery>{
  const listedId=String(g.result_asset_ids?.[index]||((index===0&&g.result_asset_id)||''));
  const assetId=listedId||generatedAssetId(g.generation_id,index);
  let existing:any=null;
  try{existing=await assetRepository.getAsset(assetId,g.user_id);}
  catch(error){return{outcome:'UNAVAILABLE',asset:null,url:null,errors:[recoveryError(error,'ASSET_LOOKUP_FAILED')]};}

  const archived=Boolean(existing?.media_metadata?.archived===true&&existing.storage_path&&!String(existing.storage_path).startsWith('provider://'));
  if(archived&&await r2AssetStorageService.exists(existing.storage_path)){
    return{outcome:'HEALTHY',asset:existing,url:existing.public_url||null,errors:[]};
  }

  const errors:RecoveryError[]=[];
  for(const sourceUrl of candidatesFor(index,g,existing)){
    let stored;
    try{
      stored=await generatedAssetStorageService.archive({
        userId:g.user_id,
        assetId,
        sourceUrl,
        fallbackMime:'image/jpeg',
        fallbackExtension:'jpg',
      });
    }catch(error){
      errors.push(recoveryError(error,'ASSET_ARCHIVE_FAILED'));
      continue;
    }

    const recoveredAt=new Date().toISOString();
    try{
      const metadata={...(existing?.media_metadata||{}),archived:true,recovery_status:'RECOVERED',recovered_at:recoveredAt};
      const recovered=existing
        ?await assetRepository.updateAsset(assetId,g.user_id,{
          storage_path:stored.storage_path,
          public_url:stored.public_url,
          thumbnail_url:stored.public_url,
          preview_url:stored.public_url,
          preview_mime_type:stored.mime_type,
          status:'READY',
          media_metadata:metadata,
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
          media_metadata:metadata,
        });
      return{outcome:'RECOVERED',asset:recovered,url:stored.public_url,errors:uniqueErrors(errors)};
    }catch(error){
      errors.push(recoveryError(error,'ASSET_RECOVERY_RECORD_FAILED'));
      return{outcome:'UNAVAILABLE',asset:existing,url:null,errors:uniqueErrors(errors)};
    }
  }

  if(!errors.length)errors.push({code:'RECOVERY_SOURCE_URL_MISSING'});
  if(existing){
    try{
      await assetRepository.updateAsset(assetId,g.user_id,{
        media_metadata:{
          ...(existing.media_metadata||{}),
          recovery_status:'UNAVAILABLE',
          recovery_attempted_at:new Date().toISOString(),
          recovery_error_codes:uniqueErrors(errors).map(error=>error.code).join(','),
        },
      });
    }catch(error){errors.push(recoveryError(error,'ASSET_RECOVERY_STATUS_SAVE_FAILED'));}
  }
  return{outcome:'UNAVAILABLE',asset:existing||null,url:null,errors:uniqueErrors(errors)};
}

async function recoverGeneration(generation:Generation){
  const g:any=generation;
  if(String(g.status)!=='SUCCEEDED'||!isImageGeneration(g)){
    return{outcome:'SKIPPED' as RecoveryOutcome,recovered:0,healthy:0,unavailable:0,errors:[] as RecoveryError[]};
  }
  const checkedAt=Date.parse(String(g.media_recovery_checked_at||''));
  const recoveryStatus=String(g.media_recovery_status||'');
  const cooldownMs=recoveryStatus==='UNAVAILABLE'?24*60*60*1000:7*24*60*60*1000;
  if(Number.isFinite(checkedAt)&&checkedAt>0&&Date.now()-checkedAt<cooldownMs&&['HEALTHY','RECOVERED','UNAVAILABLE'].includes(recoveryStatus)){
    return{outcome:'SKIPPED' as RecoveryOutcome,recovered:0,healthy:0,unavailable:0,errors:[] as RecoveryError[]};
  }
  const knownUrls=generationUrls(g);
  const requested=Math.max(
    1,
    Number(g.number_of_outputs||0),
    Array.isArray(g.result_asset_ids)?g.result_asset_ids.length:0,
    Array.isArray(g.result_urls)?g.result_urls.length:0,
    Array.isArray(g.provider_result_urls)?g.provider_result_urls.length:0,
  );
  const results:OutputRecovery[]=[];
  if(!knownUrls.length&&!g.result_asset_id&&!g.result_asset_ids?.length){
    results.push({outcome:'UNAVAILABLE',asset:null,url:null,errors:[{code:'RECOVERY_SOURCE_URL_MISSING'}]});
  }else{
    for(let index=0;index<requested;index++)results.push(await recoverOutput(g,index));
  }

  const urls:string[]=[];
  const assetIds:string[]=[];
  for(const result of results){
    if(result.asset?.asset_id)assetIds.push(result.asset.asset_id);
    if(result.url)urls.push(result.url);
  }
  const recovered=results.filter(result=>result.outcome==='RECOVERED').length;
  const healthy=results.filter(result=>result.outcome==='HEALTHY').length;
  const unavailable=results.filter(result=>result.outcome==='UNAVAILABLE').length;
  const errors=uniqueErrors(results.flatMap(result=>result.errors));
  if(urls.length){
    g.result_asset_ids=assetIds;
    g.result_asset_id=assetIds[0]||g.result_asset_id||null;
    g.result_urls=urls;
    g.result_url=urls[0]||null;
    g.thumbnail_url=urls[0]||g.thumbnail_url||null;
  }
  g.media_recovery_status=unavailable>0?(urls.length?'PARTIAL':'UNAVAILABLE'):(recovered>0?'RECOVERED':'HEALTHY');
  g.media_recovery_checked_at=new Date().toISOString();
  g.media_recovery_error_codes=errors.map(error=>error.http_status?`${error.code}_HTTP_${error.http_status}`:error.code);
  await generationRepository.saveGeneration(g);
  return{outcome:g.media_recovery_status as RecoveryOutcome,recovered,healthy,unavailable,errors};
}

export const legacyImageRecoveryService={
  async runBatch(params:{userId:string;cursor?:number;limit?:number}){
    const cursor=Math.max(0,Math.floor(params.cursor||0));
    const limit=Math.max(1,Math.min(5,Math.floor(params.limit||3)));
    const rows=await generationRepository.listUserGenerationsPage(params.userId,cursor,limit);
    let recovered=0,healthy=0,unavailable=0,skipped=0,failed=0;
    const details:Array<{generation_id:string;outcome:string;errors:RecoveryError[]}>=[];
    for(const generation of rows){
      try{
        const result=await recoverGeneration(generation);
        recovered+=result.recovered;
        healthy+=result.healthy;
        unavailable+=result.unavailable;
        if(result.outcome==='SKIPPED')skipped++;
        details.push({generation_id:generation.generation_id,outcome:result.outcome,errors:result.errors});
      }catch(error){
        failed++;
        const errors=[recoveryError(error,'GENERATION_RECOVERY_FAILED')];
        console.error('[GeneratedAssetRecoveryFailed]',JSON.stringify({generation_id:generation.generation_id,code:errors[0].code}));
        details.push({generation_id:generation.generation_id,outcome:'FAILED',errors});
      }
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
      failed,
      skipped,
      details,
    };
  },
};

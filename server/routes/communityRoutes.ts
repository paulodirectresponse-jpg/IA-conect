import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export const communityRouter = Router();
communityRouter.use(requireAuth);

function mediaType(mode:string){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE'?'IMAGE':'VIDEO';}
function likeId(generationId:string,userId:string){return `${generationId}_${userId}`;}
function safeId(value:string){return encodeURIComponent(value);}
function aliasFrom(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)||'referencia';}

async function enrichGeneration(g:any,currentUserId:string){
  const [userDoc,statsDoc,likeDoc]=await Promise.all([
    firestoreAdminRest.get(`users/${safeId(g.user_id)}`),
    firestoreAdminRest.get(`community_stats/${safeId(g.generation_id)}`),
    firestoreAdminRest.get(`community_likes/${safeId(likeId(g.generation_id,currentUserId))}`),
  ]);
  const user=(userDoc.exists?userDoc.data:{}) as any;
  const stats=(statsDoc.exists?statsDoc.data:{}) as any;
  const refs=await Promise.all((g.references||[]).map(async(r:any)=>{
    const doc=await firestoreAdminRest.get(`assets/${safeId(r.asset_id)}`);
    if(!doc.exists)return null;
    const a=doc.data as any;
    if(a?.deleted_at)return null;
    return {asset_id:a.asset_id,name:a.name,type:a.type,public_url:a.public_url,thumbnail_url:a.thumbnail_url||a.public_url,slot_type:r.slot_type||'GENERAL',alias:r.alias||a.alias};
  }));
  return {
    generation_id:g.generation_id,
    creator:{user_id:g.user_id,display_name:user?.display_name||user?.name||'Criador IA Connect',avatar_url:user?.avatar_url||''},
    media_type:mediaType(g.mode),result_url:g.result_url,result_urls:g.result_urls||[g.result_url].filter(Boolean),thumbnail_url:g.thumbnail_url||g.result_url,
    model_id:g.model_id,mode:g.mode,prompt:g.original_prompt||'',negative_prompt:g.negative_prompt||'',aspect_ratio:g.aspect_ratio||'1:1',resolution:g.resolution||'',
    duration_seconds:g.duration_seconds||null,number_of_outputs:g.number_of_outputs||1,seed:g.seed??null,motion_strength:g.motion_strength??null,references:refs.filter(Boolean),
    created_at:g.completed_at||g.created_at,likes_count:Number(stats?.likes_count||0),downloads_count:Number(stats?.downloads_count||0),liked_by_me:likeDoc.exists,
  };
}

communityRouter.get('/community/feed',async(req:AuthenticatedRequest,res)=>{
  try{
    const requested=Math.max(1,Math.min(100,Number(req.query.limit)||48));
    const kind=String(req.query.type||'ALL').toUpperCase();
    const generations=(await generationRepository.listAllGenerations(Math.min(250,requested*4)))
      .filter(g=>g.status==='SUCCEEDED'&&Boolean(g.result_url))
      .filter(g=>kind==='ALL'||mediaType(g.mode)===kind)
      .filter((g:any)=>!g.community_recreate_source_id)
      .slice(0,requested);
    const items=await Promise.all(generations.map(g=>enrichGeneration(g,req.user!.uid)));
    res.json({success:true,data:{items}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_FEED_ERROR',message:err?.message||'Não foi possível carregar a comunidade.'}});}
});

communityRouter.post('/community/:generationId/like',async(req:AuthenticatedRequest,res)=>{
  try{
    const generationId=req.params.generationId,userId=req.user!.uid;
    const generation=await generationRepository.getGeneration(generationId);
    if(!generation||generation.status!=='SUCCEEDED'||!generation.result_url)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const likePath=`community_likes/${safeId(likeId(generationId,userId))}`;
    const statsPath=`community_stats/${safeId(generationId)}`;
    const [likeDoc,statsDoc]=await Promise.all([firestoreAdminRest.get(likePath),firestoreAdminRest.get(statsPath)]);
    const current=Math.max(0,Number((statsDoc.data as any)?.likes_count||0));
    const now=new Date().toISOString();
    const liked=!likeDoc.exists;
    const likes_count=liked?current+1:Math.max(0,current-1);
    if(liked)await firestoreAdminRest.set(likePath,{generation_id:generationId,user_id:userId,created_at:now});
    else await firestoreAdminRest.commit([{delete:firestoreAdminRest.docName(likePath)}]);
    await firestoreAdminRest.set(statsPath,{...(statsDoc.data||{}),likes_count,downloads_count:Number((statsDoc.data as any)?.downloads_count||0),updated_at:now});
    res.json({success:true,data:{liked,likes_count}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_LIKE_ERROR',message:err?.message||'Não foi possível atualizar a curtida.'}});}
});

communityRouter.post('/community/:generationId/download',async(req:AuthenticatedRequest,res)=>{
  try{
    const generationId=req.params.generationId;
    const generation=await generationRepository.getGeneration(generationId);
    if(!generation||generation.status!=='SUCCEEDED'||!generation.result_url)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const statsPath=`community_stats/${safeId(generationId)}`;
    const statsDoc=await firestoreAdminRest.get(statsPath);
    const downloads_count=Math.max(0,Number((statsDoc.data as any)?.downloads_count||0))+1;
    await firestoreAdminRest.set(statsPath,{...(statsDoc.data||{}),likes_count:Number((statsDoc.data as any)?.likes_count||0),downloads_count,updated_at:new Date().toISOString()});
    res.json({success:true,data:{url:generation.result_url,downloads_count,media_type:mediaType(generation.mode)}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_DOWNLOAD_ERROR',message:err?.message||'Não foi possível preparar o download.'}});}
});

communityRouter.post('/community/:generationId/recreate',async(req:AuthenticatedRequest,res)=>{
  try{
    const sourceId=req.params.generationId,userId=req.user!.uid;
    const source=await generationRepository.getGeneration(sourceId);
    if(!source||source.status!=='SUCCEEDED'||!source.result_url)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const clonedRefs:any[]=[];
    for(const ref of source.references||[]){
      const srcDoc=await firestoreAdminRest.get(`assets/${safeId(ref.asset_id)}`);
      if(!srcDoc.exists)continue;
      const a=srcDoc.data as any;if(a?.deleted_at||!a?.public_url)continue;
      const suffix=Math.random().toString(36).slice(2,8),assetId=`ast_community_${Date.now()}_${suffix}`;
      const name=`Referência da comunidade - ${a.name||'asset'}`;
      const cloned={...a,asset_id:assetId,owner_user_id:userId,category:'GENERIC',name,alias:`${aliasFrom(name)}_${suffix}`,storage_path:a.storage_path||`community://${a.asset_id}`,origin:'UPLOAD',source_generation_id:null,source_model_id:null,source_provider_id:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deleted_at:null};
      await firestoreAdminRest.set(`assets/${safeId(assetId)}`,cloned);
      clonedRefs.push({asset_id:assetId,slot_type:ref.slot_type||'GENERAL',alias:ref.alias||cloned.alias});
    }
    const now=new Date().toISOString();
    const clonedId=`gen_community_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const clonedGeneration={...source,generation_id:clonedId,user_id:userId,references:clonedRefs,created_at:now,updated_at:now,completed_at:now,community_recreate_source_id:sourceId,provider_job_id:null,idempotency_key:`community_recreate_${clonedId}`} as any;
    await generationRepository.saveGeneration(clonedGeneration);
    res.json({success:true,data:{generation_id:clonedId,snapshot:{generation_id:clonedId},target:mediaType(source.mode)==='IMAGE'?'create-image':'create-video'}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_RECREATE_ERROR',message:err?.message||'Não foi possível preparar a recriação.'}});}
});

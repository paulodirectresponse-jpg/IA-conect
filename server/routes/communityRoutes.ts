import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';

export const communityRouter = Router();
communityRouter.use(requireAuth);

function dbOrThrow(){const db=getAdminDb();if(!db)throw new Error('Firestore Admin indisponível.');return db;}
function mediaType(mode:string){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE'?'IMAGE':'VIDEO';}
function likeId(generationId:string,userId:string){return `${generationId}_${userId}`;}

async function enrichGeneration(g:any,currentUserId:string){
  const db=dbOrThrow();
  const [userDoc,statsDoc,likeDoc]=await Promise.all([
    db.collection('users').doc(g.user_id).get(),
    db.collection('community_stats').doc(g.generation_id).get(),
    db.collection('community_likes').doc(likeId(g.generation_id,currentUserId)).get(),
  ]);
  const user=(userDoc.exists?userDoc.data():{}) as any;
  const stats=(statsDoc.exists?statsDoc.data():{}) as any;
  const refs=await Promise.all((g.references||[]).map(async(r:any)=>{
    const doc=await db.collection('assets').doc(r.asset_id).get();
    if(!doc.exists)return null;
    const a=doc.data() as any;
    if(a.deleted_at)return null;
    return {asset_id:a.asset_id,name:a.name,type:a.type,public_url:a.public_url,thumbnail_url:a.thumbnail_url||a.public_url,slot_type:r.slot_type||'GENERAL',alias:r.alias||a.alias};
  }));
  return {
    generation_id:g.generation_id,
    creator:{user_id:g.user_id,display_name:user?.display_name||user?.name||'Criador IA Connect',avatar_url:user?.avatar_url||''},
    media_type:mediaType(g.mode),
    result_url:g.result_url,
    result_urls:g.result_urls||[g.result_url].filter(Boolean),
    thumbnail_url:g.thumbnail_url||g.result_url,
    model_id:g.model_id,
    mode:g.mode,
    prompt:g.original_prompt||'',
    negative_prompt:g.negative_prompt||'',
    aspect_ratio:g.aspect_ratio||'1:1',
    resolution:g.resolution||'',
    duration_seconds:g.duration_seconds||null,
    number_of_outputs:g.number_of_outputs||1,
    seed:g.seed??null,
    motion_strength:g.motion_strength??null,
    references:refs.filter(Boolean),
    created_at:g.completed_at||g.created_at,
    likes_count:Number(stats?.likes_count||0),
    downloads_count:Number(stats?.downloads_count||0),
    liked_by_me:likeDoc.exists,
  };
}

communityRouter.get('/community/feed',async(req:AuthenticatedRequest,res)=>{
  try{
    const requested=Math.max(1,Math.min(100,Number(req.query.limit)||48));
    const kind=String(req.query.type||'ALL').toUpperCase();
    const generations=(await generationRepository.listAllGenerations(Math.min(250,requested*4)))
      .filter(g=>g.status==='SUCCEEDED'&&Boolean(g.result_url))
      .filter(g=>kind==='ALL'||mediaType(g.mode)===kind)
      .slice(0,requested);
    const items=await Promise.all(generations.map(g=>enrichGeneration(g,req.user!.uid)));
    res.json({success:true,data:{items}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_FEED_ERROR',message:err?.message||'Não foi possível carregar a comunidade.'}});}
});

communityRouter.post('/community/:generationId/like',async(req:AuthenticatedRequest,res)=>{
  try{
    const db=dbOrThrow(),generationId=req.params.generationId,userId=req.user!.uid;
    const generation=await generationRepository.getGeneration(generationId);
    if(!generation||generation.status!=='SUCCEEDED'||!generation.result_url)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const likeRef=db.collection('community_likes').doc(likeId(generationId,userId));
    const statsRef=db.collection('community_stats').doc(generationId);
    const result=await db.runTransaction(async tx=>{
      const [likeSnap,statsSnap]=await Promise.all([tx.get(likeRef),tx.get(statsRef)]);
      const current=Math.max(0,Number((statsSnap.data() as any)?.likes_count||0));
      if(likeSnap.exists){tx.delete(likeRef);tx.set(statsRef,{likes_count:Math.max(0,current-1),updated_at:new Date().toISOString()},{merge:true});return{liked:false,likes_count:Math.max(0,current-1)};}
      tx.set(likeRef,{generation_id:generationId,user_id:userId,created_at:new Date().toISOString()});tx.set(statsRef,{likes_count:current+1,updated_at:new Date().toISOString()},{merge:true});return{liked:true,likes_count:current+1};
    });
    res.json({success:true,data:result});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_LIKE_ERROR',message:err?.message||'Não foi possível atualizar a curtida.'}});}
});

communityRouter.post('/community/:generationId/download',async(req:AuthenticatedRequest,res)=>{
  try{
    const db=dbOrThrow(),generationId=req.params.generationId;
    const generation=await generationRepository.getGeneration(generationId);
    if(!generation||generation.status!=='SUCCEEDED'||!generation.result_url)return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const statsRef=db.collection('community_stats').doc(generationId);
    const downloads=await db.runTransaction(async tx=>{const snap=await tx.get(statsRef);const count=Math.max(0,Number((snap.data() as any)?.downloads_count||0))+1;tx.set(statsRef,{downloads_count:count,updated_at:new Date().toISOString()},{merge:true});return count;});
    res.json({success:true,data:{url:generation.result_url,downloads_count:downloads,media_type:mediaType(generation.mode)}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_DOWNLOAD_ERROR',message:err?.message||'Não foi possível preparar o download.'}});}
});

communityRouter.post('/community/:generationId/recreate',async(req:AuthenticatedRequest,res)=>{
  try{
    const db=dbOrThrow(),generationId=req.params.generationId,userId=req.user!.uid;
    const generation=await generationRepository.getGeneration(generationId);
    if(!generation||generation.status!=='SUCCEEDED')return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Criação não encontrada.'}});
    const clonedRefs=[] as any[];
    for(const ref of generation.references||[]){
      const srcDoc=await db.collection('assets').doc(ref.asset_id).get();
      if(!srcDoc.exists)continue;
      const a=srcDoc.data() as any;if(a.deleted_at||!a.public_url)continue;
      const cloned=await assetRepository.createAsset({owner_user_id:userId,type:a.type,category:'GENERIC',name:`Referência da comunidade - ${a.name||'asset'}`,storage_path:a.storage_path||`community://${a.asset_id}`,public_url:a.public_url,thumbnail_url:a.thumbnail_url||a.public_url,mime_type:a.mime_type|| (a.type==='VIDEO'?'video/mp4':'image/jpeg'),size_bytes:Number(a.size_bytes||0),width:a.width??null,height:a.height??null,duration_seconds:a.duration_seconds??null,status:'READY',origin:'UPLOAD'});
      clonedRefs.push({asset_id:cloned.asset_id,slot_type:ref.slot_type||'GENERAL',alias:ref.alias||cloned.alias});
    }
    res.json({success:true,data:{snapshot:{model_id:generation.model_id,mode:generation.mode,prompt:generation.original_prompt||'',negative_prompt:generation.negative_prompt||'',duration_seconds:generation.duration_seconds||5,resolution:generation.resolution||'720p',aspect_ratio:generation.aspect_ratio||'16:9',number_of_outputs:generation.number_of_outputs||1,seed:generation.seed??null,motion_strength:generation.motion_strength??null,references:clonedRefs},target:mediaType(generation.mode)==='IMAGE'?'create-image':'create-video'}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'COMMUNITY_RECREATE_ERROR',message:err?.message||'Não foi possível preparar a recriação.'}});}
});

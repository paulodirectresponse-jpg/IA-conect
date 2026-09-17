import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { publicCapabilityCatalog } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { providerCatalogService } from '../services/providerCatalogService.js';
import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';

export const musicGenerationRouter=Router();
const CAPABILITY='music';

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}

async function requireMusicEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const[audio,music]=await Promise.all([
      catalogRepository.getFeatureFlag('beta.audio'),
      catalogRepository.getFeatureFlag('beta.audio.music'),
    ]);
    if(!audio?.is_enabled||!music?.is_enabled){
      const normalized=normalizeBetaPublicError({code:'AUDIO_CAPABILITY_DISABLED'});
      return res.status(normalized.status).json({success:false,error:normalized.error});
    }
    next();
  }catch{
    const normalized=normalizeBetaPublicError({code:'AUDIO_CAPABILITY_DISABLED'});
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
}

async function tagMusicAssets(userId:string,job:any){
  if(job?.status!=='SUCCEEDED'||!Array.isArray(job.result_asset_ids))return;
  await Promise.all(job.result_asset_ids.map(async(assetId:string)=>{
    const asset=await assetRepository.getAsset(assetId,userId).catch(()=>null);
    if(!asset||asset.media_metadata?.capability_id===CAPABILITY)return;
    await assetRepository.updateAsset(assetId,userId,{
      name:String(asset.name||'').startsWith('Áudio gerado')?String(asset.name).replace('Áudio gerado','Música gerada'):asset.name,
      duration_seconds:Number(job.request?.controls?.duration_seconds||asset.duration_seconds||0)||asset.duration_seconds||null,
      media_metadata:{...(asset.media_metadata||{}),capability_id:CAPABILITY,instrumental:Boolean(job.request?.controls?.instrumental)},
    });
  }));
}

async function assertMusicJob(userId:string,jobId:string){
  const job=await betaJobOrchestrator.getPublic(userId,jobId);
  if(job?.request?.capability_id!==CAPABILITY){
    throw Object.assign(new Error('Geração de música não encontrada.'),{code:'JOB_NOT_FOUND'});
  }
  await tagMusicAssets(userId,job);
  return job;
}

musicGenerationRouter.use('/music',requireAuth,requireMusicEnabled);

musicGenerationRouter.get('/music/catalog',async(_req:AuthenticatedRequest,res)=>{
  try{
    const[models,policies,mappings,providers,pricing]=await Promise.all([
      catalogRepository.listModels(),
      betaCatalogPolicyService.listCatalog(),
      catalogRepository.listMappings(),
      providerCatalogService.listProviders(),
      providerPricingCatalogService.list(),
    ]);
    const base=publicCapabilityCatalog(models);
    const policyByModel=new Map(policies.map(policy=>[policy.model_id,policy]));
    const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
    const configured=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()]));
    const verifiedPriceKeys=new Set(pricing.filter(row=>row.verified).flatMap(row=>[
      `${row.provider_id}|${row.provider_model_identifier}|${row.capability_id||''}`,
      row.capability_id?null:`${row.provider_id}|${row.provider_model_identifier}|${CAPABILITY}`,
    ].filter(Boolean) as string[]));
    const providerChoices=(modelId:string)=>mappings
      .filter(mapping=>mapping.model_id===modelId&&mapping.status==='ACTIVE'&&(!mapping.capabilities?.length||mapping.capabilities.includes(CAPABILITY)))
      .flatMap(mapping=>{
        const provider=providerById.get(String(mapping.provider_id));
        const priced=verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|${CAPABILITY}`)||verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|`);
        if(!provider||provider.status!=='ACTIVE'||!configured.get(String(mapping.provider_id))||!priced)return[];
        return[{provider_id:String(provider.provider_id),name:provider.name}];
      })
      .filter((row,index,rows)=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
    const governed=base.flatMap(model=>{
      const policy=policyByModel.get(model.model_id);
      if(!policy?.eligible||!policy.capability_ids.includes(CAPABILITY as any))return[];
      const capability=model.capabilities.find(item=>item.id===CAPABILITY);
      return capability?[{...model,capabilities:[capability],pricing_policy_id:policy.pricing_policy_id,providers:providerChoices(model.model_id)}]:[];
    });
    const autoEligible=policies.some(policy=>policy.eligible&&policy.auto_routing_enabled&&policy.capability_ids.includes(CAPABILITY as any));
    if(autoEligible){
      const sample=governed.find(model=>model.capabilities.length)?.capabilities[0];
      const autoProviders=governed.flatMap((model:any)=>model.providers||[]).filter((row:any,index:number,rows:any[])=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
      if(sample)governed.unshift({model_id:'AUTO',name:'AUTO',category:'AUTO',supported_durations:sample.supported_durations||[],capabilities:[sample],pricing_policy_id:null,providers:autoProviders} as any);
    }
    return res.json({success:true,data:{models:governed}});
  }catch(error:any){return failure(res,error,'Não foi possível carregar o gerador de música.');}
});

musicGenerationRouter.post('/music/jobs',async(req:AuthenticatedRequest,res)=>{
  try{
    const body={...req.body,capability_id:CAPABILITY,references:[]};
    const job=await betaJobOrchestrator.create(req.user!.uid,body,idem(req));
    return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível preparar a geração de música.');}
});

musicGenerationRouter.get('/music/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await assertMusicJob(req.user!.uid,req.params.jobId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar a geração de música.');}
});

musicGenerationRouter.post('/music/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertMusicJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível calcular os créditos da música.');}
});

musicGenerationRouter.post('/music/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertMusicJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);
    const publicJob=await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id);
    await tagMusicAssets(req.user!.uid,publicJob);
    return res.json({success:true,data:publicJob});
  }catch(error:any){return failure(res,error,'Não foi possível iniciar a geração de música.');}
});

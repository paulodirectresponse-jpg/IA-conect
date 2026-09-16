import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaLibraryService } from '../beta/library/libraryService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { AssetType } from '../../src/types/index.js';

export const betaLibraryRouter=Router();
const TYPES=new Set<AssetType>(['IMAGE','VIDEO','AUDIO','MODEL_3D']);

async function requireBetaEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const flag=await catalogRepository.getFeatureFlag('beta.enabled');
    if(!flag?.is_enabled){
      const normalized=normalizeBetaPublicError({code:'BETA_DISABLED'});
      return res.status(normalized.status).json({success:false,error:normalized.error});
    }
    next();
  }catch{
    const normalized=normalizeBetaPublicError({code:'BETA_ACCESS_UNAVAILABLE'});
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
}
function failure(res:Response,error:any,fallback:string){
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}
function bool(value:any){return String(value||'').toLowerCase()==='true';}

betaLibraryRouter.use('/beta/library',requireAuth,requireBetaEnabled);
betaLibraryRouter.use('/beta/projects',requireAuth,requireBetaEnabled);
betaLibraryRouter.use('/beta/collections',requireAuth,requireBetaEnabled);

betaLibraryRouter.get('/beta/library/assets',async(req:AuthenticatedRequest,res)=>{
  try{
    const rawType=String(req.query.type||'').toUpperCase();
    const type=rawType&&TYPES.has(rawType as AssetType)?rawType as AssetType:undefined;
    const data=await betaLibraryService.listPage(req.user!.uid,{
      type,
      search:String(req.query.search||'').trim()||undefined,
      origin:String(req.query.origin||'').trim()||undefined,
      favorite:req.query.favorite===undefined?undefined:bool(req.query.favorite),
      project_id:String(req.query.project_id||'').trim()||undefined,
      collection_id:String(req.query.collection_id||'').trim()||undefined,
      tag:String(req.query.tag||'').trim()||undefined,
      cursor:String(req.query.cursor||'').trim()||undefined,
      limit:Number(req.query.limit||24),
    });
    return res.json({success:true,data});
  }catch(error:any){return failure(res,error,'Não foi possível carregar a Library.');}
});

betaLibraryRouter.patch('/beta/library/assets/:assetId',async(req:AuthenticatedRequest,res)=>{
  try{
    const asset=await betaLibraryService.updateAssetOrganization(req.user!.uid,req.params.assetId,req.body||{});
    return res.json({success:true,data:asset});
  }catch(error:any){return failure(res,error,'Não foi possível organizar o asset.');}
});

betaLibraryRouter.post('/beta/library/assets/:assetId/remix',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.intent(req.user!.uid,req.params.assetId,'REMIX')});}
  catch(error:any){return failure(res,error,'Não foi possível preparar o Remix.');}
});
betaLibraryRouter.post('/beta/library/assets/:assetId/use-in',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.intent(req.user!.uid,req.params.assetId,'USE_IN')});}
  catch(error:any){return failure(res,error,'Não foi possível preparar o asset.');}
});

betaLibraryRouter.get('/beta/projects',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.projects(req.user!.uid)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar os projetos.');}
});
betaLibraryRouter.post('/beta/projects',async(req:AuthenticatedRequest,res)=>{
  try{return res.status(201).json({success:true,data:await betaLibraryService.createProject(req.user!.uid,req.body||{})});}
  catch(error:any){return failure(res,error,'Não foi possível criar o projeto.');}
});
betaLibraryRouter.patch('/beta/projects/:projectId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.updateProject(req.user!.uid,req.params.projectId,req.body||{})});}
  catch(error:any){return failure(res,error,'Não foi possível atualizar o projeto.');}
});
betaLibraryRouter.delete('/beta/projects/:projectId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.deleteProject(req.user!.uid,req.params.projectId)});}
  catch(error:any){return failure(res,error,'Não foi possível remover o projeto.');}
});

betaLibraryRouter.get('/beta/collections',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.collections(req.user!.uid)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar as coleções.');}
});
betaLibraryRouter.post('/beta/collections',async(req:AuthenticatedRequest,res)=>{
  try{return res.status(201).json({success:true,data:await betaLibraryService.createCollection(req.user!.uid,req.body||{})});}
  catch(error:any){return failure(res,error,'Não foi possível criar a coleção.');}
});
betaLibraryRouter.patch('/beta/collections/:collectionId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.updateCollection(req.user!.uid,req.params.collectionId,req.body||{})});}
  catch(error:any){return failure(res,error,'Não foi possível atualizar a coleção.');}
});
betaLibraryRouter.delete('/beta/collections/:collectionId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaLibraryService.deleteCollection(req.user!.uid,req.params.collectionId)});}
  catch(error:any){return failure(res,error,'Não foi possível remover a coleção.');}
});

import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { universalAssetService } from '../beta/assets/universalAssetService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { AssetType } from '../../src/types/index.js';

export const betaAssetRouter=Router();
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
  if(error?.code==='ASSET_NOT_FOUND')return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Asset não encontrado.',category:'NOT_FOUND',retryable:false,action:'NONE'}});
  if(error?.code==='ASSET_LINEAGE_FORBIDDEN')return res.status(403).json({success:false,error:{code:'ASSET_LINEAGE_FORBIDDEN',message:'Asset de origem indisponível.',category:'AUTHORIZATION',retryable:false,action:'NONE'}});
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}

betaAssetRouter.use('/beta/assets',requireAuth,requireBetaEnabled);

betaAssetRouter.get('/beta/assets',async(req:AuthenticatedRequest,res)=>{
  try{
    const requested=String(req.query.type||'').toUpperCase();
    const type=requested&&TYPES.has(requested as AssetType)?requested as AssetType:undefined;
    const search=String(req.query.search||'').trim()||undefined;
    return res.json({success:true,data:await universalAssetService.list(req.user!.uid,{type,search})});
  }catch(error:any){return failure(res,error,'Não foi possível carregar os assets.');}
});

betaAssetRouter.get('/beta/assets/:assetId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await universalAssetService.get(req.user!.uid,req.params.assetId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar o asset.');}
});

betaAssetRouter.get('/beta/assets/:assetId/lineage',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await universalAssetService.lineage(req.user!.uid,req.params.assetId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar a origem do asset.');}
});

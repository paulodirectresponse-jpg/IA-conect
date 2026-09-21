import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CAPABILITY_IDS } from '../beta/capabilityRegistry.js';
import { routingV2CatalogService } from '../routing-v2/catalogService.js';

export const betaCapabilityRouter=Router();

betaCapabilityRouter.get('/beta/capabilities',requireAuth,async(_req:AuthenticatedRequest,res)=>{
  try{
    return res.json({success:true,data:{models:await routingV2CatalogService.listCapabilityModels([...CAPABILITY_IDS])}});
  }catch{
    return res.status(503).json({success:false,error:{code:'CAPABILITY_CATALOG_UNAVAILABLE',message:'Catálogo de capabilities indisponível no momento.'}});
  }
});

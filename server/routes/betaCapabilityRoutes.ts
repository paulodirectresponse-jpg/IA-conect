import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { publicCapabilityCatalog } from '../beta/capabilityRegistry.js';

export const betaCapabilityRouter=Router();

betaCapabilityRouter.get('/beta/capabilities',requireAuth,async(_req:AuthenticatedRequest,res)=>{
  try{
    const models=await catalogRepository.listModels();
    return res.json({success:true,data:{models:publicCapabilityCatalog(models)}});
  }catch{
    return res.status(503).json({success:false,error:{code:'CAPABILITY_CATALOG_UNAVAILABLE',message:'Catálogo de capabilities indisponível no momento.'}});
  }
});

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { routingV2CatalogService } from '../routing-v2/catalogService.js';
import { isCapabilityId } from '../beta/capabilityRegistry.js';

export const catalogRouter = Router();

catalogRouter.get('/catalog/models', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await routingV2CatalogService.listGeneratorModels() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar modelos.' } });
  }
});

catalogRouter.get('/catalog/model-routes', requireAuth, async (req, res) => {
  try {
    const raw=String(req.query.capability_id||'').trim();
    const capabilityId=raw&&isCapabilityId(raw)?raw:undefined;
    if(raw&&!capabilityId)return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'Capability inválida.'}});
    const routes=await routingV2CatalogService.listGeneratorRoutes(capabilityId);
    res.json({success:true,data:routes});
  } catch (err: any) {
    res.status(500).json({success:false,error:{code:'MODEL_ROUTES_ERROR',message:'Erro ao listar rotas seguras de providers.'}});
  }
});


catalogRouter.get('/catalog/v2/models', requireAuth, async (_req, res) => {
  try {
    res.json({success:true,data:await routingV2CatalogService.listPublicModels()});
  } catch (err:any) {
    res.status(500).json({success:false,error:{code:'ROUTING_V2_CATALOG_ERROR',message:err?.message||'Erro ao listar catálogo V2.'}});
  }
});

catalogRouter.get('/catalog/v2/model-routes', requireAuth, async (req, res) => {
  try {
    const raw=String(req.query.capability_id||'').trim();
    const capabilityId=raw&&isCapabilityId(raw)?raw:undefined;
    if(raw&&!capabilityId)return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'Capability inválida.'}});
    res.json({success:true,data:await routingV2CatalogService.listPublicRoutes(capabilityId)});
  } catch (err:any) {
    res.status(500).json({success:false,error:{code:'ROUTING_V2_ROUTES_ERROR',message:err?.message||'Erro ao listar Routes V2.'}});
  }
});

catalogRouter.get('/catalog/promotions', requireAuth, async (req, res) => {
  try {
    const promotions = await catalogRepository.listPromotions();
    res.json({ success: true, data: promotions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar promoções.' } });
  }
});

// ==========================================
// STAGE 2: ASSETS & REFERENCES
// ==========================================

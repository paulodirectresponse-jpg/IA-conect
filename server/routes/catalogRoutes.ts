import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';

export const catalogRouter = Router();

catalogRouter.get('/catalog/models', requireAuth, async (req, res) => {
  try {
    const models = await catalogRepository.listModels();
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar modelos.' } });
  }
});

catalogRouter.get('/catalog/providers', requireAuth, async (req, res) => {
  try {
    const providers = await catalogRepository.listProviders();
    res.json({ success: true, data: providers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar provedores.' } });
  }
});

catalogRouter.get('/catalog/pricing', requireAuth, async (req, res) => {
  try {
    const pricing = await catalogRepository.listPricing();
    res.json({ success: true, data: pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar precificação.' } });
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
// ADMIN ENDPOINTS (Strictly protected)
// ==========================================

catalogRouter.get('/models', async (req, res) => {
  try {
    const models = await catalogRepository.listModels();
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'MODELS_LIST_ERROR', message: 'Erro ao carregar modelos.' } });
  }
});

catalogRouter.get('/models/:modelId', async (req, res) => {
  try {
    const model = await catalogRepository.getModel(req.params.modelId);
    if (!model) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado.' } });
    }
    res.json({ success: true, data: model });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'MODEL_GET_ERROR', message: 'Erro ao buscar modelo.' } });
  }
});

// ==========================================
// STAGE 2: ASSETS & REFERENCES
// ==========================================

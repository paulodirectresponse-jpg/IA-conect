import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { requireAuth,requireAdmin,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { betaEconomicsService } from '../beta/catalog/betaEconomicsService.js';
import { auditRepository } from '../repositories/auditRepository.js';

export const adminBetaCatalogRouter=Router();

adminBetaCatalogRouter.get('/admin/beta/catalog',requireAuth,requireAdmin,async(_req,res)=>{
  try{return res.json({success:true,data:await betaCatalogPolicyService.listCatalog()});}
  catch(err:any){return res.status(500).json({success:false,error:{code:'BETA_CATALOG_ADMIN_ERROR',message:err?.message||'Falha ao carregar catálogo Beta.'}});}
});

adminBetaCatalogRouter.get('/admin/beta/pricing-policies',requireAuth,requireAdmin,async(_req,res)=>{
  try{return res.json({success:true,data:await betaCatalogPolicyService.listPricingPolicies()});}
  catch(err:any){return res.status(500).json({success:false,error:{code:'BETA_PRICING_POLICY_LIST_ERROR',message:err?.message||'Falha ao carregar políticas.'}});}
});

adminBetaCatalogRouter.post('/admin/beta/pricing-policies',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const before=(await betaCatalogPolicyService.listPricingPolicies()).find(p=>p.pricing_policy_id===String(req.body?.pricing_policy_id||''))||null;
    const saved=await betaCatalogPolicyService.savePricingPolicy(req.body||{},req.user!.uid);
    await auditRepository.record({log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,admin_id:req.user!.uid,admin_email:req.user!.email,action:'BETA_PRICING_POLICY_SAVED',entity_type:'PRICING',entity_id:saved.pricing_policy_id,before,after:saved,reason:String(req.body?.reason||'Atualização da política de pricing Beta'),created_at:new Date().toISOString()});
    return res.json({success:true,data:saved});
  }catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'BETA_PRICING_POLICY_SAVE_ERROR',message:err?.message||'Falha ao salvar política.'}});}
});

adminBetaCatalogRouter.patch('/admin/beta/models/:modelId/policy',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const before=(await betaCatalogPolicyService.listCatalog()).find(m=>m.model_id===req.params.modelId)||null;
    const saved=await betaCatalogPolicyService.saveModelPolicy(req.params.modelId,req.body||{},req.user!.uid);
    const after=(await betaCatalogPolicyService.listCatalog()).find(m=>m.model_id===req.params.modelId)||saved;
    await auditRepository.record({log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,admin_id:req.user!.uid,admin_email:req.user!.email,action:'BETA_MODEL_POLICY_SAVED',entity_type:'MODEL',entity_id:req.params.modelId,before,after,reason:String(req.body?.reason||'Atualização da elegibilidade Beta'),created_at:new Date().toISOString()});
    return res.json({success:true,data:after});
  }catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'BETA_MODEL_POLICY_SAVE_ERROR',message:err?.message||'Falha ao salvar política do modelo.'}});}
});

adminBetaCatalogRouter.get('/admin/beta/economic-ledger',requireAuth,requireAdmin,async(req:Request,res:Response)=>{
  try{return res.json({success:true,data:await betaEconomicsService.listLedger(Math.min(500,Math.max(1,Number(req.query.limit||100))))});}
  catch(err:any){return res.status(500).json({success:false,error:{code:'BETA_ECONOMIC_LEDGER_ERROR',message:err?.message||'Falha ao carregar ledger econômico.'}});}
});

import express from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { providerModelScanService } from '../services/providerModelScanService.js';
import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';

export const providerScanRouter=express.Router();

providerScanRouter.get('/admin/provider-scan',requireAuth,requireAdmin,async(_req,res)=>{
  try{res.json({success:true,data:{latest:await providerModelScanService.latest(),pricing:await providerPricingCatalogService.list()}});}
  catch(err:any){res.status(500).json({success:false,error:{code:'PROVIDER_SCAN_READ_ERROR',message:err?.message||'Falha ao carregar scans.'}});}
});

providerScanRouter.post('/admin/provider-scan',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const providerId=String(req.body?.provider_id||'').trim();
    const data=providerId?await providerModelScanService.scanProvider(providerId):await providerModelScanService.scanAll();
    res.json({success:true,data});
  }catch(err:any){res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_SCAN_ERROR',message:err?.message||'Falha no scan de providers.'}});}
});

providerScanRouter.post('/admin/provider-pricing',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const body=req.body||{};
    if(!body.provider_id||!body.provider_model_identifier||!body.unit||!Number.isFinite(Number(body.unit_price_usd)))throw Object.assign(new Error('provider_id, provider_model_identifier, unit e unit_price_usd são obrigatórios.'),{code:'VALIDATION_ERROR'});
    const verified=body.verified===true;
    const saved=await providerPricingCatalogService.save({
      provider_id:String(body.provider_id),provider_model_identifier:String(body.provider_model_identifier),capability_id:body.capability_id?String(body.capability_id):null,
      unit:body.unit,unit_price_usd:Number(body.unit_price_usd),minimum_usd:body.minimum_usd==null?null:Number(body.minimum_usd),
      resolution_prices_usd:body.resolution_prices_usd&&typeof body.resolution_prices_usd==='object'?body.resolution_prices_usd:undefined,
      verified,source:body.source==='LIVE_CATALOG'?'LIVE_CATALOG':body.source==='PROVIDER_DOCS'?'PROVIDER_DOCS':'MANUAL_VERIFIED',
      verified_at:verified?new Date().toISOString():String(body.verified_at||''),
    });
    res.json({success:true,data:saved});
  }catch(err:any){res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_PRICING_ERROR',message:err?.message||'Falha ao salvar preço do provider.'}});}
});

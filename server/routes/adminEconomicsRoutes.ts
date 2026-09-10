import { Router } from 'express';
import { requireAuth,requireAdmin,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { economicsAnalyticsService } from '../services/economicsAnalyticsService.js';

export const adminEconomicsRouter=Router();
adminEconomicsRouter.get('/admin/economics/overview',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await economicsAnalyticsService.overview(String(req.query.range||'30d'))});}catch(err:any){return res.status(500).json({success:false,error:{code:'ECONOMICS_OVERVIEW_ERROR',message:err?.message||'Falha ao carregar economia.'}});}});
adminEconomicsRouter.get('/admin/economics/generations',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await economicsAnalyticsService.generations(String(req.query.range||'30d'),Number(req.query.limit||100))});}catch(err:any){return res.status(500).json({success:false,error:{code:'ECONOMICS_GENERATIONS_ERROR',message:err?.message||'Falha ao carregar gerações econômicas.'}});}});

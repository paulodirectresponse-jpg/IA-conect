import { Router } from 'express';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { billingControlService } from '../services/billingControlService.js';

export const adminBillingRouter=Router();

adminBillingRouter.get('/admin/billing-control',requireAuth,requireAdmin,async(_req,res)=>{
  try{return res.json({success:true,data:await billingControlService.get(true)});}
  catch(err:any){return res.status(500).json({success:false,error:{code:'BILLING_CONTROL_FAILED',message:err?.message||'Não foi possível carregar os controles.'}});}
});

adminBillingRouter.post('/admin/billing-control',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const allowed=['credit_v2_enabled','new_generations_enabled','provider_execution_enabled','yellow_execution_enabled'];
    const patch:Record<string,boolean>={};
    for(const key of allowed)if(req.body?.[key]!==undefined)patch[key]=Boolean(req.body[key]);
    return res.json({success:true,data:await billingControlService.set(patch,req.user?.uid)});
  }catch(err:any){return res.status(500).json({success:false,error:{code:'BILLING_CONTROL_SAVE_FAILED',message:err?.message||'Não foi possível salvar os controles.'}});}
});

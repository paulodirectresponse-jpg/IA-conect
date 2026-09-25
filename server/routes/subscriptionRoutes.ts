import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { subscriptionService } from '../services/subscriptionService.js';

export const subscriptionRouter=Router();

subscriptionRouter.get('/subscriptions/me',requireAuth,async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await subscriptionService.getCurrent(req.user!.uid,{sync:true})});}
  catch(err:any){return res.status(500).json({success:false,error:{code:err?.code||'SUBSCRIPTION_FETCH_ERROR',message:err?.message||'Não foi possível carregar a assinatura.'}});}
});

subscriptionRouter.post('/subscriptions/checkout',requireAuth,async(req:AuthenticatedRequest,res)=>{
  try{
    const data=await subscriptionService.createCheckout({
      userId:req.user!.uid,
      email:String(req.user!.email||''),
      packId:String(req.body?.pack_id||''),
      packVersion:Number(req.body?.pack_version||0),
    });
    return res.json({success:true,data});
  }catch(err:any){
    const status=['PLAN_VERSION_STALE','SUBSCRIPTION_ALREADY_ACTIVE'].includes(err?.code)?409:400;
    return res.status(status).json({success:false,error:{code:err?.code||'SUBSCRIPTION_CHECKOUT_ERROR',message:err?.message||'Não foi possível iniciar a assinatura.'}});
  }
});

subscriptionRouter.post('/subscriptions/change',requireAuth,async(req:AuthenticatedRequest,res)=>{
  try{
    const data=await subscriptionService.requestPlanChange(req.user!.uid,String(req.body?.pack_id||''),Number(req.body?.pack_version||0));
    return res.json({success:true,data});
  }catch(err:any){
    return res.status(400).json({success:false,error:{code:err?.code||'SUBSCRIPTION_CHANGE_ERROR',message:err?.message||'Não foi possível alterar o plano.'}});
  }
});

subscriptionRouter.post('/subscriptions/cancel',requireAuth,async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await subscriptionService.cancel(req.user!.uid)});}
  catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'SUBSCRIPTION_CANCEL_ERROR',message:err?.message||'Não foi possível cancelar a assinatura.'}});}
});

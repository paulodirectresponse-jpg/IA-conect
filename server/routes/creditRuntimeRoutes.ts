import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { creditWalletService } from '../services/creditWalletService.js';
import { packCatalogService } from '../services/packCatalogService.js';
import { paymentService } from '../services/paymentService.js';
import { adminService } from '../services/adminService.js';
import { billingControlService } from '../services/billingControlService.js';

export const creditRuntimeRouter=Router();

creditRuntimeRouter.get('/credits/account',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{res.json({success:true,data:await creditWalletService.getAccount(req.user!.uid)});}catch(err:any){res.status(500).json({success:false,error:{code:'CREDIT_ACCOUNT_ERROR',message:err?.message||'Não foi possível carregar os créditos.'}});}
});
creditRuntimeRouter.get('/credits/transactions',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{const rows=await creditWalletService.listTransactions(req.user!.uid,Number(req.query.limit||50));res.json({success:true,data:{transactions:rows,total:rows.length}});}catch(err:any){res.status(500).json({success:false,error:{code:'CREDIT_LEDGER_ERROR',message:err?.message||'Não foi possível carregar as movimentações.'}});}
});
creditRuntimeRouter.get('/credits/packs',requireAuth,(_req,res)=>res.json({success:true,data:packCatalogService.list()}));
creditRuntimeRouter.post('/credits/purchase',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{
  const controls=await billingControlService.get(false);if(!controls.credit_v2_enabled)return res.status(503).json({success:false,error:{code:'CREDIT_BILLING_DISABLED',message:'A compra de créditos está temporariamente indisponível.'}});
  const packId=String(req.body?.pack_id||'');const packVersion=Number(req.body?.pack_version);const pack=packCatalogService.get(packId,packVersion);
  if(!pack)return res.status(409).json({success:false,error:{code:'PACK_VERSION_STALE',message:'Este pack foi atualizado. Recarregue os packs antes de pagar.'}});
  const payment=await paymentService.createPayment({userId:req.user!.uid,amount_cents:pack.price_brl_cents,method:'PIX',pack_id:pack.pack_id,pack_version:pack.version});return res.json({success:true,data:payment});
 }catch(err:any){return res.status(err?.code==='CREDIT_BILLING_DISABLED'?503:400).json({success:false,error:{code:err?.code||'CREDIT_PURCHASE_ERROR',message:err?.message||'Não foi possível iniciar a compra de créditos.'}});}
});
creditRuntimeRouter.post('/admin/users/:userId/adjust-credits',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
 try{const type=String(req.body?.type||'') as 'ADMIN_CREDIT'|'ADMIN_DEBIT',amount=Number(req.body?.amount_credits),reason=String(req.body?.reason||''),key=String(req.body?.idempotency_key||`credit-adj:${Date.now()}:${Math.random()}`);if(!['ADMIN_CREDIT','ADMIN_DEBIT'].includes(type))return res.status(400).json({success:false,error:{code:'INVALID_TYPE',message:'Tipo de ajuste inválido.'}});const account=await adminService.adjustCredits({adminId:req.user!.uid,adminEmail:req.user!.email||'',targetUserId:req.params.userId,type,amount_credits:amount,reason,idempotency_key:key});return res.json({success:true,data:{account}});}catch(err:any){return res.status(err?.code==='CREDIT_INSUFFICIENT_FUNDS'?400:500).json({success:false,error:{code:err?.code||'CREDIT_ADJUST_ERROR',message:err?.message||'Não foi possível ajustar créditos.'}});}
});

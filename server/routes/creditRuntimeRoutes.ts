import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { creditWalletService } from '../services/creditWalletService.js';
import { packCatalogService } from '../services/packCatalogService.js';
import { paymentService } from '../services/paymentService.js';

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
  const packId=String(req.body?.pack_id||'');
  const packVersion=Number(req.body?.pack_version);
  const pack=packCatalogService.get(packId,packVersion);
  if(!pack)return res.status(409).json({success:false,error:{code:'PACK_VERSION_STALE',message:'Este pack foi atualizado. Recarregue os packs antes de pagar.'}});
  const payment=await paymentService.createPayment({userId:req.user!.uid,amount_cents:pack.price_brl_cents,method:'PIX',pack_id:pack.pack_id,pack_version:pack.version});
  return res.json({success:true,data:payment});
 }catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'CREDIT_PURCHASE_ERROR',message:err?.message||'Não foi possível iniciar a compra de créditos.'}});}
});

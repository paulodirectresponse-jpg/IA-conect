import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { creditWalletService } from '../services/creditWalletService.js';
import { packCatalogService } from '../services/packCatalogService.js';

export const creditRuntimeRouter=Router();

creditRuntimeRouter.get('/credits/account',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{res.json({success:true,data:await creditWalletService.getAccount(req.user!.uid)});}catch(err:any){res.status(500).json({success:false,error:{code:'CREDIT_ACCOUNT_ERROR',message:err?.message||'Não foi possível carregar os créditos.'}});}
});
creditRuntimeRouter.get('/credits/transactions',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{const rows=await creditWalletService.listTransactions(req.user!.uid,Number(req.query.limit||50));res.json({success:true,data:{transactions:rows,total:rows.length}});}catch(err:any){res.status(500).json({success:false,error:{code:'CREDIT_LEDGER_ERROR',message:err?.message||'Não foi possível carregar as movimentações.'}});}
});
creditRuntimeRouter.get('/credits/packs',requireAuth,(_req,res)=>res.json({success:true,data:packCatalogService.list()}));

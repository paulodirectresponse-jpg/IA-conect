import { apiRequest } from './apiClient.js';
import { WalletAccount } from '../types/index.js';
import { CreditTransaction, PackVersion } from '../types/credits.js';

function emptyWallet(userId=''):WalletAccount{return{account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()}as WalletAccount;}
export const walletService={
 async getSummary():Promise<WalletAccount>{try{return await apiRequest<WalletAccount>('/api/credits/account');}catch(err){console.warn('[CreditWallet] account unavailable',err);return emptyWallet();}},
 async listTransactions(max=50,_offset=0):Promise<{transactions:CreditTransaction[];total:number}>{try{return await apiRequest(`/api/credits/transactions?limit=${Math.min(100,max)}`);}catch(err){console.warn('[CreditWallet] ledger unavailable',err);return{transactions:[],total:0};}},
 async listPacks():Promise<PackVersion[]>{return apiRequest<PackVersion[]>('/api/credits/packs');},
 async inspectCoupon(code:string,pack?:PackVersion){return apiRequest<any>('/api/credits/coupon/inspect',{method:'POST',body:JSON.stringify({coupon_code:code,pack_id:pack?.pack_id,pack_version:pack?.version})});},
 async redeemCoupon(code:string){return apiRequest<any>('/api/credits/coupon/redeem',{method:'POST',body:JSON.stringify({coupon_code:code})});},
};

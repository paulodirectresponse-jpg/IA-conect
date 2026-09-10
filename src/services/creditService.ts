import { apiRequest } from './apiClient.js';
import { CreditAccount, CreditTransaction, PackVersion } from '../types/credits.js';

export const creditService={
 async getAccount():Promise<CreditAccount>{
  return apiRequest<CreditAccount>('/api/credits/account');
 },
 async listTransactions(max=50):Promise<{transactions:CreditTransaction[];total:number}>{
  return apiRequest(`/api/credits/transactions?limit=${Math.min(100,max)}`);
 },
 async listPacks():Promise<PackVersion[]>{
  return apiRequest<PackVersion[]>('/api/credits/packs');
 },
 async inspectCoupon(code:string,pack?:PackVersion){
  return apiRequest<any>('/api/credits/coupon/inspect',{method:'POST',body:JSON.stringify({coupon_code:code,pack_id:pack?.pack_id,pack_version:pack?.version})});
 },
 async redeemCoupon(code:string){
  return apiRequest<any>('/api/credits/coupon/redeem',{method:'POST',body:JSON.stringify({coupon_code:code})});
 },
};

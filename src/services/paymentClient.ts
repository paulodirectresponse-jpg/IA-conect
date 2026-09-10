import { apiRequest } from './apiClient.js';
import { PaymentRecord } from '../types/index.js';

export interface CouponQuote {valid:true;coupon:any;original_amount_cents:number;discount_cents:number;final_amount_cents:number;bonus_credits:number;total_credits:number;}
export const paymentClient = {
  createPix(amountCents:number){ return apiRequest<PaymentRecord>('/api/payments',{method:'POST',body:JSON.stringify({amount_cents:amountCents,method:'PIX'})}); },
  quoteCoupon(packId:string,packVersion:number,couponCode:string){return apiRequest<CouponQuote>('/api/credits/coupon/quote',{method:'POST',body:JSON.stringify({pack_id:packId,pack_version:packVersion,coupon_code:couponCode})});},
  purchasePack(packId:string,packVersion:number,couponCode?:string){return apiRequest<PaymentRecord>('/api/credits/purchase',{method:'POST',body:JSON.stringify({pack_id:packId,pack_version:packVersion,coupon_code:couponCode||undefined})});},
  get(paymentId:string){ return apiRequest<PaymentRecord>(`/api/payments/${paymentId}`); },
  list(){ return apiRequest<PaymentRecord[]>('/api/payments'); },
};

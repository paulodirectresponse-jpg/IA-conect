import { apiRequest } from './apiClient.js';
import { PaymentRecord } from '../types/index.js';

export const paymentClient = {
  createPix(amountCents:number){ return apiRequest<PaymentRecord>('/api/payments',{method:'POST',body:JSON.stringify({amount_cents:amountCents,method:'PIX'})}); },
  purchasePack(packId:string,packVersion:number){return apiRequest<PaymentRecord>('/api/credits/purchase',{method:'POST',body:JSON.stringify({pack_id:packId,pack_version:packVersion})});},
  get(paymentId:string){ return apiRequest<PaymentRecord>(`/api/payments/${paymentId}`); },
  list(){ return apiRequest<PaymentRecord[]>('/api/payments'); },
};

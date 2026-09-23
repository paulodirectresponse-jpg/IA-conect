import { apiRequest } from './apiClient.js';
import { PaymentRecord } from '../types/index.js';

export interface CourseOffer {
  course_id:string;
  version:number;
  title:string;
  subtitle:string;
  price_brl_cents:number;
  currency:'BRL';
  checkout_enabled:boolean;
  vsl_url?:string|null;
}

export interface CourseAccessResult {
  active:boolean;
  entitlement?:{
    entitlement_id:string;
    course_id:string;
    course_version:number;
    user_id:string;
    status:'ACTIVE'|'REVOKED';
    payment_id:string;
    granted_at:string;
    revoked_at?:string|null;
  }|null;
}

export const courseSalesClient={
  getOffer(){return apiRequest<CourseOffer>('/api/course-sales/animation-3d/offer');},
  createCheckout(attribution?:Record<string,string>){return apiRequest<PaymentRecord>('/api/course-sales/animation-3d/checkout',{method:'POST',body:JSON.stringify({attribution:attribution||{}})});},
  getPayment(paymentId:string){return apiRequest<PaymentRecord>(`/api/payments/${encodeURIComponent(paymentId)}`);},
  getAccess(){return apiRequest<CourseAccessResult>('/api/course-sales/animation-3d/access');},
};

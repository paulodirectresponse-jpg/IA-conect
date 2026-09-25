import { apiRequest } from './apiClient.js';
import { UserSubscription } from '../types/credits.js';

export const subscriptionClient={
  getCurrent(){return apiRequest<UserSubscription|null>('/api/subscriptions/me');},
  createCheckout(packId:string,packVersion:number){return apiRequest<UserSubscription>('/api/subscriptions/checkout',{method:'POST',body:JSON.stringify({pack_id:packId,pack_version:packVersion})});},
  changePlan(packId:string,packVersion:number){return apiRequest<UserSubscription>('/api/subscriptions/change',{method:'POST',body:JSON.stringify({pack_id:packId,pack_version:packVersion})});},
  cancel(){return apiRequest<UserSubscription|null>('/api/subscriptions/cancel',{method:'POST',body:'{}'});},
};

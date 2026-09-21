import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export interface CourseEntitlement {
  entitlement_id: string;
  course_id: string;
  course_version: number;
  user_id: string;
  status: 'ACTIVE' | 'REVOKED';
  source: 'PURCHASE';
  payment_id: string;
  granted_at: string;
  revoked_at?: string | null;
  updated_at: string;
}

const entitlementId = (courseId:string,userId:string) => `${courseId}__${userId}`;

export const courseEntitlementService = {
  async get(courseId:string,userId:string):Promise<CourseEntitlement|null>{
    const id=entitlementId(courseId,userId);
    const doc=await firestoreAdminRest.get(`course_entitlements/${encodeURIComponent(id)}`);
    return doc.exists ? doc.data as CourseEntitlement : null;
  },

  async grant(params:{courseId:string;courseVersion:number;userId:string;paymentId:string}):Promise<CourseEntitlement>{
    const id=entitlementId(params.courseId,params.userId);
    const path=`course_entitlements/${encodeURIComponent(id)}`;
    const existing=await firestoreAdminRest.get(path);
    const now=new Date().toISOString();
    const entitlement:CourseEntitlement={
      entitlement_id:id,
      course_id:params.courseId,
      course_version:params.courseVersion,
      user_id:params.userId,
      status:'ACTIVE',
      source:'PURCHASE',
      payment_id:params.paymentId,
      granted_at:existing.data?.granted_at || now,
      revoked_at:null,
      updated_at:now,
    };
    await firestoreAdminRest.set(path,entitlement);
    return entitlement;
  },

  async revoke(courseId:string,userId:string,paymentId:string):Promise<CourseEntitlement|null>{
    const id=entitlementId(courseId,userId);
    const path=`course_entitlements/${encodeURIComponent(id)}`;
    const existing=await firestoreAdminRest.get(path);
    if(!existing.exists)return null;
    const current=existing.data as CourseEntitlement;
    if(current.payment_id!==paymentId)return current;
    const now=new Date().toISOString();
    const next:CourseEntitlement={...current,status:'REVOKED',revoked_at:now,updated_at:now};
    await firestoreAdminRest.set(path,next);
    return next;
  },
};

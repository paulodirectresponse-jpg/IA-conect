import { AuditLog } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

export const auditRepository = {
  async record(log:AuditLog):Promise<AuditLog> {
    await firestoreAdminRest.commit([{
      update:{name:firestoreAdminRest.docName(`audit_logs/${encodeURIComponent(log.log_id)}`),fields:firestoreAdminRest.fields(log)},
      currentDocument:{exists:false},
    }]);
    return {...log};
  },

  async list(options:{entity_type?:string;limit?:number;offset?:number}={}):Promise<{logs:AuditLog[];total:number}> {
    const limit = Math.min(100,Math.max(1,options.limit || 20));
    const offset = Math.max(0,options.offset || 0);
    const query:any = {from:[{collectionId:'audit_logs'}],limit:Math.min(500,Math.max(limit+offset,100))};
    if (options.entity_type) {
      query.where = {fieldFilter:{field:{fieldPath:'entity_type'},op:'EQUAL',value:{stringValue:options.entity_type}}};
    }
    const rows = await firestoreAdminRest.runQuery(query);
    const all = rows
      .map((row:any)=>row.data as AuditLog)
      .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
    return {logs:all.slice(offset,offset+limit),total:all.length};
  },

  clearForTesting() {},
};

import crypto from'crypto';
import{firestoreAdminRest}from'../../repositories/firestoreAdminRest.js';
import{BetaShareRecord}from'./sharingTypes.js';
const COLLECTION='beta_shares';
const safe=(v:string)=>encodeURIComponent(v);
const makeId=()=>`share_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
export const betaSharingRepository={
  makeId,
  async list(userId:string):Promise<BetaShareRecord[]>{const rows=await firestoreAdminRest.runQuery({from:[{collectionId:COLLECTION}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},limit:200});return rows.map((r:any)=>r.data as BetaShareRecord).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));},
  async get(shareId:string,userId:string):Promise<BetaShareRecord|null>{const d=await firestoreAdminRest.get(`${COLLECTION}/${safe(shareId)}`);if(!d.exists)return null;const row=d.data as BetaShareRecord;return row.user_id===userId?row:null;},
  async getByTokenHash(tokenHash:string):Promise<BetaShareRecord|null>{const rows=await firestoreAdminRest.runQuery({from:[{collectionId:COLLECTION}],where:{fieldFilter:{field:{fieldPath:'token_hash'},op:'EQUAL',value:{stringValue:tokenHash}}},limit:1});return rows[0]?.data as BetaShareRecord||null;},
  async save(row:BetaShareRecord){await firestoreAdminRest.set(`${COLLECTION}/${safe(row.share_id)}`,row);return row;},
};

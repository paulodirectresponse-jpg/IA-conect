import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { CopilotProposalRecord } from './copilotTypes.js';
const COLLECTION='beta_copilot_proposals',safe=(v:string)=>encodeURIComponent(v),now=()=>new Date().toISOString();
const id=()=>`cprop_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
export const copilotProposalRepository={
 async get(proposalId:string,userId:string){const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(proposalId)}`);if(!doc.exists)return null;const row=doc.data as CopilotProposalRecord;return row.owner_user_id===userId?row:null;},
 async create(input:Omit<CopilotProposalRecord,'proposal_id'|'created_at'|'updated_at'>){const timestamp=now();const row:CopilotProposalRecord={...input,proposal_id:id(),created_at:timestamp,updated_at:timestamp};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.proposal_id)}`,row);return row;},
 async save(row:CopilotProposalRecord){const next={...row,updated_at:now()};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.proposal_id)}`,next);return next;},
};

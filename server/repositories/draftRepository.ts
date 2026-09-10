import crypto from 'crypto';
import { WorkspaceDraft } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

const safe=(value:string)=>encodeURIComponent(value);

export const draftRepository = {
  async getLatestDraft(userId:string):Promise<WorkspaceDraft|null> {
    const rows = await firestoreAdminRest.runQuery({
      from:[{collectionId:'workspace_drafts'}],
      where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      limit:100,
    });
    const drafts = rows.map((row:any)=>row.data as WorkspaceDraft)
      .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
    return drafts[0] || null;
  },

  async getDraft(draftId:string,userId:string):Promise<WorkspaceDraft|null> {
    const doc = await firestoreAdminRest.get(`workspace_drafts/${safe(draftId)}`);
    if (!doc.exists) return null;
    const draft = doc.data as WorkspaceDraft;
    return draft.user_id === userId ? draft : null;
  },

  async saveDraft(userId:string,draftData:Partial<WorkspaceDraft>&{draft_id?:string}):Promise<WorkspaceDraft> {
    const latest = draftData.draft_id ? null : await this.getLatestDraft(userId);
    const draftId = draftData.draft_id || latest?.draft_id || `dft_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const current = await this.getDraft(draftId,userId);
    const now = new Date().toISOString();
    const updated:WorkspaceDraft = {
      draft_id:draftId,
      user_id:userId,
      model_id:draftData.model_id || current?.model_id || latest?.model_id || 'AUTO',
      mode:draftData.mode || current?.mode || latest?.mode || 'TEXT_TO_VIDEO',
      prompt:draftData.prompt !== undefined ? draftData.prompt : current?.prompt || latest?.prompt || '',
      negative_prompt:draftData.negative_prompt !== undefined ? draftData.negative_prompt : current?.negative_prompt || latest?.negative_prompt,
      references:draftData.references || current?.references || latest?.references || [],
      settings:draftData.settings || current?.settings || latest?.settings || {
        duration_seconds:5,resolution:'720p',aspect_ratio:'16:9',number_of_outputs:1,seed:null,
      },
      preset_id:draftData.preset_id !== undefined ? draftData.preset_id : current?.preset_id || latest?.preset_id,
      created_at:current?.created_at || latest?.created_at || draftData.created_at || now,
      updated_at:now,
    };
    await firestoreAdminRest.set(`workspace_drafts/${safe(draftId)}`,updated);
    return updated;
  },

  async deleteDraft(draftId:string,userId:string):Promise<boolean> {
    const draft = await this.getDraft(draftId,userId);
    if (!draft) return false;
    await firestoreAdminRest.commit([{delete:firestoreAdminRest.docName(`workspace_drafts/${safe(draftId)}`)}]);
    return true;
  },
};

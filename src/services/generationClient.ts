import { apiRequest } from './apiClient.js';
import { Generation, GenerationMode, GenerationRequestDraft, WorkspaceReference } from '../types/index.js';

export interface GenerationQuoteParams {
  model_id:string;
  mode:GenerationMode;
  prompt:string;
  negative_prompt?:string;
  references:WorkspaceReference[];
  settings:{
    duration_seconds:number;
    resolution:string;
    aspect_ratio:string;
    number_of_outputs:number;
    seed?:number|null;
    motion_strength?:number;
    audio_enabled?:boolean;
    model_variant?:string;
    pricing_options?:Record<string,string|number|boolean|null|undefined>;
  };
}

export type PricedGenerationDraft = GenerationRequestDraft & {
  has_sufficient_funds:boolean;
  balance_after_generation_cents:number;
  retail_credit_price?:number;
  unit_credit_price?:number;
  pricing_unit?:string;
  base_duration_seconds?:number;
  billing_units?:number;
  authorized_credit_price?:number;
  credit_balance_available?:number;
  balance_after_generation_credits?:number;
  retail_pricing_id?:string;
  retail_pricing_version?:number;
  pricing_signature_hash?:string;
};

function normalizeReferences(draft:GenerationRequestDraft) {
  const refs = draft.references || [];
  const hasExplicitRoles = refs.some(r => Boolean(r.role));
  return refs.map((r,index) => {
    const role = String(r.role || '').toUpperCase();
    let slot_type:'INITIAL'|'END'|'GENERAL' = 'GENERAL';
    if (['START_FRAME','INITIAL_FRAME','INITIAL'].includes(role)) slot_type = 'INITIAL';
    else if (['END_FRAME','END'].includes(role)) slot_type = 'END';
    else if (!hasExplicitRoles && draft.mode === 'IMAGE_TO_VIDEO') {
      slot_type = index === 0 ? 'INITIAL' : index === 1 ? 'END' : 'GENERAL';
    }
    return {asset_id:r.asset_id,slot_type,alias:r.alias_snapshot};
  });
}

export const generationClient = {
  quote(params:GenerationQuoteParams):Promise<{request_draft:PricedGenerationDraft;notice:string}> {
    return apiRequest('/api/generations/quote', {method:'POST',body:JSON.stringify(params)});
  },

  async create(draft:GenerationRequestDraft):Promise<Generation> {
    const d:any = draft;
    const s:any = draft.settings || {};
    return apiRequest<Generation>('/api/generations', {
      method:'POST',
      body:JSON.stringify({
        model_id:draft.model_id,
        mode:draft.mode,
        prompt:draft.prompt,
        negative_prompt:d.negative_prompt,
        duration_seconds:s.duration_seconds || 1,
        resolution:s.resolution,
        aspect_ratio:s.aspect_ratio,
        number_of_outputs:s.number_of_outputs,
        seed:s.seed,
        motion_strength:s.motion_strength,
        audio_enabled:s.audio_enabled === undefined ? undefined : Boolean(s.audio_enabled),
        model_variant:s.model_variant,
        pricing_options:s.pricing_options,
        references:normalizeReferences(draft),
        client_request_id:draft.request_id,
        authorized_credit_price:d.authorized_credit_price ?? d.retail_credit_price ?? draft.estimated_cost_cents,
        retail_pricing_id:d.retail_pricing_id,
        pricing_signature_hash:d.pricing_signature_hash,
      }),
    });
  },

  get(id:string) {
    return apiRequest<Generation>(`/api/generations/${id}`);
  },

  list(max=50) {
    return apiRequest<Generation[]>(`/api/generations?limit=${Math.min(100,max)}`);
  },

  cancel(id:string) {
    return apiRequest<Generation>(`/api/generations/${id}/cancel`, {method:'POST'});
  },
};

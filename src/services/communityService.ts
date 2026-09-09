import { apiRequest } from './apiClient.js';

export type CommunityMediaType='IMAGE'|'VIDEO';
export interface CommunityReference {asset_id:string;name:string;type:string;public_url:string;thumbnail_url:string;slot_type:'INITIAL'|'END'|'GENERAL'|string;alias?:string;}
export interface CommunityItem {
  generation_id:string;
  creator:{user_id:string;display_name:string;avatar_url?:string};
  media_type:CommunityMediaType;
  result_url:string;
  result_urls:string[];
  thumbnail_url?:string;
  model_id:string;
  mode:string;
  prompt:string;
  negative_prompt?:string;
  aspect_ratio:string;
  resolution?:string;
  duration_seconds?:number|null;
  number_of_outputs:number;
  seed?:number|null;
  motion_strength?:number|null;
  references:CommunityReference[];
  created_at:string;
  likes_count:number;
  downloads_count:number;
  liked_by_me:boolean;
}

export const communityService={
  async feed(type:'ALL'|'IMAGE'|'VIDEO'='ALL',limit=48){return apiRequest<{items:CommunityItem[]}>(`community/feed?type=${type}&limit=${limit}`)},
  async toggleLike(generationId:string){return apiRequest<{liked:boolean;likes_count:number}>(`community/${encodeURIComponent(generationId)}/like`,{method:'POST',body:'{}'})},
  async registerDownload(generationId:string){return apiRequest<{url:string;downloads_count:number;media_type:CommunityMediaType}>(`community/${encodeURIComponent(generationId)}/download`,{method:'POST',body:'{}'})},
  async prepareRecreate(generationId:string){return apiRequest<{generation_id:string;snapshot:{generation_id:string};target:'create-image'|'create-video'}>(`community/${encodeURIComponent(generationId)}/recreate`,{method:'POST',body:'{}'})},
};

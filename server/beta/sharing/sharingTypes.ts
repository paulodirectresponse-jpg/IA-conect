export type BetaShareResourceType='ASSET'|'FLOW'|'TEMPLATE'|'APP';
export type BetaShareStatus='ACTIVE'|'REVOKED';
export interface BetaShareRecord{
  share_id:string;
  user_id:string;
  resource_type:BetaShareResourceType;
  resource_id:string;
  title:string;
  status:BetaShareStatus;
  token_hash:string;
  snapshot:Record<string,any>;
  view_count:number;
  created_at:string;
  updated_at:string;
  revoked_at?:string|null;
}
export interface BetaSharePublicView{
  share_id:string;
  resource_type:BetaShareResourceType;
  title:string;
  snapshot:Record<string,any>;
  created_at:string;
}

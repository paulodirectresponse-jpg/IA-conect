import{apiRequest}from'../services/apiClient.js';
export type ShareResourceType='ASSET'|'FLOW'|'TEMPLATE'|'APP';
export const betaSharingClient={
 list:()=>apiRequest<any[]>('/api/beta/sharing'),
 create:(input:{resource_type:ShareResourceType;resource_id:string;title?:string})=>apiRequest<any>('/api/beta/sharing',{method:'POST',body:JSON.stringify(input)}),
 rotate:(shareId:string)=>apiRequest<any>(`/api/beta/sharing/${encodeURIComponent(shareId)}/rotate`,{method:'POST'}),
 revoke:(shareId:string)=>apiRequest<any>(`/api/beta/sharing/${encodeURIComponent(shareId)}`,{method:'DELETE'}),
 analytics:()=>apiRequest<any>('/api/beta/analytics'),
 resolvePublic:(token:string)=>apiRequest<any>(`/api/beta/shared/${encodeURIComponent(token)}`),
};

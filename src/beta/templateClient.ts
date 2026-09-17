import {apiRequest} from '../services/apiClient.js';
import {FlowGraph,FlowRecord} from './flowClient.js';
export type TemplateCategory='GENERIC'|'IMAGE'|'VIDEO'|'AUDIO'|'THREE_D'|'MULTIMODAL';
export interface TemplateView{template_id:string;owner_user_id:string;name:string;description:string;category:TemplateCategory;tags:string[];graph:FlowGraph;source_flow_id:string;source_flow_revision:number;visibility:'PRIVATE';use_count:number;created_at:string;updated_at:string;deleted_at:string|null;}
export const betaTemplateClient={
 list:()=>apiRequest<TemplateView[]>('/api/beta/templates'),
 create:(input:{flow_id:string;name?:string;description?:string;category?:TemplateCategory;tags?:string[]})=>apiRequest<TemplateView>('/api/beta/templates',{method:'POST',body:JSON.stringify(input)}),
 update:(templateId:string,input:Partial<Pick<TemplateView,'name'|'description'|'category'|'tags'>>)=>apiRequest<TemplateView>(`/api/beta/templates/${encodeURIComponent(templateId)}`,{method:'PATCH',body:JSON.stringify(input)}),
 instantiate:(templateId:string,input?:{name?:string;project_id?:string|null})=>apiRequest<FlowRecord>(`/api/beta/templates/${encodeURIComponent(templateId)}/instantiate`,{method:'POST',body:JSON.stringify(input||{})}),
 remove:(templateId:string)=>apiRequest<TemplateView>(`/api/beta/templates/${encodeURIComponent(templateId)}`,{method:'DELETE'}),
};

import {apiRequest} from '../services/apiClient.js';
import {BetaCapabilityMediaType} from './capabilityClient.js';
export interface WorkflowAppInputField{node_id:string;label:string;media_type:BetaCapabilityMediaType;exposed:boolean;required:boolean;placeholder:string;help_text:string;order:number;default_value:any;}
export interface WorkflowAppOutputField{node_id:string;label:string;media_type:BetaCapabilityMediaType;exposed:boolean;order:number;}
export interface WorkflowAppView{app_id:string;owner_user_id:string;name:string;description:string;source_type:'FLOW'|'TEMPLATE';source_id:string;flow_id:string;flow_revision:number;template_id:string|null;runtime_flow_id:string;runtime_flow_revision:number;status:'DRAFT'|'PUBLISHED';visibility:'PRIVATE';revision:number;input_schema:WorkflowAppInputField[];output_schema:WorkflowAppOutputField[];created_at:string;updated_at:string;published_at:string|null;deleted_at:string|null;}
export const workflowAppClient={
 list:()=>apiRequest<WorkflowAppView[]>('/api/beta/apps'),
 create:(input:{source_type:'FLOW'|'TEMPLATE';source_id:string;name?:string;description?:string})=>apiRequest<WorkflowAppView>('/api/beta/apps',{method:'POST',body:JSON.stringify(input)}),
 update:(appId:string,input:Partial<Pick<WorkflowAppView,'name'|'description'|'input_schema'|'output_schema'>>)=>apiRequest<WorkflowAppView>(`/api/beta/apps/${encodeURIComponent(appId)}`,{method:'PATCH',body:JSON.stringify(input)}),
 publish:(appId:string)=>apiRequest<WorkflowAppView>(`/api/beta/apps/${encodeURIComponent(appId)}/publish`,{method:'POST',body:'{}'}),
 refreshRevision:(appId:string)=>apiRequest<WorkflowAppView>(`/api/beta/apps/${encodeURIComponent(appId)}/refresh-revision`,{method:'POST',body:'{}'}),
 run:(appId:string,inputs:Record<string,any>)=>apiRequest<any>(`/api/beta/apps/${encodeURIComponent(appId)}/runs`,{method:'POST',headers:{'Idempotency-Key':`${appId}:${Date.now()}:${Math.random().toString(36).slice(2)}`},body:JSON.stringify({inputs})}),
 remove:(appId:string)=>apiRequest<WorkflowAppView>(`/api/beta/apps/${encodeURIComponent(appId)}`,{method:'DELETE'}),
};

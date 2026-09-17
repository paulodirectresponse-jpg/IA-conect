import{apiRequest}from'../services/apiClient.js';
export interface ContextPack{context_id:string;name:string;revision:number;project_id:string|null;asset_ids:string[];flow:{id:string;revision:number|null}|null;template:{id:string;revision:number|null}|null;app:{id:string;revision:number|null}|null;notes:string;created_at:string;updated_at:string;}
export interface ContextOptions{projects:Array<{project_id:string;name:string}>;flows:Array<{flow_id:string;name:string;revision:number}>;templates:Array<{template_id:string;name:string}>;apps:Array<{app_id:string;name:string;revision:number}>;assets:Array<{asset_id:string;type:string}>;}
export interface CopilotProposal{proposal_id:string;context_id:string|null;context_revision:number|null;message:string;intent:string;summary:string;steps:string[];mutations:Array<{kind:string;input:Record<string,any>}>;requires_confirmation:boolean;status:'PENDING'|'APPLIED'|'CANCELLED';result:any|null;created_at:string;updated_at:string;}
export const contextCopilotClient={
 options:()=>apiRequest<ContextOptions>('/api/beta/context/options'),
 listContexts:()=>apiRequest<ContextPack[]>('/api/beta/context'),
 createContext:(input:any)=>apiRequest<ContextPack>('/api/beta/context',{method:'POST',body:JSON.stringify(input)}),
 updateContext:(id:string,input:any)=>apiRequest<ContextPack>(`/api/beta/context/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(input)}),
 removeContext:(id:string)=>apiRequest<ContextPack>(`/api/beta/context/${encodeURIComponent(id)}`,{method:'DELETE'}),
 plan:(message:string,context_id:string|null)=>apiRequest<CopilotProposal>('/api/beta/copilot/plan',{method:'POST',body:JSON.stringify({message,context_id})}),
 apply:(id:string)=>apiRequest<CopilotProposal>(`/api/beta/copilot/proposals/${encodeURIComponent(id)}/apply`,{method:'POST',body:JSON.stringify({confirm:true})}),
 cancel:(id:string)=>apiRequest<CopilotProposal>(`/api/beta/copilot/proposals/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'}),
};

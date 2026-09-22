import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityMediaType } from './capabilityClient.js';

export type FlowNodeKind='INPUT'|'ASSET'|'TOOL'|'OUTPUT';
export interface FlowNodeUi{fit?:'cover'|'contain';width?:number;height?:number;media_aspect_ratio?:number}
export interface FlowNode{
 node_id:string;schema_version?:2;kind:FlowNodeKind;label:string;x:number;y:number;
 media_type?:BetaCapabilityMediaType|null;asset_id?:string|null;capability_id?:string|null;model_id?:string|null;
 prompt?:string;controls?:Record<string,string|number|boolean|null>;ui?:FlowNodeUi;
}
export interface FlowEdge{edge_id:string;from_node_id:string;to_node_id:string;media_type:BetaCapabilityMediaType;source_port?:string|null;target_port?:string|null;resolver_version?:number}
export interface FlowViewport{x:number;y:number;zoom:number}
export interface FlowGraph{nodes:FlowNode[];edges:FlowEdge[];viewport?:FlowViewport;metadata?:Record<string,unknown>}
export interface FlowRecord{
 flow_id:string;user_id:string;name:string;description:string;project_id:string|null;status:'DRAFT';
 graph:FlowGraph;revision:number;created_at:string;updated_at:string;deleted_at:string|null;
}
export const betaFlowClient={
 list:()=>apiRequest<FlowRecord[]>('/api/beta/flows'),
 get:(flowId:string)=>apiRequest<FlowRecord>(`/api/beta/flows/${encodeURIComponent(flowId)}`),
 create:(input:{name:string;description:string;project_id:string|null;graph:FlowGraph})=>apiRequest<FlowRecord>('/api/beta/flows',{method:'POST',body:JSON.stringify(input)}),
 save:(flowId:string,input:{name:string;description:string;project_id:string|null;graph:FlowGraph;expected_revision:number})=>apiRequest<FlowRecord>(`/api/beta/flows/${encodeURIComponent(flowId)}`,{method:'PUT',body:JSON.stringify(input)}),
 remove:(flowId:string)=>apiRequest<FlowRecord>(`/api/beta/flows/${encodeURIComponent(flowId)}`,{method:'DELETE'}),
};

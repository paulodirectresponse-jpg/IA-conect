import { CapabilityId, CapabilityMediaType } from '../capabilityRegistry.js';

export type BetaFlowNodeKind='INPUT'|'ASSET'|'TOOL'|'OUTPUT';
export interface BetaFlowNodeUi{fit?:'cover'|'contain';width?:number;height?:number;media_aspect_ratio?:number;}
export interface BetaFlowNode{
  node_id:string;
  schema_version?:2;
  kind:BetaFlowNodeKind;
  label:string;
  x:number;
  y:number;
  media_type?:CapabilityMediaType|null;
  asset_id?:string|null;
  capability_id?:CapabilityId|null;
  model_id?:string|null;
  prompt?:string;
  controls?:Record<string,string|number|boolean|null>;
  ui?:BetaFlowNodeUi;
}
export interface BetaFlowEdge{
  edge_id:string;
  from_node_id:string;
  to_node_id:string;
  media_type:CapabilityMediaType;
}
export interface BetaFlowViewport{x:number;y:number;zoom:number;}
export interface BetaFlowGraph{
  nodes:BetaFlowNode[];
  edges:BetaFlowEdge[];
  viewport?:BetaFlowViewport;
  metadata?:Record<string,unknown>;
}
export interface BetaFlowRecord{
  flow_id:string;
  user_id:string;
  name:string;
  description:string;
  project_id:string|null;
  status:'DRAFT';
  graph:BetaFlowGraph;
  system_kind?:'WORKFLOW_APP'|'BATCH'|null;
  source_app_id?:string|null;
  revision:number;
  created_at:string;
  updated_at:string;
  deleted_at:string|null;
}
export interface BetaFlowVersionRecord{
  version_id:string;
  flow_id:string;
  user_id:string;
  revision:number;
  graph:BetaFlowGraph;
  name:string;
  description:string;
  project_id:string|null;
  created_at:string;
}

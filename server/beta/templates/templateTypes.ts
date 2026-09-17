import { BetaFlowGraph } from '../flows/flowTypes.js';

export type BetaTemplateCategory='GENERIC'|'IMAGE'|'VIDEO'|'AUDIO'|'THREE_D'|'MULTIMODAL';
export interface BetaTemplateRecord{
  template_id:string;
  owner_user_id:string;
  name:string;
  description:string;
  category:BetaTemplateCategory;
  tags:string[];
  graph:BetaFlowGraph;
  source_flow_id:string;
  source_flow_revision:number;
  visibility:'PRIVATE';
  use_count:number;
  created_at:string;
  updated_at:string;
  deleted_at:string|null;
}

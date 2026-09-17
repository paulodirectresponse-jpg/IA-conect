import { CapabilityMediaType } from '../capabilityRegistry.js';

export type WorkflowAppStatus='DRAFT'|'PUBLISHED';
export type WorkflowAppSourceType='FLOW'|'TEMPLATE';
export interface WorkflowAppInputField{
  node_id:string;
  label:string;
  media_type:CapabilityMediaType;
  exposed:boolean;
  required:boolean;
  placeholder:string;
  help_text:string;
  order:number;
  default_value:any;
}
export interface WorkflowAppOutputField{
  node_id:string;
  label:string;
  media_type:CapabilityMediaType;
  exposed:boolean;
  order:number;
}
export interface WorkflowAppRecord{
  app_id:string;
  owner_user_id:string;
  name:string;
  description:string;
  source_type:WorkflowAppSourceType;
  source_id:string;
  flow_id:string;
  flow_revision:number;
  template_id:string|null;
  runtime_flow_id:string;
  runtime_flow_revision:number;
  status:WorkflowAppStatus;
  visibility:'PRIVATE';
  revision:number;
  input_schema:WorkflowAppInputField[];
  output_schema:WorkflowAppOutputField[];
  created_at:string;
  updated_at:string;
  published_at:string|null;
  deleted_at:string|null;
}

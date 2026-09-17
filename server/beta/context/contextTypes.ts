export type ContextEntityRef={id:string;revision:number|null};
export interface BetaContextPackRecord{
  context_id:string;owner_user_id:string;name:string;revision:number;project_id:string|null;asset_ids:string[];
  flow:ContextEntityRef|null;template:ContextEntityRef|null;app:ContextEntityRef|null;notes:string;
  created_at:string;updated_at:string;deleted_at:string|null;
}
export interface BetaContextResolved{
  context:BetaContextPackRecord;
  project:{project_id:string;name:string;description:string}|null;
  assets:Array<{asset_id:string;type:string;created_at:string}>;
  flow:{flow_id:string;name:string;description:string;revision:number}|null;
  template:{template_id:string;name:string;description:string;revision:number}|null;
  app:{app_id:string;name:string;description:string;revision:number;status:string}|null;
}

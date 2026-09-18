import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { createStableLaunchSnapshot, readyCapabilitiesForModel } from './stableLaunchReadinessService.js';

export interface LaunchSetRow{model_id:string;name:string;published:boolean;ready_capabilities:string[];isolated_capabilities:string[];}
export interface LaunchSetResult{cursor:number;next_cursor:number|null;done:boolean;total_models:number;processed:number;published_models:number;isolated_models:number;rows:LaunchSetRow[];}

export const stableLaunchSetService={
 async apply(cursor=0,limit=2):Promise<LaunchSetResult>{
  const data=await createStableLaunchSnapshot();
  const models=data.models.filter(model=>model.status!=='INACTIVE');
  const safeCursor=Math.max(0,Math.floor(Number(cursor)||0)),safeLimit=Math.min(3,Math.max(1,Math.floor(Number(limit)||2))),batch=models.slice(safeCursor,safeCursor+safeLimit);
  const rows:LaunchSetRow[]=[];
  for(const model of batch){
   const ready=readyCapabilitiesForModel(model,data),supported=(model.beta_capability_ids?.length?model.beta_capability_ids:[]);
   const allSupported=Array.from(new Set([...(model.beta_capability_ids||[]),...ready]));
   const isolated=allSupported.filter(cap=>!ready.includes(cap as any));
   if(ready.length){
    await catalogRepository.saveModel({...model,status:'ACTIVE',beta_only:false,beta_capability_ids:ready,updated_at:new Date().toISOString()});
    await betaCatalogPolicyService.saveModelPolicy(model.model_id,{capability_ids:ready,enabled:true,auto_routing_enabled:true},'system:launch-set');
    rows.push({model_id:model.model_id,name:model.name,published:true,ready_capabilities:ready,isolated_capabilities:isolated});
   }else{
    await catalogRepository.saveModel({...model,beta_only:true,beta_capability_ids:[],updated_at:new Date().toISOString()});
    await betaCatalogPolicyService.saveModelPolicy(model.model_id,{capability_ids:[],enabled:false,auto_routing_enabled:false},'system:launch-set');
    rows.push({model_id:model.model_id,name:model.name,published:false,ready_capabilities:[],isolated_capabilities:supported});
   }
  }
  const next=safeCursor+batch.length<models.length?safeCursor+batch.length:null;
  return{cursor:safeCursor,next_cursor:next,done:next===null,total_models:models.length,processed:rows.length,published_models:rows.filter(row=>row.published).length,isolated_models:rows.filter(row=>!row.published).length,rows};
 }
};
import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { getCapabilityDefinition, publicCapabilityCatalog } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';

export const betaCapabilityRouter=Router();

function intersection<T>(rows:T[][]):T[]{
  if(!rows.length)return[];
  return rows[0].filter(value=>rows.every(row=>row.includes(value)));
}

betaCapabilityRouter.get('/beta/capabilities',requireAuth,async(_req:AuthenticatedRequest,res)=>{
  try{
    const models=await catalogRepository.listModels();
    const base=publicCapabilityCatalog(models);
    const policies=await betaCatalogPolicyService.listCatalog();
    const policyByModel=new Map(policies.map(policy=>[policy.model_id,policy]));
    const governed=base.map(model=>{
      const policy=policyByModel.get(model.model_id);
      if(!policy?.eligible)return null;
      const allowed=new Set(policy.capability_ids);
      return{...model,capabilities:model.capabilities.filter(capability=>allowed.has(capability.id as any)),pricing_policy_id:policy.pricing_policy_id};
    }).filter(Boolean) as any[];

    const autoPolicies=policies.filter(policy=>policy.eligible&&policy.auto_routing_enabled);
    const autoPolicyIds=new Set(autoPolicies.map(policy=>policy.model_id));
    const autoCapabilities=Array.from(new Set(autoPolicies.flatMap(policy=>policy.capability_ids))).map(id=>{
      const def=getCapabilityDefinition(id);
      if(!def)return null;
      const supportingModels=governed.filter(model=>autoPolicyIds.has(model.model_id)&&model.capabilities.some((capability:any)=>capability.id===id));
      const supporting=supportingModels.flatMap(model=>model.capabilities.filter((capability:any)=>capability.id===id));
      if(!supporting.length)return null;
      const common=supporting[0].controls.filter((control:string)=>supporting.every((capability:any)=>capability.controls.includes(control)));
      return{id,inputs:def.inputs,outputs:def.outputs,controls:common};
    }).filter(Boolean);

    if(autoCapabilities.length){
      const autoModels=governed.filter(model=>autoPolicyIds.has(model.model_id));
      governed.unshift({
        model_id:'AUTO',name:'AUTO',category:'AUTO',capabilities:autoCapabilities,pricing_policy_id:null,
        supported_durations:intersection(autoModels.map(model=>model.supported_durations||[])),
        supported_resolutions:intersection(autoModels.map(model=>model.supported_resolutions||[])),
        supported_aspect_ratios:intersection(autoModels.map(model=>model.supported_aspect_ratios||[])),
      });
    }
    return res.json({success:true,data:{models:governed}});
  }catch{
    return res.status(503).json({success:false,error:{code:'CAPABILITY_CATALOG_UNAVAILABLE',message:'Catálogo de capabilities indisponível no momento.'}});
  }
});

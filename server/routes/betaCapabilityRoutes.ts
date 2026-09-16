import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { getCapabilityDefinition, publicCapabilityCatalog } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';

export const betaCapabilityRouter=Router();

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
    const autoCapabilities=Array.from(new Set(autoPolicies.flatMap(policy=>policy.capability_ids))).map(id=>{
      const def=getCapabilityDefinition(id);
      if(!def)return null;
      const supporting=governed.flatMap(model=>model.capabilities.filter((capability:any)=>capability.id===id));
      if(!supporting.length)return null;
      const common=supporting[0].controls.filter((control:string)=>supporting.every((capability:any)=>capability.controls.includes(control)));
      return{id,inputs:def.inputs,outputs:def.outputs,controls:common};
    }).filter(Boolean);

    if(autoCapabilities.length){
      governed.unshift({model_id:'AUTO',name:'AUTO',category:'AUTO',capabilities:autoCapabilities,pricing_policy_id:null});
    }
    return res.json({success:true,data:{models:governed}});
  }catch{
    return res.status(503).json({success:false,error:{code:'CAPABILITY_CATALOG_UNAVAILABLE',message:'Catálogo de capabilities indisponível no momento.'}});
  }
});

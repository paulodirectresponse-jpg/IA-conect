import { isCapabilityId, CapabilityId } from '../beta/capabilityRegistry.js';
import { ModelCategory } from '../../src/types/index.js';
import { routingV2Repository } from './repository.js';
import { RoutingV2Model } from './domain.js';

const now=()=>new Date().toISOString();
const slugify=(value:string)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export interface CreateRoutingV2ModelInput{
  model_id:string;
  name:string;
  vendor:string;
  category:ModelCategory;
  description?:string;
  capabilities:CapabilityId[];
  supported_controls?:Record<string,unknown>;
}

export const routingV2ModelService={
  async list(){
    return routingV2Repository.listModels();
  },

  async get(modelId:string){
    return routingV2Repository.getModel(modelId);
  },

  async create(input:CreateRoutingV2ModelInput){
    const modelId=String(input.model_id||'').trim();
    const name=String(input.name||'').trim();
    const vendor=String(input.vendor||'').trim();
    if(!modelId||!name||!vendor)throw new Error('model_id, nome e vendor são obrigatórios.');
    if(await routingV2Repository.getModel(modelId))throw new Error('Model V2 já existe.');
    const capabilities=Array.from(new Set((input.capabilities||[]).map(String))).filter(isCapabilityId) as CapabilityId[];
    if(!capabilities.length)throw new Error('Model V2 exige pelo menos uma capability válida.');
    const timestamp=now();
    const model:RoutingV2Model={
      model_id:modelId,
      name,
      slug:slugify(name)||modelId,
      vendor,
      category:input.category,
      description:String(input.description||'').trim(),
      capabilities,
      supported_controls:input.supported_controls||{},
      status:'ACTIVE',
      created_at:timestamp,
      updated_at:timestamp,
    };
    return routingV2Repository.saveModel(model);
  },

  async setCapabilities(modelId:string,capabilities:CapabilityId[]){
    const current=await routingV2Repository.getModel(modelId);
    if(!current)throw new Error('Model V2 não encontrado.');
    const valid=Array.from(new Set((capabilities||[]).map(String))).filter(isCapabilityId) as CapabilityId[];
    if(!valid.length)throw new Error('Model V2 exige pelo menos uma capability válida.');
    return routingV2Repository.saveModel({...current,capabilities:valid,updated_at:now()});
  },

  async disable(modelId:string){
    const current=await routingV2Repository.getModel(modelId);
    if(!current)throw new Error('Model V2 não encontrado.');
    return routingV2Repository.saveModel({...current,status:'DISABLED',updated_at:now()});
  },
};

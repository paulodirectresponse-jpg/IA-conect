import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Model, RoutingV2ProviderRoute, routingV2RouteId } from './domain.js';

const repositoryMocks=vi.hoisted(()=>({
  routes:[] as RoutingV2ProviderRoute[],
  models:[] as RoutingV2Model[],
  listRoutes:vi.fn(),
  listModels:vi.fn(),
  getRoute:vi.fn(),
  saveRoute:vi.fn(),
  saveModel:vi.fn(),
}));

vi.mock('./repository.js',()=>({routingV2Repository:{
  listRoutes:repositoryMocks.listRoutes,
  listModels:repositoryMocks.listModels,
  getRoute:repositoryMocks.getRoute,
  saveRoute:repositoryMocks.saveRoute,
  saveModel:repositoryMocks.saveModel,
}}));

const timestamp='2026-09-29T12:00:00.000Z';
const originalRoute=():RoutingV2ProviderRoute=>({
  route_id:routingV2RouteId('gpt-image-test','text-to-image','provider-wavespeed','openai/gpt-image-test/edit'),
  model_id:'gpt-image-test',capability_id:'text-to-image',provider_id:'provider-wavespeed',provider_model_identifier:'openai/gpt-image-test/edit',
  mapping_source:'PROVIDER_CATALOG_API',mapping_source_reference:'https://api.wavespeed.ai/models/openai/gpt-image-test/edit',mapping_verified_at:timestamp,
  status:'DEGRADED',pricing_status:'INVALID',runtime_status:'HEALTHY',billing_type:'PER_OUTPUT',billing_config:{type:'PER_OUTPUT',currency:'USD',price_per_output:0.04},
  pricing_snapshot:null,priority:100,created_at:timestamp,updated_at:timestamp,
});
const imageModel=():RoutingV2Model=>({
  model_id:'gpt-image-test',name:'GPT Image Test',slug:'gpt-image-test',vendor:'OpenAI',category:'IMAGE',description:'',capabilities:['text-to-image'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp,
});

describe('Routing V2 capability mapping repair',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    repositoryMocks.routes=[originalRoute()];
    repositoryMocks.models=[imageModel()];
    repositoryMocks.listRoutes.mockImplementation(async()=>repositoryMocks.routes);
    repositoryMocks.listModels.mockImplementation(async()=>repositoryMocks.models);
    repositoryMocks.getRoute.mockImplementation(async(id:string)=>repositoryMocks.routes.find(route=>route.route_id===id)||null);
    repositoryMocks.saveRoute.mockImplementation(async(route:RoutingV2ProviderRoute)=>{
      const index=repositoryMocks.routes.findIndex(row=>row.route_id===route.route_id);
      if(index<0)repositoryMocks.routes.push(route);else repositoryMocks.routes[index]=route;
      return route;
    });
    repositoryMocks.saveModel.mockImplementation(async(model:RoutingV2Model)=>{
      repositoryMocks.models=repositoryMocks.models.map(row=>row.model_id===model.model_id?model:row);
      return model;
    });
  });

  it('creates an auditable image-edit replacement and archives the wrong text-to-image binding',async()=>{
    const {routingV2CapabilityMappingRepairService}=await import('./capabilityMappingRepairService.js');
    const result=await routingV2CapabilityMappingRepairService.repair();
    const old=repositoryMocks.routes.find(route=>route.capability_id==='text-to-image')!;
    const replacement=repositoryMocks.routes.find(route=>route.capability_id==='image-edit')!;

    expect(result).toMatchObject({examined:1,repaired:1,blocked:0});
    expect(old).toMatchObject({status:'DISABLED',pricing_status:'INVALID'});
    expect(old.mapping_repair_note).toContain(replacement.route_id);
    expect(replacement).toMatchObject({status:'MAPPED',pricing_status:'UNKNOWN',pricing_snapshot:null});
    expect(replacement.mapping_repair_note).toContain(old.route_id);
    expect(repositoryMocks.models[0].capabilities).toContain('image-edit');

    expect(await routingV2CapabilityMappingRepairService.repair()).toMatchObject({examined:0,repaired:0,blocked:0});
  });

  it('keeps the mismatch visible when its correct replacement already exists but is disabled',async()=>{
    const original=repositoryMocks.routes[0];
    const disabledReplacement={...original,route_id:routingV2RouteId(original.model_id,'image-edit',original.provider_id,original.provider_model_identifier),capability_id:'image-edit' as const,status:'DISABLED' as const};
    repositoryMocks.routes.push(disabledReplacement);
    const {routingV2CapabilityMappingRepairService}=await import('./capabilityMappingRepairService.js');
    const result=await routingV2CapabilityMappingRepairService.repair();

    expect(result).toMatchObject({examined:1,repaired:0,blocked:1});
    expect(repositoryMocks.routes.find(route=>route.route_id===original.route_id)?.status).toBe('DEGRADED');
    expect(repositoryMocks.routes.find(route=>route.route_id===original.route_id)?.mapping_repair_note).toContain('DISABLED');
    expect(repositoryMocks.routes).toHaveLength(2);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Model, RoutingV2Provider, RoutingV2ProviderRoute, routingV2RouteId } from './domain.js';

const repositoryMocks=vi.hoisted(()=>(
  {
    routes:[] as RoutingV2ProviderRoute[],
    models:[] as RoutingV2Model[],
    providers:[] as RoutingV2Provider[],
    listRoutes:vi.fn(),listModels:vi.fn(),listProviders:vi.fn(),getRoute:vi.fn(),saveRoute:vi.fn(),
  }
));
const atlasMocks=vi.hoisted(()=>({listModels:vi.fn(),isConfigured:vi.fn(),createRoute:vi.fn()}));

vi.mock('./repository.js',()=>({routingV2Repository:{
  listRoutes:repositoryMocks.listRoutes,
  listModels:repositoryMocks.listModels,
  listProviders:repositoryMocks.listProviders,
  getRoute:repositoryMocks.getRoute,
  saveRoute:repositoryMocks.saveRoute,
}}));
vi.mock('./adapterResolver.js',()=>({resolveRoutingV2ProviderAdapter:()=>({listModels:atlasMocks.listModels,isConfigured:atlasMocks.isConfigured})}));
vi.mock('./routeService.js',()=>({routingV2RouteService:{create:atlasMocks.createRoute}}));

const timestamp='2026-09-29T12:00:00.000Z';
const oldIdentifier='google:gemini@omni-flash';
const replacementIdentifier='google:gemini@omni-flash-1.1';
const route=(capability:'text-to-video'|'image-to-video'):RoutingV2ProviderRoute=>({
  route_id:routingV2RouteId('gemini-omni-flash',capability,'provider-runware',oldIdentifier),
  model_id:'gemini-omni-flash',capability_id:capability,provider_id:'provider-runware',provider_model_identifier:oldIdentifier,
  mapping_source:'PROVIDER_CATALOG_API',mapping_source_reference:'https://content.runware.ai/models/google%3Agemini%40omni-flash/pricing',mapping_verified_at:timestamp,
  status:'DEGRADED',pricing_status:'INVALID',runtime_status:'HEALTHY',billing_type:'CUSTOM_FORMULA',
  billing_config:{type:'CUSTOM_FORMULA',currency:'USD',formula_id:'runware-catalog-pricing-v1',parameters:{provider_model_identifier:oldIdentifier,capability_id:capability,pricing_rates_json:'[]'}},
  pricing_snapshot:null,priority:95,last_sync_error:'Modelo não encontrado no catálogo público atual do Runware (HTTP 404).',last_sync_error_at:timestamp,created_at:timestamp,updated_at:timestamp,
});
const atlasOldRoute=():RoutingV2ProviderRoute=>({
  route_id:routingV2RouteId('gpt-image-2','text-to-image','provider-atlas','openai/gpt-image-2'),
  model_id:'gpt-image-2',capability_id:'text-to-image',provider_id:'provider-atlas',provider_model_identifier:'openai/gpt-image-2',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://www.atlascloud.ai/models/openai/gpt-image-2',mapping_verified_at:timestamp,
  status:'DEGRADED',pricing_status:'INVALID',runtime_status:'HEALTHY',billing_type:'PER_GENERATION',
  billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:0},pricing_snapshot:null,priority:100,
  last_sync_error:'Atlas não reconheceu o identifier genérico.',last_sync_error_at:timestamp,created_at:timestamp,updated_at:timestamp,
});

describe('Routing V2 Runware model identifier migration',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    repositoryMocks.routes=[route('image-to-video'),route('text-to-video')];
    repositoryMocks.models=[{model_id:'gemini-omni-flash',name:'Gemini Omni Flash',slug:'gemini-omni-flash',vendor:'Google',category:'VIDEO',description:'',capabilities:['image-to-video','text-to-video'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp}];
    repositoryMocks.providers=[{provider_id:'provider-runware',name:'Runware',slug:'runware',type:'AGGREGATOR',status:'ACTIVE',priority:95,adapter_id:'wrapper:provider-runware',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:true,health_status:'HEALTHY',created_at:timestamp,updated_at:timestamp}];
    atlasMocks.listModels.mockResolvedValue([]);
    atlasMocks.isConfigured.mockReturnValue(false);
    atlasMocks.createRoute.mockImplementation(async(input:any)=>{
      const created:RoutingV2ProviderRoute={
        ...input,route_id:routingV2RouteId(input.model_id,input.capability_id,input.provider_id,input.provider_model_identifier),
        status:'MAPPED',pricing_status:'UNKNOWN',runtime_status:'UNKNOWN',billing_type:input.billing_config.type,
        pricing_snapshot:null,priority:input.priority||100,created_at:timestamp,updated_at:timestamp,
      };
      repositoryMocks.routes.push(created);
      return created;
    });
    repositoryMocks.listRoutes.mockImplementation(async()=>repositoryMocks.routes);
    repositoryMocks.listModels.mockImplementation(async()=>repositoryMocks.models);
    repositoryMocks.listProviders.mockImplementation(async()=>repositoryMocks.providers);
    repositoryMocks.getRoute.mockImplementation(async(id:string)=>repositoryMocks.routes.find(row=>row.route_id===id)||null);
    repositoryMocks.saveRoute.mockImplementation(async(value:RoutingV2ProviderRoute)=>{
      const index=repositoryMocks.routes.findIndex(row=>row.route_id===value.route_id);
      if(index<0)repositoryMocks.routes.push(value);else repositoryMocks.routes[index]=value;
      return value;
    });
  });

  it('archives deprecated identifiers, creates documented replacements, and remains idempotent',async()=>{
    const {routingV2ProviderModelMigrationService}=await import('./providerModelMigrationService.js');
    const result=await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels();
    const oldRoutes=repositoryMocks.routes.filter(row=>row.provider_model_identifier===oldIdentifier);
    const replacements=repositoryMocks.routes.filter(row=>row.provider_model_identifier===replacementIdentifier);

    expect(result).toMatchObject({examined:2,migrated:2,blocked:0});
    expect(oldRoutes).toHaveLength(2);
    expect(oldRoutes.every(row=>row.status==='DISABLED'&&row.last_sync_error?.includes('HTTP 404'))).toBe(true);
    expect(replacements).toHaveLength(2);
    expect(replacements.every(row=>row.status==='MAPPED'&&row.pricing_status==='UNKNOWN'&&row.runtime_status==='UNKNOWN')).toBe(true);
    expect(replacements.every(row=>row.mapping_source==='PROVIDER_DOCS'&&row.mapping_source_reference==='https://runware.ai/docs/models/google-gemini-omni-flash-1-1')).toBe(true);
    expect(replacements.every(row=>row.provider_migration_note?.includes(oldIdentifier))).toBe(true);
    expect((await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels()).examined).toBe(0);
  });

  it('leaves the deprecated route active and reports the blocker when replacement is disabled',async()=>{
    const original=repositoryMocks.routes[0];
    repositoryMocks.routes.push({...original,route_id:routingV2RouteId(original.model_id,original.capability_id,original.provider_id,replacementIdentifier),provider_model_identifier:replacementIdentifier,status:'DISABLED'});
    const {routingV2ProviderModelMigrationService}=await import('./providerModelMigrationService.js');
    const result=await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels();

    expect(result).toMatchObject({examined:2,migrated:1,blocked:1});
    expect(repositoryMocks.routes.find(row=>row.route_id===original.route_id)?.status).toBe('DEGRADED');
    expect(repositoryMocks.routes.find(row=>row.route_id===original.route_id)?.last_sync_error).toContain('Migração bloqueada');
  });

  it('ignores other providers and identifiers',async()=>{
    repositoryMocks.routes=[{...route('text-to-video'),provider_id:'provider-atlas'}];
    const {routingV2ProviderModelMigrationService}=await import('./providerModelMigrationService.js');
    expect(await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels()).toMatchObject({examined:0,migrated:0,blocked:0});
  });

  it('validates and replaces the deprecated Atlas GPT Image 2 endpoint without marking it ready',async()=>{
    const old=atlasOldRoute();
    repositoryMocks.routes=[old];
    repositoryMocks.models=[{model_id:'gpt-image-2',name:'GPT Image 2',slug:'gpt-image-2',vendor:'OpenAI',category:'IMAGE',description:'',capabilities:['text-to-image','image-edit'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp}];
    repositoryMocks.providers=[{provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',type:'OFFICIAL',status:'ACTIVE',priority:100,adapter_id:'wrapper:provider-atlas',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,health_status:'HEALTHY',created_at:timestamp,updated_at:timestamp}];
    atlasMocks.isConfigured.mockReturnValue(true);
    atlasMocks.listModels.mockResolvedValue([{provider_model_identifier:'openai/gpt-image-2/text-to-image',name:'GPT Image 2'}]);

    const {routingV2ProviderModelMigrationService}=await import('./providerModelMigrationService.js');
    const result=await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels();
    const migratedOld=repositoryMocks.routes.find(row=>row.route_id===old.route_id);
    const replacement=repositoryMocks.routes.find(row=>row.provider_model_identifier==='openai/gpt-image-2/text-to-image');

    expect(result).toMatchObject({examined:1,migrated:1,blocked:0});
    expect(migratedOld).toMatchObject({status:'DISABLED',last_sync_error:expect.stringContaining('openai/gpt-image-2/text-to-image')});
    expect(replacement).toMatchObject({status:'MAPPED',pricing_status:'UNKNOWN',runtime_status:'UNKNOWN',mapping_source:'PROVIDER_DOCS'});
    expect(atlasMocks.createRoute).toHaveBeenCalledWith(expect.objectContaining({
      model_id:'gpt-image-2',capability_id:'text-to-image',provider_id:'provider-atlas',
      provider_model_identifier:'openai/gpt-image-2/text-to-image',
      mapping_source_reference:'https://www.atlascloud.ai/models/openai/gpt-image-2/text-to-image',
    }));
    expect((await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels()).examined).toBe(0);
    expect(atlasMocks.createRoute).toHaveBeenCalledTimes(1);
  });

  it('keeps the old Atlas endpoint intact and reports a blocker when the official catalog cannot verify the replacement',async()=>{
    const old={...atlasOldRoute(),status:'READY' as const,pricing_status:'CURRENT' as const};
    repositoryMocks.routes=[old];
    repositoryMocks.models=[{model_id:'gpt-image-2',name:'GPT Image 2',slug:'gpt-image-2',vendor:'OpenAI',category:'IMAGE',description:'',capabilities:['text-to-image'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp}];
    repositoryMocks.providers=[{provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',type:'OFFICIAL',status:'ACTIVE',priority:100,adapter_id:'wrapper:provider-atlas',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,health_status:'HEALTHY',created_at:timestamp,updated_at:timestamp}];
    atlasMocks.isConfigured.mockReturnValue(true);
    atlasMocks.listModels.mockResolvedValue([{provider_model_identifier:'openai/gpt-image-2',name:'GPT Image 2'}]);

    const {routingV2ProviderModelMigrationService}=await import('./providerModelMigrationService.js');
    const result=await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels();

    expect(result).toMatchObject({examined:1,migrated:0,blocked:1});
    expect(repositoryMocks.routes[0]).toMatchObject({status:'DEGRADED',pricing_status:'INVALID',last_sync_error:expect.stringContaining('não publicou o endpoint oficial')});
    expect(atlasMocks.createRoute).not.toHaveBeenCalled();
  });
});

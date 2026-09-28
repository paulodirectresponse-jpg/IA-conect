import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAimlCatalogModels, listDeepInfraCatalogModels, listFalCatalogModels, listReplicateCatalogModels, searchRunwareCatalogModels } from './providerCatalogService.js';

function mockJson(body:any,status=200){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})));
  return vi.mocked(fetch);
}

describe('live read-only provider model catalogs',()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

  it('queries the fal.ai model search with its documented Key authorization header',async()=>{
    vi.stubEnv('FAL_API_KEY','fal-test-key');
    const fetchMock=mockJson({models:[{endpoint_id:'fal-ai/seedance/text-to-video',metadata:{display_name:'Seedance',category:'text-to-video',tags:['video']}}]});
    const rows=await listFalCatalogModels('Seedance');
    expect(rows[0]).toMatchObject({provider_model_identifier:'fal-ai/seedance/text-to-video',name:'Seedance',capabilities:['text-to-video']});
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=Seedance'),expect.objectContaining({headers:{Authorization:'Key fal-test-key'}}));
  });

  it('reads DeepInfra public model metadata and filters the requested model locally',async()=>{
    const fetchMock=mockJson([
      {model_name:'ByteDance/Seedance-2.5',display_name:'Seedance 2.5',type:'text-to-video'},
      {model_name:'meta-llama/Llama-4',display_name:'Llama 4',type:'text-generation'},
    ]);
    const rows=await listDeepInfraCatalogModels('Seedance');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({provider_model_identifier:'ByteDance/Seedance-2.5',capabilities:['text-to-video']});
    expect(fetchMock).toHaveBeenCalledWith('https://api.deepinfra.com/models/list',expect.any(Object));
  });

  it('uses Replicate search for a query and preserves its model metadata',async()=>{
    vi.stubEnv('REPLICATE_API_TOKEN','replicate-test-token');
    const fetchMock=mockJson({models:[{model:{owner:'bytedance',name:'seedance-2.5',description:'Video generation',url:'https://replicate.com/bytedance/seedance-2.5'},metadata:{tags:['video'],score:0.98}}]});
    const rows=await listReplicateCatalogModels('Seedance');
    expect(rows[0]).toMatchObject({provider_model_identifier:'bytedance/seedance-2.5',name:'seedance-2.5',vendor:'bytedance',metadata:{search_score:0.98}});
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/v1/search?query=Seedance'),expect.objectContaining({headers:{Authorization:'Bearer replicate-test-token'}}));
  });

  it('reads the public AI/ML API catalogue and exposes its endpoint type and declared capabilities',async()=>{
    const fetchMock=mockJson({object:'list',data:[{id:'bytedance/seedance-2.5',aliases:['seedance-2.5'],type:'internal/video-generations/submit',info:{name:'Seedance 2.5',developer:'ByteDance'},tags:['playground:video'],capabilities:['image_to_video','text_to_video'],modalities:{input:['text','image'],output:['video']}}]});
    const rows=await listAimlCatalogModels('Seedance');
    expect(rows[0]).toMatchObject({provider_model_identifier:'bytedance/seedance-2.5',vendor:'ByteDance',capabilities:['text-to-video','image-to-video']});
    expect(fetchMock).toHaveBeenCalledWith('https://api.aimlapi.com/v1/models?include=modalities,capabilities',expect.any(Object));
  });

  it('paginates Runware model search and preserves total results and verified metadata',async()=>{
    vi.stubEnv('RUNWARE_API_KEY','runware-test-key');
    const fetchMock=mockJson({data:[{taskUUID:'not-the-generated-id',totalResults:245,results:[{air:'bytedance:seedance-2-0@1',name:'Seedance 2.0',provider:'ByteDance',category:'video',capabilities:['image-to-video'],source:'featured',tags:['video']}]}]});
    const page=await searchRunwareCatalogModels('Seedance',{offset:100,limit:50});
    const requestBody=JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody[0]).toMatchObject({taskType:'modelSearch',search:'Seedance',visibility:'public',offset:100,limit:50});
    expect(page).toMatchObject({total_results:245,offset:100,limit:50});
    expect(page.rows[0]).toMatchObject({provider_model_identifier:'bytedance:seedance-2-0@1',capabilities:['image-to-video'],metadata:{source:'featured',tags:['video']}});
    expect(fetchMock).toHaveBeenCalledWith('https://api.runware.ai/v1',expect.objectContaining({headers:{Authorization:'Bearer runware-test-key','Content-Type':'application/json'}}));
  });
});

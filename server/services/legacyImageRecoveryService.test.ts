import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('../repositories/assetRepository.js',()=>({
  generatedAssetId:vi.fn((generationId:string,index:number)=>`ast_${generationId}_${index}`),
  assetRepository:{getAsset:vi.fn(),createAsset:vi.fn(),updateAsset:vi.fn()},
}));
vi.mock('../repositories/generationRepository.js',()=>({
  generationRepository:{listUserGenerationsPage:vi.fn(),saveGeneration:vi.fn()},
}));
vi.mock('./generatedAssetStorageService.js',()=>({
  generatedAssetStorageService:{archive:vi.fn()},
}));

import {assetRepository} from '../repositories/assetRepository.js';
import {generationRepository} from '../repositories/generationRepository.js';
import {generatedAssetStorageService} from './generatedAssetStorageService.js';
import {legacyImageRecoveryService} from './legacyImageRecoveryService.js';

function makeGeneration(){return{
  generation_id:'gen-1',user_id:'user-1',status:'SUCCEEDED' as const,model_id:'model-1',provider_id:'wavespeed',
  mode:'TEXT_TO_IMAGE' as const,original_prompt:'a test image',currency:'CREDITS' as const,created_at:new Date().toISOString(),
  number_of_outputs:1,result_url:'https://provider.example/result?temporary-token=secret',
};}

afterEach(()=>vi.resetAllMocks());

describe('legacy image recovery diagnostics',()=>{
  it('returns exact stable source error codes and HTTP status without exposing expiring URLs',async()=>{
    vi.mocked(generationRepository.listUserGenerationsPage).mockResolvedValue([makeGeneration()]);
    vi.mocked(assetRepository.getAsset).mockResolvedValue(null);
    vi.mocked(generatedAssetStorageService.archive).mockRejectedValue(Object.assign(new Error('private upstream body'),{
      code:'ASSET_ARCHIVE_FETCH_FAILED',status:404,
    }));
    vi.mocked(generationRepository.saveGeneration).mockResolvedValue(undefined as never);

    const result=await legacyImageRecoveryService.runBatch({userId:'user-1',limit:1});

    expect(result).toMatchObject({unavailable:1,failed:0,details:[{
      generation_id:'gen-1',outcome:'UNAVAILABLE',errors:[{code:'ASSET_ARCHIVE_FETCH_FAILED',http_status:404}],
    }]});
    expect(JSON.stringify(result)).not.toContain('temporary-token');
    expect(JSON.stringify(result)).not.toContain('private upstream body');
    expect(generationRepository.saveGeneration).toHaveBeenCalledWith(expect.objectContaining({
      media_recovery_status:'UNAVAILABLE',
      media_recovery_error_codes:['ASSET_ARCHIVE_FETCH_FAILED_HTTP_404'],
    }));
  });

  it('archives successful results to the R2 app URL without saving the temporary source URL',async()=>{
    vi.mocked(generationRepository.listUserGenerationsPage).mockResolvedValue([makeGeneration()]);
    vi.mocked(assetRepository.getAsset).mockResolvedValue(null);
    vi.mocked(generatedAssetStorageService.archive).mockResolvedValue({
      storage_path:'users/user-1/assets/ast_gen-1_0/generated.png',
      public_url:'https://iaconnect.ia.br/api/assets/media/users/user-1/assets/ast_gen-1_0/generated.png',
      mime_type:'image/png',size_bytes:12,
    });
    vi.mocked(assetRepository.createAsset).mockImplementation(async(params:any)=>({
      ...params,alias:params.alias||'recovered',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    } as any));
    vi.mocked(generationRepository.saveGeneration).mockResolvedValue(undefined as never);

    const result=await legacyImageRecoveryService.runBatch({userId:'user-1',limit:1});
    expect(result).toMatchObject({recovered:1,unavailable:0,details:[{outcome:'RECOVERED',errors:[]}]});
    const createParams=vi.mocked(assetRepository.createAsset).mock.calls[0][0] as any;

    expect(createParams.public_url).toContain('/api/assets/media/');
    expect(createParams.media_metadata).not.toHaveProperty('recovery_source_url');
    expect(JSON.stringify(createParams)).not.toContain('temporary-token');
    expect(generationRepository.saveGeneration).toHaveBeenCalledWith(expect.objectContaining({
      media_recovery_status:'RECOVERED',
      result_url:createParams.public_url,
    }));
  });

  it('does not reuse another output URL when one recovery source is unavailable',async()=>{
    const firstUrl='https://provider.example/result-1?temporary-token=first';
    const secondUrl='https://provider.example/result-2?temporary-token=second';
    vi.mocked(generationRepository.listUserGenerationsPage).mockResolvedValue([{
      ...makeGeneration(),number_of_outputs:2,result_url:firstUrl,result_urls:[firstUrl,secondUrl],provider_result_urls:[firstUrl,secondUrl],
    }]);
    vi.mocked(assetRepository.getAsset).mockResolvedValue(null);
    vi.mocked(assetRepository.createAsset).mockImplementation(async(params:any)=>(
      {...params,alias:params.alias||'recovered',created_at:new Date().toISOString(),updated_at:new Date().toISOString()} as any
    ));
    vi.mocked(generatedAssetStorageService.archive).mockImplementation(async(params:any)=>{
      if(params.sourceUrl===secondUrl)throw Object.assign(new Error('expired source'),{code:'ASSET_ARCHIVE_FETCH_FAILED',status:404});
      return{
        storage_path:'users/user-1/assets/ast_gen-1_0/generated.jpg',
        public_url:'https://iaconnect.ia.br/api/assets/media/users/user-1/assets/ast_gen-1_0/generated.jpg',
        mime_type:'image/jpeg',size_bytes:12,
      };
    });
    vi.mocked(generationRepository.saveGeneration).mockResolvedValue(undefined as never);

    const result=await legacyImageRecoveryService.runBatch({userId:'user-1',limit:1});

    expect(vi.mocked(generatedAssetStorageService.archive).mock.calls.map(([params])=>params.sourceUrl)).toEqual([firstUrl,secondUrl]);
    expect(result).toMatchObject({recovered:1,unavailable:1,details:[{outcome:'PARTIAL'}]});
    expect(generationRepository.saveGeneration).toHaveBeenCalledWith(expect.objectContaining({
      media_recovery_status:'PARTIAL',
      result_asset_ids:['ast_gen-1_0'],
      result_urls:['https://iaconnect.ia.br/api/assets/media/users/user-1/assets/ast_gen-1_0/generated.jpg'],
    }));
  });
});

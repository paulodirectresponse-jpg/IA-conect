import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  provider:{isConfigured:vi.fn(),checkStatus:vi.fn()},
  archive:vi.fn(),
  getAsset:vi.fn(),
  createAsset:vi.fn(),
  saveGeneration:vi.fn(),
  captureCredits:vi.fn(),
  firestoreGet:vi.fn(),
  firestoreSet:vi.fn(),
}));

vi.mock('../repositories/generationRepository.js',()=>({
  generationRepository:{
    saveGeneration:mocks.saveGeneration,
    getGeneration:vi.fn(),getGenerations:vi.fn(),listUserGenerations:vi.fn(),
  },
}));
vi.mock('../repositories/assetRepository.js',()=>({
  generatedAssetId:vi.fn((generationId:string,index:number)=>`asset_${generationId}_${index}`),
  assetRepository:{getAsset:mocks.getAsset,createAsset:mocks.createAsset,updateAsset:vi.fn()},
}));
vi.mock('../repositories/firestoreAdminRest.js',()=>({
  firestoreAdminRest:{get:mocks.firestoreGet,set:mocks.firestoreSet},
}));
vi.mock('../adapters/providerRegistry.js',()=>({
  providerRegistry:{getAdapter:vi.fn(()=>mocks.provider)},
}));
vi.mock('./smartRouterService.js',()=>({smartRouterService:{selectProvider:vi.fn()}}));
vi.mock('./creditWalletService.js',()=>({
  creditWalletService:{captureForGeneration:mocks.captureCredits,releaseForGeneration:vi.fn()},
}));
vi.mock('./creditPricingService.js',()=>({creditPricingService:{preview:vi.fn()}}));
vi.mock('./assetReferenceResolver.js',()=>({assetReferenceResolver:{resolveReferenceAssetUrls:vi.fn()}}));
vi.mock('./generatedAssetStorageService.js',()=>({generatedAssetStorageService:{archive:mocks.archive}}));
vi.mock('./r2AssetStorageService.js',()=>({r2AssetStorageService:{exists:vi.fn()}}));
vi.mock('../routing-v2/catalogService.js',()=>({routingV2CatalogService:{}}));
vi.mock('../routing-v2/executionService.js',()=>({routingV2ExecutionService:{refresh:vi.fn(),start:vi.fn(),cancel:vi.fn()}}));
vi.mock('../routing-v2/modelCompatibilityService.js',()=>({validateModelCompatibility:vi.fn()}));
vi.mock('../routing-v2/generationContract.js',()=>({capabilityUsesDuration:vi.fn(()=>false),resolveGenerationCapability:vi.fn(()=>null)}));
vi.mock('../beta/audio/audioVoiceService.js',()=>({audioVoiceService:{captureClone:vi.fn(),providerCloneId:vi.fn()}}));

import {Generation} from '../../src/types/index.js';
import {generationService} from './generationService.js';

const temporaryUrl='https://provider.example/generated.png?temporary-token=private';
const durableUrl='https://iaconnect.ia.br/api/assets/media/users/user-1/assets/asset_gen-1_0/generated.png';

function makeGeneration():Generation&Record<string,any>{
  return{
    generation_id:'gen-1',user_id:'user-1',status:'SUBMITTED',model_id:'seedance-test',provider_id:'wavespeed',
    mode:'TEXT_TO_IMAGE',output_asset_type:'IMAGE',original_prompt:'test image',currency:'CREDITS',
    created_at:new Date().toISOString(),provider_job_id:'provider-job-1',retail_credit_price:4,
    current_provider_safe_cogs_cents:12,current_provider_billing_policy:'CHARGE_ON_SUCCESS',
  };
}

beforeEach(()=>{
  vi.clearAllMocks();
  mocks.provider.isConfigured.mockReturnValue(true);
  mocks.provider.checkStatus.mockResolvedValue({status:'SUCCEEDED',result_urls:[temporaryUrl]});
  mocks.saveGeneration.mockImplementation(async(g:any)=>g);
  mocks.getAsset.mockResolvedValue(null);
  mocks.createAsset.mockImplementation(async(params:any)=>({
    ...params,asset_id:params.asset_id,owner_user_id:params.owner_user_id,type:'IMAGE',category:'GENERIC',
    mime_type:'image/png',size_bytes:2048,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
  }));
  mocks.archive.mockRejectedValue(Object.assign(new Error('private storage detail'),{code:'ASSET_STORAGE_UNAVAILABLE'}));
  mocks.captureCredits.mockResolvedValue(undefined);
  mocks.firestoreGet.mockResolvedValue({exists:false,data:null});
  mocks.firestoreSet.mockResolvedValue(undefined);
});

afterEach(()=>vi.resetAllMocks());

describe('legacy generation durable storage retry',()=>{
  it('keeps provider output pending and credits reserved when the first archive attempt fails',async()=>{
    const result=await generationService.refreshGenerationState(makeGeneration());

    expect(result).toMatchObject({
      status:'PROCESSING',media_storage_status:'PENDING',media_storage_error_code:'ASSET_STORAGE_UNAVAILABLE',
      provider_result_urls:[temporaryUrl],result_url:null,result_urls:[],
    });
    expect(result.thumbnail_url).toBeNull();
    expect(mocks.captureCredits).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private storage detail');
  });

  it('retries the saved provider output without polling again and only captures credits after R2 archive succeeds',async()=>{
    const pending=await generationService.refreshGenerationState(makeGeneration()) as Generation&Record<string,any>;
    pending.media_storage_last_attempt_at=new Date(Date.now()-60_000).toISOString();
    mocks.archive.mockResolvedValue({
      storage_path:'users/user-1/assets/asset_gen-1_0/generated.png',public_url:durableUrl,mime_type:'image/png',size_bytes:2048,
    });

    const result=await generationService.refreshGenerationState(pending);

    expect(mocks.provider.checkStatus).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status:'SUCCEEDED',media_storage_status:'READY',media_storage_error_code:null,
      result_url:durableUrl,result_urls:[durableUrl],thumbnail_url:durableUrl,
      result_asset_id:'asset_gen-1_0',provider_result_urls:[],
    });
    expect(mocks.captureCredits).toHaveBeenCalledTimes(1);
    expect(mocks.captureCredits).toHaveBeenCalledWith('user-1','gen-1');
  });
});

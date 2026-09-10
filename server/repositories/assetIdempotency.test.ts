import {afterEach,describe,expect,it,vi} from 'vitest';
import {assetRepository,generatedAssetId,generatedAssetIdentity,generatedAssetOutputIndex} from './assetRepository.js';
import {firestoreAdminRest} from './firestoreAdminRest.js';
import {Asset} from '../../src/types/index.js';

const baseAsset=(overrides:Partial<Asset>={}):Asset=>({
  asset_id:'ast_old_1',
  owner_user_id:'user_1',
  type:'IMAGE',
  category:'GENERIC',
  name:'Imagem gerada',
  alias:'generated_image_demo',
  storage_path:'provider://provider-wavespeed/job_1/1',
  public_url:'https://example.test/image-a.png',
  mime_type:'image/png',
  size_bytes:0,
  status:'READY',
  origin:'GENERATED',
  source_generation_id:'gen_demo',
  created_at:'2026-09-10T18:00:00.000Z',
  updated_at:'2026-09-10T18:00:00.000Z',
  ...overrides,
});

afterEach(()=>vi.restoreAllMocks());

describe('generated asset idempotency',()=>{
  it('creates a stable id from generation and output index only',()=>{
    const first=generatedAssetId('gen_demo',0);
    expect(first).toBe(generatedAssetId('gen_demo',0));
    expect(first).not.toBe(generatedAssetId('gen_demo',1));
    expect(first).not.toContain('https');
  });

  it('normalizes historical provider paths into the same logical identity',()=>{
    const old=baseAsset();
    const canonical=baseAsset({
      asset_id:generatedAssetId('gen_demo',0),
      source_output_index:0,
      public_url:'https://example.test/signed-image-with-a-different-token.png',
    });
    expect(generatedAssetOutputIndex(old)).toBe(0);
    expect(generatedAssetIdentity(old)).toBe('gen_demo:0');
    expect(generatedAssetIdentity(canonical)).toBe('gen_demo:0');
  });

  it('concurrent registration of the same output writes one document identity',async()=>{
    vi.spyOn(firestoreAdminRest,'get').mockResolvedValue({exists:false,data:null,updateTime:null} as any);
    vi.spyOn(firestoreAdminRest,'runQuery').mockResolvedValue([] as any);
    const paths:string[]=[];
    vi.spyOn(firestoreAdminRest,'set').mockImplementation(async(path:string,data:any)=>{
      paths.push(path);
      await new Promise((resolve)=>setTimeout(resolve,1));
      return{data,updateTime:'now'} as any;
    });

    const assetId=generatedAssetId('gen_race',0);
    const input={
      asset_id:assetId,
      owner_user_id:'user_1',
      type:'IMAGE' as const,
      category:'GENERIC' as const,
      name:'Imagem gerada',
      alias:'generated_image_race',
      storage_path:'provider://provider-wavespeed/job_race/1',
      public_url:'https://example.test/result.png',
      mime_type:'image/png',
      size_bytes:0,
      status:'READY' as const,
      origin:'GENERATED' as const,
      source_generation_id:'gen_race',
      source_output_index:0,
      source_model_id:'seedream-5-pro-image',
      source_provider_id:'provider-wavespeed',
    };

    const [a,b]=await Promise.all([
      assetRepository.createAsset(input),
      assetRepository.createAsset(input),
    ]);

    expect(a.asset_id).toBe(assetId);
    expect(b.asset_id).toBe(assetId);
    expect(new Set(paths)).toEqual(new Set([`assets/${assetId}`]));
  });

  it('self-heals historical duplicates and keeps one canonical asset',async()=>{
    const older=baseAsset();
    const duplicate=baseAsset({
      asset_id:'ast_old_2',
      alias:'generated_image_demo_1',
      public_url:'https://example.test/image-b-signed.png',
      created_at:'2026-09-10T18:00:01.000Z',
    });
    vi.spyOn(firestoreAdminRest,'runQuery').mockResolvedValue([
      {name:'assets/ast_old_1',data:older,updateTime:'t1'},
      {name:'assets/ast_old_2',data:duplicate,updateTime:'t2'},
    ] as any);
    const writes:Array<{path:string;data:any}>=[];
    vi.spyOn(firestoreAdminRest,'set').mockImplementation(async(path:string,data:any)=>{
      writes.push({path,data});
      return{data,updateTime:'now'} as any;
    });

    const rows=await assetRepository.listUserAssets('user_1');

    expect(rows.map((asset)=>asset.asset_id)).toEqual(['ast_old_1']);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('assets/ast_old_2');
    expect(writes[0].data.duplicate_of_asset_id).toBe('ast_old_1');
    expect(writes[0].data.deleted_at).toBeTruthy();
  });
});

describe('generated asset architecture guardrails',()=>{
  it('generation service always registers a deterministic output identity',async()=>{
    const fs=await import('node:fs');
    const source=fs.readFileSync('server/services/generationService.ts','utf8');
    expect(source).toContain('asset_id:generatedAssetId(generation.generation_id,i)');
    expect(source).toContain('source_output_index:i');
  });

  it('gallery deduplicates generated media by logical output identity instead of URL',async()=>{
    const fs=await import('node:fs');
    const source=fs.readFileSync('src/components/workspace/CreationGallery.tsx','utf8');
    expect(source).toContain('assetIdentity(asset)');
    expect(source).toContain('source_output_index:index');
    expect(source).not.toContain("identity=asset.public_url||asset.asset_id");
  });
});

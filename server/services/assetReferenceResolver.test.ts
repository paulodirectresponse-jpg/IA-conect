import {afterEach,describe,expect,it,vi} from 'vitest';
import {configureR2AssetBucket,R2AssetBucketPort} from './r2AssetStorageService.js';

vi.mock('../repositories/assetRepository.js',()=>({
  assetRepository:{findLegacyStorageProbeAsset:vi.fn()},
}));

import {assetRepository} from '../repositories/assetRepository.js';
import {assetReferenceResolver} from './assetReferenceResolver.js';

function fakeBucket(initial:Record<string,Uint8Array>={}) :R2AssetBucketPort{
  const files=new Map(Object.entries(initial));
  const metadata=(key:string)=>({
    writeHttpMetadata(headers:Headers){headers.set('content-type','image/png');headers.set('cache-control','public, max-age=31536000, immutable');},
    httpEtag:`etag-${key}`,
  });
  return{
    async put(key,value){
      if(value instanceof ReadableStream){
        const chunks:Uint8Array[]=[];
        const reader=value.getReader();
        while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);}
        const size=chunks.reduce((sum,chunk)=>sum+chunk.byteLength,0);
        const bytes=new Uint8Array(size);let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
        files.set(key,bytes);
      }else if(value instanceof ArrayBuffer)files.set(key,new Uint8Array(value));
      else files.set(key,value);
    },
    async head(key){const bytes=files.get(key);return bytes?{...metadata(key),size:bytes.byteLength}:null;},
    async get(key){const bytes=files.get(key);return bytes?{...metadata(key),size:bytes.byteLength,body:new Response(bytes).body!}:null;},
    async delete(key){files.delete(key);},
  };
}

const previous={
  SUPABASE_URL:process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,
  SUPABASE_BUCKET:process.env.SUPABASE_BUCKET,
};

afterEach(()=>{
  vi.restoreAllMocks();
  configureR2AssetBucket(null);
  assetReferenceResolver.resetStorageDiagnosticCache();
  if(previous.SUPABASE_URL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previous.SUPABASE_URL;
  if(previous.SUPABASE_SECRET_KEY===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previous.SUPABASE_SECRET_KEY;
  if(previous.SUPABASE_BUCKET===undefined)delete process.env.SUPABASE_BUCKET;else process.env.SUPABASE_BUCKET=previous.SUPABASE_BUCKET;
});

describe('storage diagnostics',()=>{
  it('confirms R2 read and write separately from inaccessible legacy Supabase files',async()=>{
    process.env.SUPABASE_URL='https://storage.example.supabase.co';
    process.env.SUPABASE_BUCKET='assets';
    configureR2AssetBucket(fakeBucket());
    vi.mocked(assetRepository.findLegacyStorageProbeAsset).mockResolvedValue({
      asset_id:'ast_probe',owner_user_id:'user-1',type:'IMAGE',category:'GENERIC',name:'probe',alias:'probe',
      storage_path:'users/user-1/assets/ast_probe/original.png',public_url:'https://storage.example.supabase.co/storage/v1/object/public/assets/users/user-1/assets/ast_probe/original.png',
      mime_type:'image/png',size_bytes:1,status:'READY',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      media_metadata:{archived:true},
    });
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:402}));

    const result=await assetReferenceResolver.runStorageDiagnostic();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://storage.example.supabase.co/storage/v1/object/public/assets/users/user-1/assets/ast_probe/original.png');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method:'HEAD'});
    expect(result.is_configured).toBe(true);
    expect(result.write_test).toBe('PASS');
    expect(result.read_test).toBe('PASS');
    expect(result.details?.bucket_accessible).toBe(true);
    expect(result.details?.legacy_storage_available).toBe(false);
    expect(result.details?.legacy_storage_error).toBe('LEGACY_SUPABASE_READ_HTTP_402');
    expect(result.message).toContain('Storage Supabase legado continua inacessível');
  });

  it('returns R2 delivery URLs only for objects confirmed in the bucket',async()=>{
    const storagePath='users/user-1/assets/ast-1/original.png';
    configureR2AssetBucket(fakeBucket({[storagePath]:new Uint8Array([1])}));
    const asset={
      asset_id:'ast-1',owner_user_id:'user-1',type:'IMAGE' as const,category:'GENERIC' as const,name:'test',alias:'test',
      storage_path:storagePath,public_url:'https://old.supabase.co/storage/v1/object/public/assets/old.png',
      mime_type:'image/png',size_bytes:1,status:'READY' as const,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    };
    await expect(assetReferenceResolver.getProviderAccessibleUrl(asset)).resolves.toBe('https://iaconnect.ia.br/api/assets/media/users/user-1/assets/ast-1/original.png');
  });
});

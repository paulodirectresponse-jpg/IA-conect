import {afterEach,describe,expect,it,vi} from 'vitest';
import {configureR2AssetBucket,R2AssetBucketPort} from './r2AssetStorageService.js';
import {generatedAssetStorageService} from './generatedAssetStorageService.js';

function fakeBucket(options:{confirmWrites?:boolean}={}) :R2AssetBucketPort{
  const files=new Map<string,Uint8Array>();
  const headers=new Map<string,{contentType?:string;cacheControl?:string}>();
  const metadata=(key:string)=>({
    writeHttpMetadata(target:Headers){
      const value=headers.get(key);
      if(value?.contentType)target.set('content-type',value.contentType);
      if(value?.cacheControl)target.set('cache-control',value.cacheControl);
    },
    httpEtag:`etag-${key}`,
  });
  return{
    async put(key,value,options){
      headers.set(key,options?.httpMetadata||{});
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
    async head(key){
      if(options.confirmWrites===false)return null;
      const bytes=files.get(key);
      return bytes?{...metadata(key),size:bytes.byteLength}:null;
    },
    async get(key){const bytes=files.get(key);return bytes?{...metadata(key),size:bytes.byteLength,body:new Response(bytes).body!}:null;},
    async delete(key){files.delete(key);},
  };
}

afterEach(()=>{
  vi.restoreAllMocks();
  configureR2AssetBucket(null);
});

describe('generated asset archival in Cloudflare R2',()=>{
  it('streams provider output to a confirmed user-owned object and returns the app media URL',async()=>{
    configureR2AssetBucket(fakeBucket());
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1,2,3]),{
      status:200,
      headers:{'content-type':'image/png','content-length':'3'},
    }));

    const archived=await generatedAssetStorageService.archive({
      userId:'user-1',assetId:'ast-1',sourceUrl:'https://provider.example/output',fallbackMime:'image/jpeg',fallbackExtension:'jpg',
    });

    expect(archived).toMatchObject({
      storage_path:'users/user-1/assets/ast-1/generated.png',
      public_url:'https://iaconnect.ia.br/api/assets/media/users/user-1/assets/ast-1/generated.png',
      mime_type:'image/png',
      size_bytes:3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://provider.example/output');
    expect(JSON.stringify(archived)).not.toContain('provider.example');
  });

  it('refuses to publish an object when R2 cannot confirm the written bytes',async()=>{
    configureR2AssetBucket(fakeBucket({confirmWrites:false}));
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1]),{
      status:200,headers:{'content-type':'image/png'},
    }));
    await expect(generatedAssetStorageService.archive({
      userId:'user-1',assetId:'ast-1',sourceUrl:'https://provider.example/output',fallbackMime:'image/jpeg',fallbackExtension:'jpg',
    })).rejects.toMatchObject({code:'ASSET_ARCHIVE_NOT_VISIBLE'});
  });

  it('fails explicitly when the R2 bucket binding is unavailable without fetching provider data',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch');
    await expect(generatedAssetStorageService.archive({
      userId:'user-1',assetId:'ast-1',sourceUrl:'https://provider.example/output',fallbackMime:'image/jpeg',fallbackExtension:'jpg',
    })).rejects.toMatchObject({code:'ASSET_STORAGE_UNAVAILABLE'});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the upstream HTTP status code without exposing the response body',async()=>{
    configureR2AssetBucket(fakeBucket());
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('private provider response',{status:402}));
    await expect(generatedAssetStorageService.archive({
      userId:'user-1',assetId:'vid-1',sourceUrl:'https://provider.example/output',fallbackMime:'video/mp4',fallbackExtension:'mp4',
    })).rejects.toMatchObject({code:'ASSET_ARCHIVE_FETCH_FAILED',status:402});
  });
});

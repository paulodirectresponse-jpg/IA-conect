import {afterEach,describe,expect,it} from 'vitest';
import {configureR2AssetBucket,parseAssetByteRange,R2AssetBucketPort,r2AssetStorageService} from './r2AssetStorageService.js';

function makeBucket(){
  const files=new Map<string,Uint8Array>();
  const contentTypes=new Map<string,string>();
  const bucket:R2AssetBucketPort={
    async put(key,value,options){
      contentTypes.set(key,options?.httpMetadata?.contentType||'application/octet-stream');
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
      const bytes=files.get(key);
      return bytes?{
        size:bytes.byteLength,
        httpEtag:`etag-${key}`,
        writeHttpMetadata(headers){headers.set('content-type',contentTypes.get(key)||'application/octet-stream');},
      }:null;
    },
    async get(key,options){
      const bytes=files.get(key);
      if(!bytes)return null;
      const bodyBytes=options?.range?bytes.slice(options.range.offset,options.range.offset+options.range.length):bytes;
      return{
        body:new Response(bodyBytes).body!,
        size:bytes.byteLength,
        httpEtag:`etag-${key}`,
        writeHttpMetadata(headers){headers.set('content-type',contentTypes.get(key)||'application/octet-stream');},
      };
    },
    async delete(key){files.delete(key);contentTypes.delete(key);},
  };
  return{bucket,files};
}

afterEach(()=>configureR2AssetBucket(null));

describe('R2 asset storage',()=>{
  it('accepts and confirms a streamed upload before returning its durable path',async()=>{
    const {bucket,files}=makeBucket();
    configureR2AssetBucket(bucket);
    const bytes=new Uint8Array([10,20,30,40]);
    const result=await r2AssetStorageService.putUploadedStream({
      storagePath:'users/user-1/assets/ast-1/original.png',
      stream:new Response(bytes).body!,
      mimeType:'image/png',
      expectedBytes:4,
    });
    expect(result.size_bytes).toBe(4);
    expect(files.get(result.storage_path)).toEqual(bytes);
  });

  it('deletes partial objects when the byte count does not match the upload ticket',async()=>{
    const {bucket,files}=makeBucket();
    configureR2AssetBucket(bucket);
    await expect(r2AssetStorageService.putUploadedStream({
      storagePath:'users/user-1/assets/ast-2/original.png',
      stream:new Response(new Uint8Array([1,2,3])).body!,
      mimeType:'image/png',
      expectedBytes:4,
    })).rejects.toMatchObject({code:'ASSET_UPLOAD_SIZE_MISMATCH'});
    expect(files.has('users/user-1/assets/ast-2/original.png')).toBe(false);
  });

  it('rejects unsafe object paths',async()=>{
    const {bucket}=makeBucket();
    configureR2AssetBucket(bucket);
    await expect(r2AssetStorageService.head('../private.png')).rejects.toMatchObject({code:'ASSET_STORAGE_PATH_INVALID'});
  });

  it('removes the temporary health probe after confirming R2 write and read',async()=>{
    const {bucket,files}=makeBucket();
    configureR2AssetBucket(bucket);
    await expect(r2AssetStorageService.probe()).resolves.toMatchObject({size:'ia-conect-r2-health-probe-v1'.length});
    expect(files.size).toBe(0);
  });

  it('parses normal and suffix byte ranges and rejects unsatisfiable requests',()=>{
    expect(parseAssetByteRange('bytes=2-5',10)).toEqual({offset:2,length:4,contentRange:'bytes 2-5/10'});
    expect(parseAssetByteRange('bytes=-3',10)).toEqual({offset:7,length:3,contentRange:'bytes 7-9/10'});
    expect(parseAssetByteRange('bytes=8-',10)).toEqual({offset:8,length:2,contentRange:'bytes 8-9/10'});
    expect(parseAssetByteRange('bytes=10-',10)).toBe('UNSATISFIABLE');
    expect(parseAssetByteRange('bytes=1-2,5-6',10)).toBeNull();
  });
});

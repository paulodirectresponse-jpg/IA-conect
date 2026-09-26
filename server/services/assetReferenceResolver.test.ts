import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('../repositories/assetRepository.js',()=>({
  assetRepository:{findArchivedStorageProbeAsset:vi.fn()},
}));

import {assetRepository} from '../repositories/assetRepository.js';
import {assetReferenceResolver} from './assetReferenceResolver.js';

const previous={
  SUPABASE_URL:process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,
  SUPABASE_BUCKET:process.env.SUPABASE_BUCKET,
};

afterEach(()=>{
  vi.restoreAllMocks();
  if(previous.SUPABASE_URL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previous.SUPABASE_URL;
  if(previous.SUPABASE_SECRET_KEY===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previous.SUPABASE_SECRET_KEY;
  if(previous.SUPABASE_BUCKET===undefined)delete process.env.SUPABASE_BUCKET;else process.env.SUPABASE_BUCKET=previous.SUPABASE_BUCKET;
});

describe('storage diagnostics',()=>{
  it('does not report configured bindings as a successful read or write',async()=>{
    process.env.SUPABASE_URL='https://storage.example';
    process.env.SUPABASE_SECRET_KEY='server-secret';
    process.env.SUPABASE_BUCKET='assets';
    vi.mocked(assetRepository.findArchivedStorageProbeAsset).mockResolvedValue({
      asset_id:'ast_probe',owner_user_id:'user-1',type:'IMAGE',category:'GENERIC',name:'probe',alias:'probe',
      storage_path:'users/user-1/probe.png',mime_type:'image/png',size_bytes:1,status:'READY',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      media_metadata:{archived:true},
    });
    const fetchMock=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({signedURL:'/object/sign/assets/users/user-1/probe.png?token=temporary'}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(null,{status:402}));

    const result=await assetReferenceResolver.runStorageDiagnostic();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/storage/v1/object/sign/assets/');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({method:'HEAD'});
    expect(result.is_configured).toBe(true);
    expect(result.write_test).toBe('SKIPPED');
    expect(result.signed_url_test).toBe('FAIL');
    expect(result.details?.bucket_accessible).toBe(false);
    expect(result.details?.error).toBe('SIGNED_READ_HTTP_402');
  });
});

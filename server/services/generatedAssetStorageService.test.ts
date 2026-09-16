import { afterEach,describe,expect,it,vi } from 'vitest';
import { generatedAssetStorageService } from './generatedAssetStorageService.js';

const previous={
  SUPABASE_URL:process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,
  SUPABASE_BUCKET:process.env.SUPABASE_BUCKET,
};

afterEach(()=>{
  vi.restoreAllMocks();
  process.env.SUPABASE_URL=previous.SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY=previous.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_BUCKET=previous.SUPABASE_BUCKET;
});

describe('PR-05 generated asset storage',()=>{
  it('archives provider output into a user-owned deterministic storage path',async()=>{
    process.env.SUPABASE_URL='https://storage.example';
    process.env.SUPABASE_SECRET_KEY='server-secret';
    process.env.SUPABASE_BUCKET='assets';

    const fetchMock=vi.spyOn(globalThis,'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([1,2,3]),{status:200,headers:{'content-type':'image/png','content-length':'3'}}))
      .mockResolvedValueOnce(new Response('{}',{status:200}));

    const archived=await generatedAssetStorageService.archive({
      userId:'user-1',
      assetId:'ast-1',
      sourceUrl:'https://provider.example/output',
      fallbackMime:'image/jpeg',
      fallbackExtension:'jpg',
    });

    expect(archived.storage_path).toBe('users/user-1/assets/ast-1/generated.png');
    expect(archived.public_url).toBe('https://storage.example/storage/v1/object/public/assets/users/user-1/assets/ast-1/generated.png');
    expect(archived.size_bytes).toBe(3);
    const uploadCall=fetchMock.mock.calls[1];
    expect(String(uploadCall[0])).toContain('/storage/v1/object/assets/users/user-1/assets/ast-1/generated.png');
    expect(JSON.stringify(archived)).not.toContain('server-secret');
  });

  it('fails safely when official storage is unavailable',async()=>{
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_BUCKET='assets';
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1]),{status:200,headers:{'content-type':'image/png'}}));
    await expect(generatedAssetStorageService.archive({
      userId:'user-1',assetId:'ast-1',sourceUrl:'https://provider.example/output',fallbackMime:'image/jpeg',fallbackExtension:'jpg',
    })).rejects.toMatchObject({code:'ASSET_STORAGE_UNAVAILABLE'});
  });
});

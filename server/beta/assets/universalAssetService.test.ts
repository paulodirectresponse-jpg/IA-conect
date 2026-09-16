import { describe,expect,it } from 'vitest';
import { Asset } from '../../../src/types/index.js';
import { publicUniversalAsset } from './universalAssetService.js';

const asset:Asset={
  asset_id:'ast_1',
  owner_user_id:'user-secret',
  type:'MODEL_3D',
  category:'GENERIC',
  name:'Modelo',
  alias:'modelo',
  storage_path:'users/user-secret/assets/ast_1/generated.glb',
  public_url:'https://cdn.example/model.glb',
  thumbnail_url:'',
  preview_url:'https://cdn.example/preview.webp',
  preview_mime_type:'image/webp',
  mime_type:'model/gltf-binary',
  size_bytes:123,
  width:null,
  height:null,
  duration_seconds:null,
  status:'READY',
  origin:'GENERATED',
  source_generation_id:'gen_1',
  source_job_id:'bjob_1',
  derived_from_asset_id:'ast_parent',
  source_output_index:0,
  source_model_id:'model-3d',
  source_provider_id:'provider-secret',
  media_metadata:{archived:true},
  created_at:'2026-01-01T00:00:00.000Z',
  updated_at:'2026-01-01T00:00:00.000Z',
  deleted_at:null,
};

describe('PR-05 universal asset contract',()=>{
  it('represents IMAGE, VIDEO, AUDIO and MODEL_3D compatible metadata',()=>{
    const view=publicUniversalAsset(asset);
    expect(view.type).toBe('MODEL_3D');
    expect(view.source_job_id).toBe('bjob_1');
    expect(view.derived_from_asset_id).toBe('ast_parent');
    expect(view.preview_url).toContain('preview.webp');
    expect(view.media_metadata.archived).toBe(true);
  });

  it('does not expose owner, provider or internal storage paths',()=>{
    const json=JSON.stringify(publicUniversalAsset(asset));
    expect(json).not.toContain('owner_user_id');
    expect(json).not.toContain('provider-secret');
    expect(json).not.toContain('storage_path');
    expect(json).not.toContain('user-secret');
  });
});

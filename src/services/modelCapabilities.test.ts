import { describe, expect, it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../config/studioCatalog.js';
import { adaptConfigurationToModel, validateConfiguration } from './modelCapabilities.js';
import { WorkspaceReference, Asset } from '../types/index.js';

const model=(id:string)=>{
  const found=STUDIO_SEED_MODELS.find((item)=>item.model_id===id);
  if(!found)throw new Error(`Missing model ${id}`);
  return found;
};

const asset=(id:string,type:Asset['type']):Asset=>({
  asset_id:id,
  owner_user_id:'u1',
  type,
  category:type==='AUDIO'?'AUDIO_REFERENCE':'GENERIC',
  name:id,
  alias:id,
  storage_path:`test/${id}`,
  public_url:`https://example.com/${id}`,
  mime_type:type==='IMAGE'?'image/png':type==='VIDEO'?'video/mp4':'audio/mpeg',
  size_bytes:1,
  status:'READY',
  created_at:'2026-09-10T00:00:00.000Z',
  updated_at:'2026-09-10T00:00:00.000Z',
});

const ref=(id:string,type:Asset['type']):WorkspaceReference=>({
  asset_id:id,
  alias_snapshot:id,
  role:'GENERAL',
  priority:'HIGH',
  preservation_rules:[],
  flexible_rules:[],
  asset:asset(id,type),
});

describe('model-driven video configuration',()=>{
  it('maps 720p to Kling Standard when Kling is selected',()=>{
    const next=adaptConfigurationToModel(model('kling-3-0'),{
      duration_seconds:5,
      resolution:'720p',
      aspect_ratio:'16:9',
      references:[],
    });
    expect(next.resolution).toBe('Standard');
    expect(next.duration_seconds).toBe(5);
  });

  it('maps 720p to the closest MiniMax H3 resolution',()=>{
    const next=adaptConfigurationToModel(model('minimax-h3'),{
      duration_seconds:5,
      resolution:'720p',
      aspect_ratio:'16:9',
      references:[],
    });
    expect(next.resolution).toBe('768p');
  });

  it('clamps unsupported duration and aspect ratio to model-supported values',()=>{
    const next=adaptConfigurationToModel(model('kling-3-0'),{
      duration_seconds:30,
      resolution:'1080p',
      aspect_ratio:'21:9',
      references:[],
    });
    expect(next.duration_seconds).toBe(15);
    expect(next.aspect_ratio).toBe('16:9');
    expect(next.resolution).toBe('Standard');
  });

  it('removes general multimodal references from a model without reference mode',()=>{
    const next=adaptConfigurationToModel(model('seedance-2-0'),{
      duration_seconds:5,
      resolution:'720p',
      aspect_ratio:'16:9',
      references:[ref('image-1','IMAGE')],
    });
    expect(next.references).toEqual([]);
  });

  it('keeps supported image, video and audio references on WAN 3.0',()=>{
    const references=[ref('image-1','IMAGE'),ref('video-1','VIDEO'),ref('audio-1','AUDIO')];
    const next=adaptConfigurationToModel(model('wan-3-0'),{
      duration_seconds:5,
      resolution:'720p',
      aspect_ratio:'16:9',
      references,
    });
    expect(next.references.map((item)=>item.asset?.type)).toEqual(['IMAGE','VIDEO','AUDIO']);
  });

  it('clears unsupported advanced inputs when changing model',()=>{
    const next=adaptConfigurationToModel(model('google-omni-flash'),{
      duration_seconds:5,
      resolution:'720p',
      aspect_ratio:'16:9',
      negative_prompt:'no blur',
      references:[],
    });
    expect(next.negative_prompt).toBe('');
    expect(next.clear_seed).toBe(true);
  });

  it('produces a valid MiniMax configuration after adaptation',()=>{
    const h3=model('minimax-h3');
    const next=adaptConfigurationToModel(h3,{
      duration_seconds:4,
      resolution:'720p',
      aspect_ratio:'16:9',
      references:[],
    });
    const checked=validateConfiguration(h3,{
      mode:'TEXT_TO_VIDEO',
      duration_seconds:next.duration_seconds,
      resolution:next.resolution,
      aspect_ratio:next.aspect_ratio,
      references:next.references,
    });
    expect(checked.valid).toBe(true);
    expect(checked.errors).toEqual([]);
  });
});

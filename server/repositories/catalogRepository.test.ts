import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogRepository, MODEL_MAPPINGS } from './catalogRepository.js';

const firestoreMocks=vi.hoisted(()=>({runQuery:vi.fn(),commit:vi.fn(),set:vi.fn()}));

vi.mock('./firestoreAdminRest.js',()=>({firestoreAdminRest:{
  runQuery:firestoreMocks.runQuery,
  commit:firestoreMocks.commit,
  set:firestoreMocks.set,
  docName:(path:string)=>`projects/test/databases/(default)/documents/${path}`,
  fields:(value:unknown)=>value,
}}));

describe('catalogRepository Atlas GPT Image 2 mapping migration',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    catalogRepository.clearForTesting();
    const rows=MODEL_MAPPINGS.filter(row=>row.mapping_id!=='map-gptimg2-atlas').map(row=>({data:row}));
    rows.push({data:{mapping_id:'map-gptimg2-atlas',model_id:'gpt-image-2',provider_id:'provider-atlas',provider_model_identifier:'openai/gpt-image-2',status:'ACTIVE'}} as any);
    firestoreMocks.runQuery.mockResolvedValue(rows);
    firestoreMocks.commit.mockResolvedValue(undefined);
    firestoreMocks.set.mockResolvedValue(undefined);
  });

  it('migrates the old generic Atlas endpoint and keeps text generation separate from editing',async()=>{
    const mappings=await catalogRepository.listMappings();
    const textToImage=mappings.find(row=>row.mapping_id==='map-gptimg2-atlas');
    const edit=mappings.find(row=>row.mapping_id==='map-gptimg2-atlas-edit');

    expect(textToImage).toMatchObject({
      provider_model_identifier:'openai/gpt-image-2/text-to-image',capabilities:['text-to-image'],status:'ACTIVE',
    });
    expect(edit).toMatchObject({provider_model_identifier:'openai/gpt-image-2/edit',capabilities:['image-edit','image-to-image']});
    expect(firestoreMocks.set).toHaveBeenCalledWith('provider_models/map-gptimg2-atlas',expect.objectContaining({
      provider_model_identifier:'openai/gpt-image-2/text-to-image',capabilities:['text-to-image'],
    }));
  });
});

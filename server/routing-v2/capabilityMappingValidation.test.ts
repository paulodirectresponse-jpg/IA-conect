import { describe, expect, it } from 'vitest';
import { assertIdentifierMatchesCapability, filterCompatibleCapabilities } from './capabilityMappingValidation.js';

describe('provider identifier capability validation',()=>{
  it('filters edit endpoints out of text-to-image discovery results',()=>{
    expect(filterCompatibleCapabilities('openai/gpt-image-2.5-flare/edit',['text-to-image','image-edit'])).toEqual(['image-edit']);
  });
  it('filters generation endpoints out of image-edit discovery results',()=>{
    expect(filterCompatibleCapabilities('openai/gpt-image-2.5-flare/text-to-image',['text-to-image','image-edit'])).toEqual(['text-to-image']);
  });
  it('keeps provider AIR identifiers that do not declare an operation suffix',()=>{
    expect(filterCompatibleCapabilities('google:4@3',['text-to-image','image-to-image'])).toEqual(['text-to-image','image-to-image']);
  });
  it('rejects a mismatched route before it is persisted',()=>{
    expect(()=>assertIdentifierMatchesCapability('google/nano-banana-2/edit','text-to-image')).toThrow(/edição/);
  });
});

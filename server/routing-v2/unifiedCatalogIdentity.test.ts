import { describe, expect, it } from 'vitest';
import { normalizeUnifiedCatalogDisplayName, normalizeUnifiedCatalogSearch, providerIdentifierModelName, unifiedCatalogSearchScore, canonicalizeUnifiedVideoCatalogIdentity } from './unifiedCatalogIdentity.js';

describe('unified catalog provider identity',()=>{
  it('uses the model identifier when a provider returns a generic video endpoint label',()=>{
    expect(providerIdentifierModelName('Image To Video','bytedance/seedance-2.5/image-to-video','bytedance')).toBe('Seedance 2.5');
    expect(providerIdentifierModelName('Text To Video','bytedance/seedance-2.5/text-to-video','bytedance')).toBe('Seedance 2.5');
  });

  it('resolves generic audio and image operation labels to their model IDs',()=>{
    expect(providerIdentifierModelName('Text To Speech','elevenlabs/eleven-v3/text-to-speech','ElevenLabs')).toBe('Eleven V3');
    expect(providerIdentifierModelName('Text To Image','google/nano-banana-2/text-to-image','Google')).toBe('Nano Banana 2');
  });

  it('removes provider namespaces, endpoint names and resolution suffixes from labels',()=>{
    expect(providerIdentifierModelName('Image To Video','runware:seedance-v1-pro/i2v/1080p','ByteDance')).toBe('Seedance V1 Pro');
  });

  it('preserves meaningful provider model names',()=>{
    expect(providerIdentifierModelName('Seedance 2.5','bytedance/seedance-2.5/image-to-video','ByteDance')).toBe('');
  });

  it('normalizes generic labels after provider results have been grouped',()=>{
    expect(normalizeUnifiedCatalogDisplayName('Image To Video',[
      'bytedance/seedance-2.5/image-to-video',
    ],'bytedance')).toBe('Seedance 2.5');
    expect(normalizeUnifiedCatalogDisplayName('Seedance 2.5',[
      'bytedance/seedance-2.5/image-to-video',
    ],'bytedance')).toBe('Seedance 2.5');
  });

  it('normalizes punctuation so display-name searches match provider IDs',()=>{
    const query=normalizeUnifiedCatalogSearch('Seedance 2.5');
    const identifier=normalizeUnifiedCatalogSearch('bytedance/seedance-2.5/image-to-video');
    expect(identifier).toContain(query);
  });

  it('matches query tokens instead of arbitrary substrings and prefers exact short tokens',()=>{
    const wan=unifiedCatalogSearchScore('wan',['Wan 2.2','bytedance:seedance-v2']);
    const wang=unifiedCatalogSearchScore('wan',['Wang Pro']);
    const swan=unifiedCatalogSearchScore('wan',['Swan 2.2']);
    expect(wan).toBeGreaterThan(wang||0);
    expect(swan).toBeNull();
    expect(unifiedCatalogSearchScore('seedan 2.0',['Seedance 2.0 Fast / seedance-v2-0'])).not.toBeNull();
  });

  it('keeps version searches ordered and prevents numeric matches across unrelated metadata fields',()=>{
    expect(unifiedCatalogSearchScore('Seedance 2.0',['Seedance 2 Fast'])).not.toBeNull();
    expect(unifiedCatalogSearchScore('Seedance 2.0',['Seedance 1 Pro','architecture v2','release 0'])).toBeNull();
    expect(unifiedCatalogSearchScore('Seedance 2.0',['Seedance 2.5 Fast'])).toBeNull();
    expect(unifiedCatalogSearchScore('Seedance 2',['Seedance 2.5 Fast'])).toBeNull();
    expect(unifiedCatalogSearchScore('Seedance 2.0',['bytedance:seedance-v2-0@1'])).not.toBeNull();
    expect(unifiedCatalogSearchScore('GPT Image 2.5',['GPT Image 2.5 Sunburst'])).not.toBeNull();
    expect(unifiedCatalogSearchScore('GPT Image 2.5',['GPT Image 2 Sunburst 5'])).toBeNull();
    expect(unifiedCatalogSearchScore('text to video',['Seedance 2.5','image-to-video','text-to-video'])).not.toBeNull();
  });

  it('canonicalizes the same video family and variant from different provider identifiers',()=>{
    const atlas=canonicalizeUnifiedVideoCatalogIdentity('Image To Video','bytedance/seedance-v2-0-fast/i2v/1080p','ByteDance');
    const runware=canonicalizeUnifiedVideoCatalogIdentity('Seedance 2.0 Fast','bytedance:seedance-2-0-fast@1','ByteDance');
    expect(atlas?.catalog_key).toBe(runware?.catalog_key);
    expect(atlas?.display_name).toBe('Seedance 2 Fast');
  });

  it('groups text, image and provider-root Seedance endpoints under one model family',()=>{
    const text=canonicalizeUnifiedVideoCatalogIdentity('Text To Video','bytedance/seedance-2.0/text-to-video','ByteDance');
    const image=canonicalizeUnifiedVideoCatalogIdentity('Image To Video','bytedance/seedance-2-0/image-to-video','ByteDance');
    const root=canonicalizeUnifiedVideoCatalogIdentity('Seedance 2.0','bytedance:seedance-2-0@1','ByteDance');
    expect(text?.catalog_key).toBe(image?.catalog_key);
    expect(image?.catalog_key).toBe(root?.catalog_key);
  });
});

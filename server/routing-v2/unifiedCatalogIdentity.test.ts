import { describe, expect, it } from 'vitest';
import { normalizeUnifiedCatalogDisplayName, normalizeUnifiedCatalogSearch, providerIdentifierModelName } from './unifiedCatalogIdentity.js';

describe('unified catalog provider identity',()=>{
  it('uses the model identifier when a provider returns a generic video endpoint label',()=>{
    expect(providerIdentifierModelName('Image To Video','bytedance/seedance-2.5/image-to-video','bytedance')).toBe('Seedance 2.5');
    expect(providerIdentifierModelName('Text To Video','bytedance/seedance-2.5/text-to-video','bytedance')).toBe('Seedance 2.5');
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
});

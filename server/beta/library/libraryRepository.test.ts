import { describe,expect,it } from 'vitest';
import { normalizeTags } from './libraryRepository.js';

describe('PR-06 Library metadata',()=>{
  it('normalizes, deduplicates and bounds tags',()=>{
    expect(normalizeTags([' #Produto ','produto','Campanha',''])).toEqual(['produto','campanha']);
    expect(normalizeTags('Um, Dois, um')).toEqual(['um','dois']);
    expect(normalizeTags(Array.from({length:30},(_,i)=>`tag-${i}`))).toHaveLength(20);
  });

  it('bounds individual tag length',()=>{
    expect(normalizeTags(['x'.repeat(60)])[0]).toHaveLength(32);
  });
});

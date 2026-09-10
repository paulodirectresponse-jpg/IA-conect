import { describe,it,expect } from 'vitest';
import { packCatalogService } from './packCatalogService.js';

describe('packCatalogService invariants',()=>{
  it('returns immutable commercial totals for known packs',()=>{
    const packs=packCatalogService.list();
    expect(packs.length).toBeGreaterThan(0);
    for(const p of packs){
      expect(p.total_credits).toBe(p.base_credits+p.bonus_credits);
      expect(p.price_brl_cents).toBeGreaterThan(0);
      expect(p.version).toBeGreaterThan(0);
    }
  });
  it('requires matching pack version when one is supplied',()=>{
    const p=packCatalogService.list()[0];
    expect(packCatalogService.get(p.pack_id,p.version)?.version).toBe(p.version);
    expect(packCatalogService.get(p.pack_id,p.version+999)).toBeNull();
  });
  it('maps checkout amount to exactly one active pack',()=>{
    for(const p of packCatalogService.list())expect(packCatalogService.byAmount(p.price_brl_cents)?.pack_id).toBe(p.pack_id);
  });
});

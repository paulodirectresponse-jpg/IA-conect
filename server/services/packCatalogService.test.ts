import { describe,it,expect } from 'vitest';
import { packCatalogService } from './packCatalogService.js';

describe('packCatalogService invariants',()=>{
  it('exposes exactly the three official commercial plans',()=>{
    const packs=packCatalogService.list();
    expect(packs.map(p=>p.pack_id)).toEqual(['creator','pro','studio']);
    expect(packs.map(p=>p.name)).toEqual(['Creator','Pro','Studio']);
    expect(packs.find(p=>p.pack_id==='pro')?.recommended).toBe(true);
  });

  it('returns immutable commercial totals for active plans',()=>{
    const packs=packCatalogService.list();
    for(const p of packs){
      expect(p.total_credits).toBe(p.base_credits+p.bonus_credits);
      expect(p.price_brl_cents).toBeGreaterThan(0);
      expect(p.version).toBeGreaterThan(0);
      expect(p.features.length).toBeGreaterThan(0);
    }
  });

  it('keeps the commercial discount inside the approved safety envelope',()=>{
    // Economics V2: retail reference = R$0,01/credit and target margin = 55%.
    // That implies up to R$0,0045 of Safe COGS per retail credit at the reference price.
    // Even the largest plan must preserve at least 50% implied contribution margin.
    const safeCogsPerCreditBrl=0.0045;
    for(const p of packCatalogService.list()){
      const realizedRevenuePerCredit=(p.price_brl_cents/100)/p.total_credits;
      const impliedMargin=(realizedRevenuePerCredit-safeCogsPerCreditBrl)/realizedRevenuePerCredit;
      expect(impliedMargin).toBeGreaterThanOrEqual(0.50);
    }
  });

  it('requires matching active plan version when one is supplied',()=>{
    const p=packCatalogService.list()[0];
    expect(packCatalogService.get(p.pack_id,p.version)?.version).toBe(p.version);
    expect(packCatalogService.get(p.pack_id,p.version+999)).toBeNull();
  });

  it('retains legacy versions for audit without exposing them for new checkout',()=>{
    expect(packCatalogService.get('starter',1)).toBeNull();
    expect(packCatalogService.getAnyVersion('starter',1)?.active).toBe(false);
  });

  it('maps checkout amount to exactly one active plan',()=>{
    for(const p of packCatalogService.list())expect(packCatalogService.byAmount(p.price_brl_cents)?.pack_id).toBe(p.pack_id);
  });
});

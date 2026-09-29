import { describe, expect, it } from 'vitest';
import { selectFundedRoutePreview } from './providerFunding.js';
import type { ProviderFinanceSnapshot } from '../services/providerFinanceService.js';

const snapshot=(provider_id:string,balance_usd:number,configured=true):ProviderFinanceSnapshot=>({
  provider_id,
  provider_name:provider_id,
  configured,
  balance_usd,
  balance_brl_cents:Math.round(balance_usd*510),
  fx_rate_usd_brl:5.1,
  low_balance_threshold_brl_cents:5000,
  low_balance:balance_usd<50/5.1,
  status:balance_usd>0?'OPERATIONAL':'LOW_BALANCE',
  fetched_at:'2026-09-29T00:00:00.000Z',
  source:'LIVE_API',
});

const preview=(route_id:string,provider_id:string,provider_cost:number,safe_cogs_brl:number)=>({
  route:{route_id,provider_id,priority:100,pricing_snapshot:{fx_rate_usd_brl:5.1}},
  provider_cost,
  provider_currency:'USD' as const,
  safe_cogs_brl,
});

describe('funded routing candidates',()=>{
  it('skips zero/underfunded routes and selects the cheapest official funded provider',()=>{
    const result=selectFundedRoutePreview([
      preview('atlas','provider-atlas',0.12,0.68),
      preview('runware','provider-runware',0.405,2.28),
      preview('wavespeed','provider-wavespeed',0.6,3.38),
    ],[
      snapshot('provider-atlas',0),
      snapshot('provider-runware',0.05),
      snapshot('provider-wavespeed',3.25),
    ]);

    expect(result.selected?.route.route_id).toBe('wavespeed');
    expect(result.excluded).toEqual([
      {route_id:'atlas',provider_id:'provider-atlas',reason:'PROVIDER_BALANCE_INSUFFICIENT'},
      {route_id:'runware',provider_id:'provider-runware',reason:'PROVIDER_BALANCE_INSUFFICIENT'},
    ]);
  });

  it('does not allow a nonofficial or unconfigured provider route',()=>{
    const result=selectFundedRoutePreview([
      preview('legacy','provider-replicate',0.01,0.02),
      preview('missing-key','provider-atlas',0.01,0.02),
    ],[snapshot('provider-atlas',100,false)]);

    expect(result.selected).toBeNull();
    expect(result.excluded.map(row=>row.reason)).toEqual(['PROVIDER_NOT_OFFICIAL','PROVIDER_NOT_CONFIGURED']);
  });

  it('keeps a route eligible when live balance data is unavailable',()=>{
    const route=preview('atlas','provider-atlas',0.12,0.68);
    const unavailable={...snapshot('provider-atlas',0),source:'UNAVAILABLE' as const,balance_usd:null,status:'UNAVAILABLE' as const};

    expect(selectFundedRoutePreview([route],[unavailable]).selected?.route.route_id).toBe('atlas');
  });

  it('converts a BRL route cost to USD before comparing provider balance',()=>{
    const route={...preview('atlas-brl','provider-atlas',5.1,0.68),provider_currency:'BRL' as const};
    expect(selectFundedRoutePreview([route],[snapshot('provider-atlas',0.99)]).selected).toBeNull();
    expect(selectFundedRoutePreview([route],[snapshot('provider-atlas',1)]).selected?.route.route_id).toBe('atlas-brl');
  });
});

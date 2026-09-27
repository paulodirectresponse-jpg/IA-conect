import { afterEach, describe, expect, it, vi } from 'vitest';
import { credentialHealthChecks } from './credentialHealthChecks.js';
import { checkProviderHealth, getProviderHealthCheck } from '../healthAdapter.js';
import './wavespeedHealthCheck.js';
import './atlasHealthCheck.js';
import './runwareHealthCheck.js';
import './credentialHealthChecks.js';
import { RoutingV2Provider } from '../domain.js';

const provider=(provider_id:string,name:string)=>({
  provider_id,name,slug:provider_id.replace('provider-',''),type:'AGGREGATOR' as const,status:'ACTIVE' as const,
  priority:10,adapter_id:`wrapper:${provider_id}`,supports_catalog_sync:false,supports_pricing_sync:false,supports_balance:false,
  health_status:'UNKNOWN' as const,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
}) as RoutingV2Provider;

const endpointCases=[
  {providerId:'provider-fal',keyEnv:'FAL_API_KEY',prefix:'Key ',body:{models:[]},path:'/v1/models?limit=1'},
  {providerId:'provider-deepinfra',keyEnv:'DEEPINFRA_API_KEY',prefix:'Bearer ',body:{limits:{},pending_requests:{}},path:'/v1/me/gpu_limit'},
  {providerId:'provider-replicate',keyEnv:'REPLICATE_API_TOKEN',prefix:'Bearer ',body:{username:'test-account'},path:'/v1/account'},
  {providerId:'provider-aiml',keyEnv:'AIML_API_KEY',prefix:'Bearer ',body:{balance:100,status:'current'},path:'/v1/billing/balance'},
  {providerId:'provider-kie',keyEnv:'KIE_API_KEY',prefix:'Bearer ',body:{code:200,data:100},path:'/api/v1/chat/credit'},
];

describe('read-only provider credential health checks',()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

  it('registers the available official probes and leaves PiAPI without a fabricated check',()=>{
    for(const item of endpointCases)expect(getProviderHealthCheck(item.providerId)).not.toBeNull();
    expect(getProviderHealthCheck('provider-piapi')).toBeNull();
  });

  it.each(endpointCases)('validates $providerId with an authenticated GET endpoint',async item=>{
    vi.stubEnv(item.keyEnv,'test-secret');
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify(item.body),{status:200,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    const check=credentialHealthChecks.find(row=>row.providerId===item.providerId)!;
    const result=await check.check(provider(item.providerId,item.providerId));
    expect(result.status).toBe('HEALTHY');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(item.path),expect.objectContaining({method:'GET',headers:expect.objectContaining({Authorization:`${item.prefix}test-secret`})}));
  });

  it('reports a rejected credential as UNAVAILABLE and a provider throttle as DEGRADED',async()=>{
    vi.stubEnv('KIE_API_KEY','bad-key');
    const check=credentialHealthChecks.find(row=>row.providerId==='provider-kie')!;
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:401})));
    expect((await check.check(provider('provider-kie','Kie.ai'))).status).toBe('UNAVAILABLE');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:429})));
    expect((await check.check(provider('provider-kie','Kie.ai'))).status).toBe('DEGRADED');
  });

  it('does not call a provider when its secret is missing',async()=>{
    vi.stubEnv('FAL_API_KEY','');
    const fetchMock=vi.fn();
    vi.stubGlobal('fetch',fetchMock);
    const check=credentialHealthChecks.find(row=>row.providerId==='provider-fal')!;
    const result=await check.check(provider('provider-fal','fal.ai'));
    expect(result.status).toBe('UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes the admin health adapter through the newly registered credential check',async()=>{
    vi.stubEnv('KIE_API_KEY','test-key');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:200,data:100}),{status:200})));
    const result=await checkProviderHealth(provider('provider-kie','Kie.ai'));
    expect(result.status).toBe('HEALTHY');
    expect(result.message).toContain('endpoint oficial de leitura');
  });
});

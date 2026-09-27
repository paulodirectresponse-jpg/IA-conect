import { RoutingV2Provider } from '../domain.js';
import { RoutingV2ProviderHealth } from '../adapter.js';
import { ProviderHealthCheck, registerProviderHealthCheck } from '../healthAdapter.js';

type CredentialProbe={
  providerId:string;
  providerName:string;
  keyEnv:string;
  baseEnv:string;
  defaultBase:string;
  path:string;
  authorization:(key:string)=>string;
  validBody:(body:any)=>boolean;
};

function trimBase(value:string,fallback:string){
  return String(value||fallback).replace(/\/+$/,'').replace(/\/(?:api\/)?v1$/,'');
}

const probes:CredentialProbe[]=[
  {
    providerId:'provider-fal',providerName:'fal.ai',keyEnv:'FAL_API_KEY',baseEnv:'FAL_CATALOG_BASE_URL',defaultBase:'https://api.fal.ai',path:'/v1/models?limit=1',
    authorization:key=>`Key ${key}`,validBody:body=>Array.isArray(body?.models),
  },
  {
    providerId:'provider-deepinfra',providerName:'DeepInfra',keyEnv:'DEEPINFRA_API_KEY',baseEnv:'DEEPINFRA_BASE_URL',defaultBase:'https://api.deepinfra.com',path:'/v1/me/gpu_limit',
    authorization:key=>`Bearer ${key}`,validBody:body=>Boolean(body&&typeof body==='object'&&body.limits&&typeof body.limits==='object'),
  },
  {
    providerId:'provider-replicate',providerName:'Replicate',keyEnv:'REPLICATE_API_TOKEN',baseEnv:'REPLICATE_BASE_URL',defaultBase:'https://api.replicate.com',path:'/v1/account',
    authorization:key=>`Bearer ${key}`,validBody:body=>Boolean(body&&(typeof body.username==='string'||typeof body.type==='string')),
  },
  {
    providerId:'provider-aiml',providerName:'AI/ML API',keyEnv:'AIML_API_KEY',baseEnv:'AIML_BASE_URL',defaultBase:'https://api.aimlapi.com',path:'/v1/billing/balance',
    authorization:key=>`Bearer ${key}`,validBody:body=>Boolean(body&&('balance'in body||typeof body.status==='string')),
  },
  {
    providerId:'provider-kie',providerName:'Kie.ai',keyEnv:'KIE_API_KEY',baseEnv:'KIE_BASE_URL',defaultBase:'https://api.kie.ai',path:'/api/v1/chat/credit',
    authorization:key=>`Bearer ${key}`,validBody:body=>Number(body?.code)===200&&Number.isFinite(Number(body?.data)),
  },
];

export class CredentialHealthCheck implements ProviderHealthCheck{
  constructor(private readonly probe:CredentialProbe){}
  get providerId(){return this.probe.providerId;}
  get providerName(){return this.probe.providerName;}

  async check(_provider:RoutingV2Provider):Promise<RoutingV2ProviderHealth>{
    const checked_at=new Date().toISOString();
    const apiKey=String(process.env[this.probe.keyEnv]||'').trim();
    if(!apiKey)return{status:'UNAVAILABLE',checked_at,message:`${this.providerName}: secret ${this.probe.keyEnv} ausente no Worker.`};

    const base=trimBase(process.env[this.probe.baseEnv]||'',this.probe.defaultBase);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(`${base}${this.probe.path}`,{method:'GET',headers:{Authorization:this.probe.authorization(apiKey),Accept:'application/json'},signal:controller.signal});
      const text=await response.text();
      let body:any={};
      try{body=JSON.parse(text);}catch{}
      if(response.status===429||response.status>=500)return{status:'DEGRADED',checked_at,message:`${this.providerName}: probe respondeu HTTP ${response.status}.`};
      if(response.status===401||response.status===403)return{status:'UNAVAILABLE',checked_at,message:`${this.providerName}: credencial rejeitada (HTTP ${response.status}).`};
      if(!response.ok)return{status:'UNAVAILABLE',checked_at,message:`${this.providerName}: probe recusado (HTTP ${response.status}).`};
      if(!this.probe.validBody(body))return{status:'DEGRADED',checked_at,message:`${this.providerName}: resposta do probe não corresponde ao formato esperado.`};
      return{status:'HEALTHY',checked_at,message:`${this.providerName}: endpoint oficial de leitura respondeu e aceitou a credencial.`};
    }catch(error:any){
      const timedOut=error?.name==='AbortError';
      return{status:'DEGRADED',checked_at,message:`${this.providerName}: ${timedOut?'timeout':'falha de rede'} no probe de leitura.`};
    }finally{clearTimeout(timer);}
  }
}

export const credentialHealthChecks=probes.map(probe=>new CredentialHealthCheck(probe));
for(const check of credentialHealthChecks)registerProviderHealthCheck(check);

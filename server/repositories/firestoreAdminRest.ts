import crypto from 'crypto';
import { getFirebaseConfig } from './firestoreClient.js';

let cachedToken:{value:string;expiresAt:number}|null=null;
let firestoreRateLimitedUntil=0;
const QUERY_CACHE_TTL_MS=3_000;
const queryCache=new Map<string,{expiresAt:number;value:any[]}>();
const queryInflight=new Map<string,Promise<any[]>>();

function b64url(input:string|Uint8Array){
  const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  let binary=''; for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function pemToBytes(pem:string){
  const clean=pem.replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s+/g,'');
  const binary=atob(clean); const out=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i); return out;
}
async function accessToken(){
  if(cachedToken&&cachedToken.expiresAt>Date.now()+60_000)return cachedToken.value;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim(); if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurado.');
  const sa=JSON.parse(raw); const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const subtle=(globalThis.crypto?.subtle||crypto.webcrypto.subtle) as SubtleCrypto;
  const key=await subtle.importKey('pkcs8',pemToBytes(String(sa.private_key).replace(/\\n/g,'\n')),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const assertion=`${unsigned}.${b64url(sig)}`;
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()});
  const body:any=await r.json(); if(!r.ok||!body.access_token){const error:any=new Error(body?.error_description||'Falha ao autenticar service account.');error.status=r.status;error.code='FIREBASE_SERVICE_ACCOUNT_TOKEN_ERROR';error.oauth_error=String(body?.error||'');throw error;}
  cachedToken={value:String(body.access_token),expiresAt:Date.now()+Number(body.expires_in||3600)*1000}; return cachedToken.value;
}

export function fsValue(v:any):any{
  if(v===null||v===undefined)return{nullValue:null};
  if(typeof v==='string')return{stringValue:v};
  if(typeof v==='boolean')return{booleanValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(fsValue)}};
  if(typeof v==='object')return{mapValue:{fields:fsFields(v)}};
  return{stringValue:String(v)};
}
export function fsFields(obj:Record<string,any>){const out:Record<string,any>={};for(const[k,v]of Object.entries(obj||{})){if(v!==undefined)out[k]=fsValue(v);}return out;}
function unwrap(v:any):any{if(!v||typeof v!=='object')return v;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return Number(v.doubleValue);if('booleanValue'in v)return Boolean(v.booleanValue);if('timestampValue'in v)return v.timestampValue;if('nullValue'in v)return null;if('arrayValue'in v)return(v.arrayValue?.values||[]).map(unwrap);if('mapValue'in v)return unwrapFields(v.mapValue?.fields||{});return undefined;}
function unwrapFields(fields:any){const out:Record<string,any>={};for(const[k,v]of Object.entries(fields||{}))out[k]=unwrap(v);return out;}

function base(){const cfg=getFirebaseConfig();const db=cfg.firestoreDatabaseId||'(default)';return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${db}`;}
function rateLimitError(){
  const e:any=new Error('Firestore temporariamente limitado por cota.');
  e.status=429;
  e.code='FIRESTORE_RATE_LIMIT_ACTIVE';
  e.retry_after_ms=Math.max(0,firestoreRateLimitedUntil-Date.now());
  return e;
}
function assertFirestoreWindow(){if(Date.now()<firestoreRateLimitedUntil)throw rateLimitError();}
function noteRateLimit(response:Response){
  if(response.status!==429)return;
  const raw=Number(response.headers.get('retry-after')||0);
  const delay=Number.isFinite(raw)&&raw>0?Math.min(60_000,raw*1000):15_000;
  firestoreRateLimitedUntil=Math.max(firestoreRateLimitedUntil,Date.now()+delay);
}
function clearReadCaches(){queryCache.clear();}
async function req(url:string,init:RequestInit={}){
  assertFirestoreWindow();
  const token=await accessToken();
  const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});
  const text=await r.text();
  let body:any={};
  try{body=text?JSON.parse(text):{};}catch{body={raw:text};}
  if(!r.ok){
    noteRateLimit(r);
    const e:any=new Error(body?.error?.message||`Firestore REST ${r.status}`);
    e.status=r.status;
    e.body=body;
    e.retry_after=r.headers.get('retry-after')||'';
    throw e;
  }
  return body;
}

function parseJsonStream(text:string){
  const trimmed=text.trim();
  if(!trimmed)return[];
  try{
    const parsed=JSON.parse(trimmed);
    return Array.isArray(parsed)?parsed:[parsed];
  }catch{
    return trimmed.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>JSON.parse(line));
  }
}

export const firestoreAdminRest={
  async get(path:string){try{const d=await req(`${base()}/documents/${path}`);return{exists:true,data:unwrapFields(d.fields||{}),updateTime:d.updateTime};}catch(e:any){if(e.status===404)return{exists:false,data:null,updateTime:null};throw e;}},
  async batchGet(paths:string[],chunkSize=80){
    const unique=[...new Set(paths.filter(Boolean))];
    const result=new Map<string,{exists:boolean;data:any;updateTime:string|null}>();
    if(unique.length===0)return result;
    const fullToPath=new Map<string,string>();
    for(const path of unique){
      const full=this.docName(path);
      fullToPath.set(full,path);
      try{fullToPath.set(decodeURIComponent(full),path);}catch{}
      result.set(path,{exists:false,data:null,updateTime:null});
    }
    const size=Math.max(1,Math.min(100,chunkSize));
    for(let i=0;i<unique.length;i+=size){
      const chunk=unique.slice(i,i+size);
      assertFirestoreWindow();
      const token=await accessToken();
      const response=await fetch(`${base()}/documents:batchGet`,{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({documents:chunk.map((path)=>this.docName(path))}),
      });
      const text=await response.text();
      if(!response.ok){
        noteRateLimit(response);
        let body:any={};
        try{body=text?JSON.parse(text):{};}catch{body={raw:text};}
        const e:any=new Error(body?.error?.message||`Firestore REST ${response.status}`);
        e.status=response.status;e.body=body;e.retry_after=response.headers.get('retry-after')||'';throw e;
      }
      for(const row of parseJsonStream(text)){
        if(row?.found?.name){
          const rawName=String(row.found.name);
          let path=fullToPath.get(rawName);
          if(!path){try{path=fullToPath.get(decodeURIComponent(rawName));}catch{}}
          if(path)result.set(path,{exists:true,data:unwrapFields(row.found.fields||{}),updateTime:row.found.updateTime||null});
        }else if(row?.missing){
          const rawName=String(row.missing);
          let path=fullToPath.get(rawName);
          if(!path){try{path=fullToPath.get(decodeURIComponent(rawName));}catch{}}
          if(path)result.set(path,{exists:false,data:null,updateTime:null});
        }
      }
    }
    return result;
  },
  async set(path:string,data:any){const d=await req(`${base()}/documents/${path}`,{method:'PATCH',body:JSON.stringify({fields:fsFields(data)})});clearReadCaches();return{data:unwrapFields(d.fields||{}),updateTime:d.updateTime};},
  async runQuery(structuredQuery:any){
    const key=JSON.stringify(structuredQuery);
    const cached=queryCache.get(key);
    if(cached&&cached.expiresAt>Date.now())return cached.value;
    const pending=queryInflight.get(key);
    if(pending)return pending;
    const request=req(`${base()}/documents:runQuery`,{method:'POST',body:JSON.stringify({structuredQuery})}).then(rows=>{
      const value=(rows||[]).filter((x:any)=>x.document).map((x:any)=>({name:x.document.name,data:unwrapFields(x.document.fields||{}),updateTime:x.document.updateTime}));
      queryCache.set(key,{expiresAt:Date.now()+QUERY_CACHE_TTL_MS,value});
      return value;
    }).finally(()=>queryInflight.delete(key));
    queryInflight.set(key,request);
    return request;
  },
  async commit(writes:any[]){const result=await req(`${base()}/documents:commit`,{method:'POST',body:JSON.stringify({writes})});clearReadCaches();return result;},
  docName(path:string){const cfg=getFirebaseConfig();const db=cfg.firestoreDatabaseId||'(default)';return `projects/${cfg.projectId}/databases/${db}/documents/${path}`;},
  fields:fsFields,
};

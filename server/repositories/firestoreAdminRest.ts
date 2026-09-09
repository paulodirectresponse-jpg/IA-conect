import crypto from 'crypto';
import { getFirebaseConfig } from './firestoreClient.js';

let cachedToken:{value:string;expiresAt:number}|null=null;

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
  const body:any=await r.json(); if(!r.ok||!body.access_token)throw new Error(body?.error_description||'Falha ao autenticar service account.');
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
async function req(url:string,init:RequestInit={}){const token=await accessToken();const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});const text=await r.text();let body:any={};try{body=text?JSON.parse(text):{};}catch{body={raw:text};}if(!r.ok){const e:any=new Error(body?.error?.message||`Firestore REST ${r.status}`);e.status=r.status;e.body=body;throw e;}return body;}

export const firestoreAdminRest={
  async get(path:string){try{const d=await req(`${base()}/documents/${path}`);return{exists:true,data:unwrapFields(d.fields||{}),updateTime:d.updateTime};}catch(e:any){if(e.status===404)return{exists:false,data:null,updateTime:null};throw e;}},
  async set(path:string,data:any){const d=await req(`${base()}/documents/${path}`,{method:'PATCH',body:JSON.stringify({fields:fsFields(data)})});return{data:unwrapFields(d.fields||{}),updateTime:d.updateTime};},
  async runQuery(structuredQuery:any){const rows=await req(`${base()}/documents:runQuery`,{method:'POST',body:JSON.stringify({structuredQuery})});return(rows||[]).filter((x:any)=>x.document).map((x:any)=>({name:x.document.name,data:unwrapFields(x.document.fields||{}),updateTime:x.document.updateTime}));},
  async commit(writes:any[]){return req(`${base()}/documents:commit`,{method:'POST',body:JSON.stringify({writes})});},
  docName(path:string){const cfg=getFirebaseConfig();const db=cfg.firestoreDatabaseId||'(default)';return `projects/${cfg.projectId}/databases/${db}/documents/${path}`;},
  fields:fsFields,
};

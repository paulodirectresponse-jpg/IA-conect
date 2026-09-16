import { auth } from '../config/firebase.js';
import { recordApiTiming } from '../utils/performanceMetrics.js';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type CacheEntry={expiresAt:number;value:any};
const inFlightGets=new Map<string,Promise<any>>();
const responseCache=new Map<string,CacheEntry>();
const perfNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
const cacheIdentity=()=>auth.currentUser?.uid||'anonymous';
const normalizeUrl=(endpoint:string)=>endpoint.startsWith('/')?endpoint:`/api/${endpoint}`;
const getKey=(endpoint:string)=>`${cacheIdentity()}:GET:${normalizeUrl(endpoint)}`;

async function performApiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const startedAt = perfNow();
  const method = String(options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string,string> || {}) };
  if (auth.currentUser) {
    try { headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`; }
    catch (e) { console.warn('[ApiClient] Failed to obtain ID token:', e); }
  }

  const url = normalizeUrl(endpoint);
  const ownController = !options.signal ? new AbortController() : null;
  const signal = options.signal || ownController?.signal;
  const timeoutMs = endpoint.startsWith('/api/catalog/') ? 8000 : 45000;
  const timer = ownController ? window.setTimeout(() => ownController.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal });
  } catch (err: any) {
    recordApiTiming({
      endpoint:url,
      method,
      duration_ms:Math.max(0, perfNow() - startedAt),
      status:err?.name === 'AbortError' ? 408 : 0,
      response_bytes:0,
      server_timing:null,
    });
    if (err?.name === 'AbortError') throw new ApiError('Tempo limite da requisição.', 'REQUEST_TIMEOUT', 408);
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }

  const text = await response.text();
  const responseBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).byteLength : text.length;
  recordApiTiming({
    endpoint:url,
    method,
    duration_ms:Math.max(0, perfNow() - startedAt),
    status:response.status,
    response_bytes:responseBytes,
    server_timing:response.headers.get('server-timing'),
  });

  let json: any;
  try { json = JSON.parse(text); }
  catch { throw new ApiError(`Resposta inválida do servidor (${response.status})`, 'INVALID_SERVER_RESPONSE', response.status); }

  if (!response.ok || json.success === false) {
    const message = json?.error?.message || json?.message || `Erro na requisição (${response.status})`;
    const code = json?.error?.code || 'REQUEST_FAILED';
    throw new ApiError(message, code, response.status, json?.error);
  }
  return json.data !== undefined ? json.data : json;
}

export function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method=String(options.method||'GET').toUpperCase();
  const canDedupe=method==='GET'&&!options.signal&&!options.body;
  if(!canDedupe)return performApiRequest<T>(endpoint,options);

  const key=getKey(endpoint);
  const existing=inFlightGets.get(key);
  if(existing)return existing as Promise<T>;

  const request=performApiRequest<T>(endpoint,options).finally(()=>inFlightGets.delete(key));
  inFlightGets.set(key,request);
  return request;
}

export function apiRequestCached<T = any>(endpoint:string,ttlMs:number,force=false):Promise<T>{
  const key=getKey(endpoint),now=Date.now(),cached=responseCache.get(key);
  if(!force&&cached&&cached.expiresAt>now)return Promise.resolve(cached.value as T);
  return apiRequest<T>(endpoint).then(value=>{
    responseCache.set(key,{expiresAt:Date.now()+Math.max(0,ttlMs),value});
    return value;
  });
}

export function invalidateApiCache(endpointPrefix?:string){
  const identity=`${cacheIdentity()}:GET:`;
  for(const key of responseCache.keys()){
    if(!key.startsWith(identity))continue;
    if(!endpointPrefix||key.includes(normalizeUrl(endpointPrefix)))responseCache.delete(key);
  }
}

export function clearApiCache(){
  responseCache.clear();
  inFlightGets.clear();
}

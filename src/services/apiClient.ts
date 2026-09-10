import { auth } from '../config/firebase.js';

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

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string,string> || {}) };
  if (auth.currentUser) {
    try { headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`; }
    catch (e) { console.warn('[ApiClient] Failed to obtain ID token:', e); }
  }

  const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;
  const ownController = !options.signal ? new AbortController() : null;
  const signal = options.signal || ownController?.signal;
  const timeoutMs = endpoint.startsWith('/api/catalog/') ? 8000 : 45000;
  const timer = ownController ? window.setTimeout(() => ownController.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new ApiError('Tempo limite da requisição.', 'REQUEST_TIMEOUT', 408);
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }

  const text = await response.text();
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

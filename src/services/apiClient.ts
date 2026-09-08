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

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach Firebase Auth ID token if signed in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.warn('[ApiClient] Failed to obtain ID token:', e);
    }
  }

  const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(`Resposta inválida do servidor (${response.status})`, 'INVALID_SERVER_RESPONSE', response.status);
  }

  if (!response.ok || json.success === false) {
    const message = json?.error?.message || json?.message || `Erro na requisição (${response.status})`;
    const code = json?.error?.code || 'REQUEST_FAILED';
    throw new ApiError(message, code, response.status, json?.error);
  }

  return json.data !== undefined ? json.data : json;
}

export interface ProviderFinanceSnapshot {
  provider_id: 'provider-atlas' | 'provider-wavespeed';
  provider_name: string;
  configured: boolean;
  balance_usd: number | null;
  balance_brl_cents: number | null;
  fx_rate_usd_brl: number;
  low_balance_threshold_brl_cents: number;
  low_balance: boolean;
  status: 'OPERATIONAL' | 'LOW_BALANCE' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  fetched_at: string;
  source: 'LIVE_API' | 'UNAVAILABLE';
  error?: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: ProviderFinanceSnapshot }>();

function fxRate() {
  const value = Number(process.env.PROVIDER_USD_BRL || '5.10');
  return Number.isFinite(value) && value > 0 ? value : 5.10;
}

function lowThresholdCents() {
  const value = Number(process.env.PROVIDER_LOW_BALANCE_BRL || '50');
  return Math.max(0, Math.round((Number.isFinite(value) ? value : 50) * 100));
}

function toSnapshot(params: {
  provider_id: 'provider-atlas' | 'provider-wavespeed';
  provider_name: string;
  configured: boolean;
  balance_usd?: number | null;
  error?: string;
}): ProviderFinanceSnapshot {
  const fx = fxRate();
  const threshold = lowThresholdCents();
  const balance = typeof params.balance_usd === 'number' && Number.isFinite(params.balance_usd)
    ? Math.max(0, params.balance_usd)
    : null;
  const brlCents = balance == null ? null : Math.round(balance * fx * 100);
  const low = brlCents != null && brlCents < threshold;
  return {
    provider_id: params.provider_id,
    provider_name: params.provider_name,
    configured: params.configured,
    balance_usd: balance,
    balance_brl_cents: brlCents,
    fx_rate_usd_brl: fx,
    low_balance_threshold_brl_cents: threshold,
    low_balance: low,
    status: !params.configured ? 'NOT_CONFIGURED' : params.error ? 'UNAVAILABLE' : low ? 'LOW_BALANCE' : 'OPERATIONAL',
    fetched_at: new Date().toISOString(),
    source: params.error || balance == null ? 'UNAVAILABLE' : 'LIVE_API',
    ...(params.error ? { error: params.error } : {}),
  };
}

async function fetchJson(url: string, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: any = {};
    try { body = JSON.parse(text); } catch { body = {}; }
    if (!res.ok) throw new Error(body?.error?.message || body?.message || `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function atlasBalance(force = false): Promise<ProviderFinanceSnapshot> {
  const id = 'provider-atlas';
  const hit = cache.get(id);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const key = String(process.env.ATLAS_API_KEY || '').trim();
  if (!key) return toSnapshot({ provider_id:id, provider_name:'Atlas Cloud', configured:false });
  try {
    const body = await fetchJson('https://api.atlascloud.ai/public/v1/balance', key);
    const raw = body?.available?.value ?? body?.balance?.value ?? body?.value;
    const value = Number(raw);
    const snapshot = toSnapshot({ provider_id:id, provider_name:'Atlas Cloud', configured:true, balance_usd:Number.isFinite(value) ? value : null });
    cache.set(id, { at: Date.now(), value:snapshot });
    return snapshot;
  } catch (err:any) {
    const snapshot = toSnapshot({ provider_id:id, provider_name:'Atlas Cloud', configured:true, error:err?.message || 'Falha ao consultar saldo.' });
    cache.set(id, { at: Date.now(), value:snapshot });
    return snapshot;
  }
}

async function wavespeedBalance(force = false): Promise<ProviderFinanceSnapshot> {
  const id = 'provider-wavespeed';
  const hit = cache.get(id);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const key = String(process.env.WAVESPEED_API_KEY || '').trim();
  if (!key) return toSnapshot({ provider_id:id, provider_name:'WaveSpeed', configured:false });
  try {
    const base = String(process.env.WAVESPEED_BASE_URL || 'https://api.wavespeed.ai').replace(/\/+$/, '').replace(/\/api\/v3$/, '');
    const body = await fetchJson(`${base}/api/v3/balance`, key);
    const value = Number(body?.data?.balance ?? body?.balance);
    const snapshot = toSnapshot({ provider_id:id, provider_name:'WaveSpeed', configured:true, balance_usd:Number.isFinite(value) ? value : null });
    cache.set(id, { at: Date.now(), value:snapshot });
    return snapshot;
  } catch (err:any) {
    const snapshot = toSnapshot({ provider_id:id, provider_name:'WaveSpeed', configured:true, error:err?.message || 'Falha ao consultar saldo.' });
    cache.set(id, { at: Date.now(), value:snapshot });
    return snapshot;
  }
}

export const providerFinanceService = {
  async getAll(force = false) {
    return Promise.all([atlasBalance(force), wavespeedBalance(force)]);
  },
  async get(providerId: string, force = false) {
    if (providerId === 'provider-atlas') return atlasBalance(force);
    if (providerId === 'provider-wavespeed') return wavespeedBalance(force);
    return null;
  },
  clearCache() { cache.clear(); },
};

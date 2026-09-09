interface FxSnapshot {
  rate: number;
  fetched_at: string;
  source: 'LIVE_API' | 'ENV_FALLBACK';
}

const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; value: FxSnapshot } | null = null;

function fallbackRate() {
  const value = Number(process.env.PROVIDER_USD_BRL || '5.10');
  return Number.isFinite(value) && value > 0 ? value : 5.10;
}

async function fetchLiveRate(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const body: any = await res.json();
    const ask = Number(body?.USDBRL?.ask ?? body?.USDBRL?.bid);
    if (!Number.isFinite(ask) || ask <= 0) throw new Error('Cotação USD/BRL inválida.');
    return ask;
  } finally {
    clearTimeout(timer);
  }
}

export const fxRateService = {
  async get(force = false): Promise<FxSnapshot> {
    if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
    try {
      const rate = await fetchLiveRate();
      const value: FxSnapshot = { rate, fetched_at: new Date().toISOString(), source: 'LIVE_API' };
      cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      const value: FxSnapshot = {
        rate: fallbackRate(),
        fetched_at: new Date().toISOString(),
        source: 'ENV_FALLBACK',
      };
      cache = { at: Date.now(), value };
      return value;
    }
  },
  clearCache() { cache = null; },
};

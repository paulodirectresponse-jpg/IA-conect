import { STUDIO_FALLBACK_MODELS } from '../../src/config/studioCatalog.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { pricingGuardService } from './pricingGuardService.js';
import { providerFinanceService } from './providerFinanceService.js';
import { fxRateService } from './fxRateService.js';
import { GenerationMode } from '../../src/types/index.js';

interface PricingHealthRow {
  key: string;
  provider_id: string;
  model_id: string;
  mode: GenerationMode;
  duration_seconds: number;
  resolution: string;
  provider_cost_usd: number | null;
  provider_cost_brl_cents: number | null;
  safe_cost_brl_cents: number | null;
  customer_price_cents: number | null;
  margin_percent: number | null;
  fx_rate: number;
  status: 'OK' | 'FAILED';
  checked_at: string;
  error?: string;
}

function canonicalMode(model: (typeof STUDIO_FALLBACK_MODELS)[number]): GenerationMode {
  if (model.category === 'IMAGE') return 'TEXT_TO_IMAGE';
  if (model.supported_modes.includes('TEXT_TO_VIDEO')) return 'TEXT_TO_VIDEO';
  return model.supported_modes[0] as GenerationMode;
}

function canonicalDuration(model: (typeof STUDIO_FALLBACK_MODELS)[number]) {
  if (model.category === 'IMAGE') return 1;
  if (model.supported_durations.includes(15)) return 15;
  return Math.max(...model.supported_durations);
}

function canonicalResolution(model: (typeof STUDIO_FALLBACK_MODELS)[number]) {
  if (model.category === 'IMAGE') {
    if (model.supported_resolutions.includes('2K')) return '2K';
    return model.supported_resolutions[0] || '1K';
  }
  if (model.supported_resolutions.includes('720p')) return '720p';
  return model.supported_resolutions[0] || '720p';
}

export const pricingSyncService = {
  async runHourlySync() {
    const checkedAt = new Date().toISOString();
    const [providers, mappings, fx] = await Promise.all([
      catalogRepository.listProviders(),
      catalogRepository.listMappings(),
      fxRateService.get(true),
      providerFinanceService.getAll(true).catch(() => []),
    ]).then(([providersRows, mappingRows, fxSnapshot]) => [providersRows, mappingRows, fxSnapshot] as const);

    const activeProviders = new Map(providers.filter((p) => p.status !== 'INACTIVE').map((p) => [p.provider_id, p]));
    const rows: PricingHealthRow[] = [];

    for (const model of STUDIO_FALLBACK_MODELS.filter((m) => m.status === 'ACTIVE')) {
      const mode = canonicalMode(model);
      const duration = canonicalDuration(model);
      const resolution = canonicalResolution(model);
      const mappedProviders = mappings.filter((m) => m.model_id === model.model_id && m.status === 'ACTIVE').map((m) => m.provider_id);

      // Seedance 2.0 WaveSpeed has a runtime mapping even when it is absent from Firestore.
      if (model.model_id === 'seedance-2-0' && !mappedProviders.includes('provider-wavespeed')) mappedProviders.push('provider-wavespeed');

      for (const providerId of Array.from(new Set(mappedProviders))) {
        const provider = activeProviders.get(providerId);
        const adapter = providerRegistry.getAdapter(providerId);
        if (!provider || !adapter || !adapter.isConfigured() || !adapter.supports(model.model_id, mode) || !adapter.quoteCostUsd) continue;
        const key = `${providerId}:${model.model_id}:${mode}:${resolution}:${duration}`;
        try {
          const quote = await pricingGuardService.quote(adapter, {
            userId: 'pricing-sync',
            model_id: model.model_id,
            mode,
            duration_seconds: duration,
            resolution,
            aspect_ratio: model.recommended_aspect_ratio || '16:9',
            number_of_outputs: 1,
          });
          rows.push({
            key,
            provider_id: providerId,
            model_id: model.model_id,
            mode,
            duration_seconds: duration,
            resolution,
            provider_cost_usd: quote.provider_cost_usd,
            provider_cost_brl_cents: quote.provider_cost_brl_cents,
            safe_cost_brl_cents: quote.safe_cost_brl_cents,
            customer_price_cents: quote.customer_price_cents,
            margin_percent: quote.effective_margin * 100,
            fx_rate: quote.fx_rate,
            status: 'OK',
            checked_at: checkedAt,
          });
        } catch (err: any) {
          rows.push({
            key,
            provider_id: providerId,
            model_id: model.model_id,
            mode,
            duration_seconds: duration,
            resolution,
            provider_cost_usd: null,
            provider_cost_brl_cents: null,
            safe_cost_brl_cents: null,
            customer_price_cents: null,
            margin_percent: null,
            fx_rate: fx.rate,
            status: 'FAILED',
            checked_at: checkedAt,
            error: err?.message || 'Falha na verificação de preço.',
          });
        }
      }
    }

    const db = getAdminDb();
    if (db) {
      const batch = db.batch();
      for (const row of rows) {
        batch.set(db.collection('pricing_health').doc(row.key.replace(/[^a-zA-Z0-9:_-]/g, '_')), row, { merge: true });
      }
      batch.set(db.collection('system_state').doc('pricing_sync'), {
        last_run_at: checkedAt,
        fx_rate: fx.rate,
        fx_source: fx.source,
        checked: rows.length,
        healthy: rows.filter((r) => r.status === 'OK').length,
        failed: rows.filter((r) => r.status === 'FAILED').length,
      }, { merge: true });
      await batch.commit().catch((err: any) => console.warn('[PricingSyncPersist]', err?.message || err));
    }

    return {
      checked_at: checkedAt,
      fx_rate: fx.rate,
      fx_source: fx.source,
      checked: rows.length,
      healthy: rows.filter((r) => r.status === 'OK').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
      rows,
    };
  },
};

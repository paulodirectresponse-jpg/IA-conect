import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { RoutingLogEntry, ProviderStatus } from '../../src/types/index.js';

export interface RouteSelectionParams {
  userId: string;
  modelId: string;
  resolution: string;
  durationSeconds: number;
  requestedProviderId?: string;
  strategy?: 'CHEAPEST_RELIABLE' | 'FASTEST';
  generationId?: string;
}

export interface CandidateRoute {
  provider_id: string;
  provider_name: string;
  provider_cost_cents: number;
  customer_price_cents: number;
  status: ProviderStatus;
  priority: number;
  is_healthy: boolean;
  pricing_id: string;
}

export interface RouteDecision {
  selected_provider_id: string;
  provider_name: string;
  customer_price_cents: number;
  provider_cost_cents: number;
  fallback_provider_ids: string[];
  all_candidates: CandidateRoute[];
  routing_log_id: string;
  strategy: string;
}

const routingLogsCache: RoutingLogEntry[] = [];

export const smartRouterService = {
  async selectBestRoute(params: RouteSelectionParams): Promise<RouteDecision> {
    const {
      userId,
      modelId,
      resolution,
      durationSeconds,
      requestedProviderId,
      strategy = 'CHEAPEST_RELIABLE',
      generationId,
    } = params;

    const [allProviders, allMappings, allPricing] = await Promise.all([
      catalogRepository.listProviders(),
      catalogRepository.listMappings(),
      catalogRepository.listPricing(),
    ]);

    // 1. Find all active mappings for this model
    const relevantMappings = allMappings.filter(
      (m) => m.model_id === modelId && m.status === 'ACTIVE'
    );

    if (relevantMappings.length === 0) {
      throw new Error(`Nenhum provedor mapeado e ativo para o modelo '${modelId}'.`);
    }

    // 2. Build candidates list with health, pricing, and adapter availability
    const candidateRoutes: CandidateRoute[] = [];

    for (const mapping of relevantMappings) {
      const provider = allProviders.find((p) => p.provider_id === mapping.provider_id);
      if (!provider || provider.status === 'INACTIVE') {
        continue;
      }

      // Check adapter availability
      const adapter = providerRegistry.getAdapter(provider.provider_id);
      if (!adapter) {
        continue;
      }

      // Find matching active pricing
      const matchingPricing = allPricing.find(
        (pr) =>
          pr.active &&
          pr.model_id === modelId &&
          pr.provider_id === provider.provider_id &&
          pr.resolution === resolution
      ) || allPricing.find(
        (pr) =>
          pr.active &&
          pr.model_id === modelId &&
          pr.provider_id === provider.provider_id
      );

      if (!matchingPricing) {
        continue;
      }

      const durationMultiplier = durationSeconds > 5 ? durationSeconds / 5 : 1;
      const calculatedCustomerPrice = Math.round(matchingPricing.customer_price_cents * durationMultiplier);
      const calculatedProviderCost = Math.round(matchingPricing.provider_cost_cents * durationMultiplier);

      candidateRoutes.push({
        provider_id: provider.provider_id,
        provider_name: provider.name,
        provider_cost_cents: calculatedProviderCost,
        customer_price_cents: calculatedCustomerPrice,
        status: provider.status,
        priority: mapping.priority || provider.priority || 50,
        is_healthy: provider.status === 'ACTIVE',
        pricing_id: matchingPricing.pricing_id,
      });
    }

    if (candidateRoutes.length === 0) {
      throw new Error(`Nenhuma rota viável encontrada para o modelo '${modelId}' e resolução '${resolution}'.`);
    }

    // 3. If explicit provider requested and candidate is present, prioritize it
    let sortedCandidates = [...candidateRoutes];

    if (requestedProviderId) {
      const explicit = sortedCandidates.find((c) => c.provider_id === requestedProviderId);
      if (explicit) {
        sortedCandidates = [
          explicit,
          ...sortedCandidates.filter((c) => c.provider_id !== requestedProviderId),
        ];
      }
    } else {
      // Apply CHEAPEST_RELIABLE strategy:
      // Sort by healthy first, then lowest customer price, then highest priority
      sortedCandidates.sort((a, b) => {
        if (a.is_healthy !== b.is_healthy) {
          return a.is_healthy ? -1 : 1;
        }
        if (a.customer_price_cents !== b.customer_price_cents) {
          return a.customer_price_cents - b.customer_price_cents;
        }
        return b.priority - a.priority;
      });
    }

    const selected = sortedCandidates[0];
    const fallbacks = sortedCandidates.slice(1).map((c) => c.provider_id);

    // 4. Record routing decision log
    const logId = `route_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const logEntry: RoutingLogEntry = {
      log_id: logId,
      generation_id: generationId,
      user_id: userId,
      model_id: modelId,
      selected_provider_id: selected.provider_id,
      strategy,
      candidate_providers: sortedCandidates.map((c) => ({
        provider_id: c.provider_id,
        provider_cost_cents: c.provider_cost_cents,
        customer_price_cents: c.customer_price_cents,
        status: c.status,
        priority: c.priority,
        is_healthy: c.is_healthy,
      })),
      reason: requestedProviderId
        ? `Provedor explicitamente solicitado (${selected.provider_name})`
        : `Menor custo disponível (R$ ${(selected.customer_price_cents / 100).toFixed(2)}) com provedor saudável`,
      created_at: new Date().toISOString(),
    };

    routingLogsCache.unshift(logEntry);
    if (routingLogsCache.length > 500) {
      routingLogsCache.pop();
    }

    // Fire-and-forget persist to Firestore
    try {
      const db = getAdminDb();
      if (db) {
        db.collection('routing_logs').doc(logId).set(logEntry).catch(() => {});
      }
    } catch {
      // Non-blocking
    }

    return {
      selected_provider_id: selected.provider_id,
      provider_name: selected.provider_name,
      customer_price_cents: selected.customer_price_cents,
      provider_cost_cents: selected.provider_cost_cents,
      fallback_provider_ids: fallbacks,
      all_candidates: sortedCandidates,
      routing_log_id: logId,
      strategy,
    };
  },

  async listRoutingLogs(limit = 50): Promise<RoutingLogEntry[]> {
    return routingLogsCache.slice(0, limit);
  },
};

import type { ProviderFinanceSnapshot } from "../services/providerFinanceService.js";

export const OFFICIAL_ROUTING_PROVIDER_IDS = new Set([
  "provider-wavespeed",
  "provider-atlas",
  "provider-runware",
]);

export interface FundableRoutePreview {
  route: {
    route_id: string;
    provider_id: string;
    priority?: number;
    pricing_snapshot?: { fx_rate_usd_brl?: number } | null;
  };
  provider_cost: number;
  provider_currency: "USD" | "BRL";
  safe_cogs_brl: number;
}

export interface FundedRouteSelection<T extends FundableRoutePreview> {
  selected: T | null;
  eligible: T[];
  excluded: Array<{ route_id: string; provider_id: string; reason: string }>;
}

function providerCostUsd(preview: FundableRoutePreview): number {
  if (preview.provider_currency === "USD") return preview.provider_cost;
  const fx = Number(preview.route.pricing_snapshot?.fx_rate_usd_brl);
  return Number.isFinite(fx) && fx > 0 ? preview.provider_cost / fx : Number.POSITIVE_INFINITY;
}

/**
 * Picks the cheapest READY route that is both official and covers this
 * request's quoted provider cost with the provider's reported live balance.
 * Unknown balance data does not block a route; a reported zero/insufficient
 * balance does.
 */
export function selectFundedRoutePreview<T extends FundableRoutePreview>(
  previews: T[],
  snapshots: ProviderFinanceSnapshot[],
): FundedRouteSelection<T> {
  const byProvider = new Map(snapshots.map((snapshot) => [snapshot.provider_id, snapshot]));
  const eligible: T[] = [];
  const excluded: FundedRouteSelection<T>["excluded"] = [];

  for (const preview of previews) {
    const { route } = preview;
    if (!OFFICIAL_ROUTING_PROVIDER_IDS.has(route.provider_id)) {
      excluded.push({ route_id: route.route_id, provider_id: route.provider_id, reason: "PROVIDER_NOT_OFFICIAL" });
      continue;
    }

    const snapshot = byProvider.get(route.provider_id);
    if (snapshot?.configured === false) {
      excluded.push({ route_id: route.route_id, provider_id: route.provider_id, reason: "PROVIDER_NOT_CONFIGURED" });
      continue;
    }

    const balance = Number(snapshot?.balance_usd);
    if (snapshot?.source === "LIVE_API" && Number.isFinite(balance) && balance >= 0) {
      const required = providerCostUsd(preview);
      if (!Number.isFinite(required) || balance + 1e-9 < required) {
        excluded.push({ route_id: route.route_id, provider_id: route.provider_id, reason: "PROVIDER_BALANCE_INSUFFICIENT" });
        continue;
      }
    }

    eligible.push(preview);
  }

  eligible.sort(
    (a, b) => a.safe_cogs_brl - b.safe_cogs_brl ||
      Number(b.route.priority || 0) - Number(a.route.priority || 0) ||
      a.route.route_id.localeCompare(b.route.route_id),
  );

  return { selected: eligible[0] || null, eligible, excluded };
}

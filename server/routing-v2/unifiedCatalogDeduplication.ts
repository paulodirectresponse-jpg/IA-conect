export interface UnifiedCatalogBinding {
  provider_id: string;
  provider_model_identifier: string;
  provider_name?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UnifiedCatalogRow {
  catalog_key: string;
  name: string;
  category: string;
  capabilities?: string[];
  providers?: UnifiedCatalogBinding[];
  _unified_search_score?: number;
  [key: string]: unknown;
}

function normalizeDisplayIdentity(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/([a-z])(?=\d)/g, "$1 ")
    .replace(/(\d+)\.0\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeBindings(left: UnifiedCatalogBinding[], right: UnifiedCatalogBinding[]) {
  const bindings = new Map<string, UnifiedCatalogBinding>();
  for (const binding of [...left, ...right]) {
    const providerId = String(binding?.provider_id || "").trim().toLowerCase();
    const identifier = String(binding?.provider_model_identifier || "").trim().toLowerCase();
    if (!providerId || !identifier) continue;
    const key = `${providerId}|${identifier}`;
    const previous = bindings.get(key);
    if (!previous) {
      bindings.set(key, { ...binding, capabilities: Array.from(new Set(binding.capabilities || [])) });
      continue;
    }
    bindings.set(key, {
      ...previous,
      ...binding,
      provider_name: previous.provider_name || binding.provider_name,
      capabilities: Array.from(new Set([...(previous.capabilities || []), ...(binding.capabilities || [])])),
      metadata: { ...(previous.metadata || {}), ...(binding.metadata || {}) },
    });
  }
  return Array.from(bindings.values());
}

/**
 * Collapse distinct provider IDs that resolve to the same displayed model.
 * Meaningful variants stay separate because their names retain words like
 * Fast, Mini, Lite, or Pro after provider-specific endpoint cleanup.
 */
export function mergeUnifiedCatalogDuplicates<T extends UnifiedCatalogRow>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const nameIdentity = normalizeDisplayIdentity(row.name);
    const categoryIdentity = normalizeDisplayIdentity(row.category) || "other";
    const identity = nameIdentity ? `${categoryIdentity}|${nameIdentity}` : `key|${row.catalog_key}`;
    const candidates = groups.get(identity) || [];
    const vendorIdentity = normalizeDisplayIdentity(typeof row.vendor === "string" ? row.vendor : "");
    const previousIndex = candidates.findIndex((candidate) => {
      const candidateVendor = normalizeDisplayIdentity(typeof candidate.vendor === "string" ? candidate.vendor : "");
      return !vendorIdentity || !candidateVendor || vendorIdentity === candidateVendor;
    });
    const previous = previousIndex >= 0 ? candidates[previousIndex] : undefined;
    if (!previous) {
      candidates.push({
        ...row,
        capabilities: Array.from(new Set(row.capabilities || [])),
        providers: mergeBindings([], row.providers || []),
      });
      groups.set(identity, candidates);
      continue;
    }
    candidates[previousIndex] = {
      ...previous,
      vendor: previous.vendor || row.vendor,
      capabilities: Array.from(new Set([...(previous.capabilities || []), ...(row.capabilities || [])])),
      providers: mergeBindings(previous.providers || [], row.providers || []),
      _unified_search_score: Math.max(previous._unified_search_score || 0, row._unified_search_score || 0),
    };
    groups.set(identity, candidates);
  }
  const mergedRows = Array.from(groups.values()).flat();
  return { rows: mergedRows, merged_count: rows.length - mergedRows.length };
}

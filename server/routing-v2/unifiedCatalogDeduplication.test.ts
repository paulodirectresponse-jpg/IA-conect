import { describe, expect, it } from "vitest";
import { mergeUnifiedCatalogDuplicates } from "./unifiedCatalogDeduplication.js";

describe("unified catalog duplicate consolidation", () => {
  it("merges the same model from different provider IDs and unions its capabilities", () => {
    const result = mergeUnifiedCatalogDuplicates([
      {
        catalog_key: "video:seedance-2-mini",
        name: "Seedance 2 Mini",
        category: "VIDEO",
        capabilities: ["text-to-video"],
        providers: [{
          provider_id: "provider-wavespeed",
          provider_name: "WaveSpeed AI",
          provider_model_identifier: "bytedance/seedance-2-mini/text-to-video",
          capabilities: ["text-to-video"],
        }],
        _unified_search_score: 8,
      },
      {
        catalog_key: "seedance-mini-air-id",
        name: "Seedance 2 Mini",
        category: "VIDEO",
        capabilities: ["image-to-video"],
        providers: [{
          provider_id: "provider-runware",
          provider_name: "Runware",
          provider_model_identifier: "bytedance:seedance-2-mini@1",
          capabilities: ["image-to-video"],
        }],
        _unified_search_score: 4,
      },
    ]);

    expect(result.merged_count).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].capabilities).toEqual(["text-to-video", "image-to-video"]);
    expect(result.rows[0].providers.map((provider) => provider.provider_id)).toEqual([
      "provider-wavespeed",
      "provider-runware",
    ]);
    expect(result.rows[0]._unified_search_score).toBe(8);
  });

  it("normalizes trailing zero versions while keeping named model variants distinct", () => {
    const rows = mergeUnifiedCatalogDuplicates([
      { catalog_key: "seedance-2-0", name: "Seedance 2.0", category: "VIDEO", providers: [] },
      { catalog_key: "seedance-2", name: "Seedance 2", category: "VIDEO", providers: [] },
      { catalog_key: "seedance-2-fast", name: "Seedance 2 Fast", category: "VIDEO", providers: [] },
      { catalog_key: "seedance-2-mini", name: "Seedance 2 Mini", category: "VIDEO", providers: [] },
    ]);

    expect(rows.merged_count).toBe(1);
    expect(rows.rows.map((row) => row.name)).toEqual([
      "Seedance 2.0",
      "Seedance 2 Fast",
      "Seedance 2 Mini",
    ]);
  });

  it("keeps same-named models from different model vendors separate", () => {
    const rows = mergeUnifiedCatalogDuplicates([
      { catalog_key: "video:alpha", name: "Video 1", vendor: "Studio Alpha", category: "VIDEO", providers: [] },
      { catalog_key: "video:beta", name: "Video 1", vendor: "Studio Beta", category: "VIDEO", providers: [] },
    ]);

    expect(rows.rows).toHaveLength(2);
    expect(rows.merged_count).toBe(0);
  });

  it("deduplicates repeated bindings from the same provider without dropping metadata", () => {
    const rows = mergeUnifiedCatalogDuplicates([
      {
        catalog_key: "seedance-2-mini-a",
        name: "Seedance 2 Mini",
        category: "VIDEO",
        providers: [{
          provider_id: "provider-atlas",
          provider_name: "Atlas Cloud",
          provider_model_identifier: "bytedance/seedance-2-mini/text-to-video",
          capabilities: ["text-to-video"],
          metadata: { source: "catalog" },
        }],
      },
      {
        catalog_key: "seedance-2-mini-b",
        name: "Seedance 2 Mini",
        category: "VIDEO",
        providers: [{
          provider_id: "provider-atlas",
          provider_name: "Atlas Cloud",
          provider_model_identifier: "bytedance/seedance-2-mini/text-to-video",
          capabilities: ["image-to-video"],
          metadata: { task: "image-to-video" },
        }],
      },
    ]);

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].providers).toHaveLength(1);
    expect(rows.rows[0].providers[0]).toMatchObject({
      capabilities: ["text-to-video", "image-to-video"],
      metadata: { source: "catalog", task: "image-to-video" },
    });
  });
});

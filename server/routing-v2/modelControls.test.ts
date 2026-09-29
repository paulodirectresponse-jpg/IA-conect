import { describe, expect, it } from "vitest";
import {
  getEffectiveSupportedControls,
  withEffectiveModelControls,
} from "./modelControls.js";
import { validateModelCompatibility } from "./modelCompatibilityService.js";

describe("verified controls for active video catalog models", () => {
  it("provides selectable controls for every active video model ID", () => {
    const modelIds = [
      "seedance-2-5",
      "seedance-2",
      "seedance-2-fast",
      "seedance-2-mini",
      "veo3-1",
      "veo3-1-fast",
      "veo-3-1-lite",
      "gemini-omni-flash",
    ];

    for (const modelId of modelIds) {
      const controls = getEffectiveSupportedControls(modelId);
      expect(controls.supported_durations, modelId).toEqual(
        expect.arrayContaining([expect.any(Number)]),
      );
      expect(controls.supported_resolutions, modelId).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
      expect(controls.supported_aspect_ratios, modelId).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
    }
  });

  it("fills empty persisted controls from the verified model contract", () => {
    const model = withEffectiveModelControls({
      model_id: "seedance-2-5",
      name: "Seedance 2.5",
      slug: "seedance-2-5",
      vendor: "ByteDance",
      category: "VIDEO",
      description: "",
      capabilities: ["text-to-video"],
      supported_controls: { supported_durations: [], supported_resolutions: [] },
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(model.supported_controls?.supported_durations).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 4),
    );
    expect(model.supported_controls?.supported_resolutions).toEqual([
      "480p",
      "720p",
      "1080p",
      "4k",
    ]);
  });

  it("keeps a non-empty admin override and validates the same values on the server", () => {
    const controls = getEffectiveSupportedControls("veo3-1", {
      supported_durations: [8],
    });

    expect(controls.supported_durations).toEqual([8]);
    expect(
      validateModelCompatibility(controls, {
        capability_id: "text-to-video",
        duration_seconds: 8,
        dimensions: { resolution: "720p", aspect_ratio: "16:9" },
      }).valid,
    ).toBe(true);
    expect(
      validateModelCompatibility(controls, {
        capability_id: "text-to-video",
        duration_seconds: 5,
        dimensions: { resolution: "720p", aspect_ratio: "16:9" },
      }).valid,
    ).toBe(false);
  });

  it("does not invent settings for an unknown model", () => {
    expect(
      getEffectiveSupportedControls("new-unverified-video-model", {
        supported_durations: [],
      }),
    ).toEqual({ supported_durations: [] });
  });

  it("normalizes known legacy names to their verified canonical contracts", () => {
    expect(
      getEffectiveSupportedControls("veo-3-1-lite").supported_durations,
    ).toEqual([4, 6, 8]);
    expect(
      getEffectiveSupportedControls("seedance-2-0").supported_durations,
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 4));
  });
});

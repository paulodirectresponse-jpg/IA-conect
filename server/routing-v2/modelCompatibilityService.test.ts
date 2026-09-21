import { describe, expect, it } from "vitest";
import {
  isModelCompatibleWithRequirements,
  validateModelCompatibility,
} from "./modelCompatibilityService.js";

const baseControls = {
  supported_resolutions: ["1080p"],
  supported_aspect_ratios: ["16:9"],
  supported_durations: [5, 10],
  supports_negative_prompt: true,
  supports_image_reference: true,
  supports_video_reference: true,
  supports_audio_reference: false,
  supports_multiple_images: false,
  supports_start_end_image: true,
  max_reference_images: 2,
  max_reference_videos: 1,
  max_reference_audio: 0,
  max_outputs: 1,
  max_prompt_length: 1000,
};

describe("Routing V2 backend compatibility authority", () => {
  it("rejects undeclared operational controls", () => {
    expect(
      isModelCompatibleWithRequirements(baseControls, {
        capability_id: "text-to-video",
        duration_seconds: 5,
        dimensions: { resolution: "4K", aspect_ratio: "16:9" },
      }),
    ).toBe(false);
  });

  it("rejects unsupported negative prompt instead of silently accepting it", () => {
    const result = validateModelCompatibility(
      { ...baseControls, supports_negative_prompt: false },
      {
        capability_id: "text-to-video",
        duration_seconds: 5,
        negative_prompt_present: true,
        dimensions: { resolution: "1080p", aspect_ratio: "16:9" },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Negative prompt/);
  });

  it("does not count an inpaint mask as an ordinary image reference", () => {
    const result = validateModelCompatibility(
      { ...baseControls, max_reference_images: 1 },
      {
        capability_id: "inpaint-mask",
        reference_types: ["IMAGE", "IMAGE"],
        reference_roles: ["SOURCE", "MASK"],
      },
    );
    expect(result.valid).toBe(true);
  });

  it("rejects mixing frame workflow with a general image reference", () => {
    const result = validateModelCompatibility(baseControls, {
      capability_id: "last-frame",
      duration_seconds: 5,
      reference_types: ["IMAGE", "IMAGE"],
      reference_roles: ["INITIAL", "REFERENCE"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Frames inicial\/final/);
  });

  it("rejects multiple outputs unless max_outputs proves support", () => {
    expect(
      isModelCompatibleWithRequirements(baseControls, {
        capability_id: "text-to-image",
        number_of_outputs: 2,
      }),
    ).toBe(false);
  });
});

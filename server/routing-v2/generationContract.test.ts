import { describe, expect, it } from "vitest";
import {
  capabilityUsesDuration,
  generationModeForCapability,
  positiveOptionalInteger,
  resolveGenerationCapability,
} from "./generationContract.js";

describe("Routing V2 universal generation contract", () => {
  it("maps capability to legacy-compatible generation mode explicitly", () => {
    expect(generationModeForCapability("text-to-image")).toBe("TEXT_TO_IMAGE");
    expect(generationModeForCapability("music")).toBe("TEXT_TO_AUDIO");
    expect(generationModeForCapability("video-edit")).toBe("VIDEO_TO_VIDEO");
    expect(generationModeForCapability("image-edit")).toBe("IMAGE_TO_IMAGE");
  });

  it("requires explicit capability when a legacy mode is ambiguous", () => {
    expect(() => resolveGenerationCapability({ mode: "TEXT_TO_AUDIO" })).toThrow(
      /Capability explícita/,
    );
    expect(resolveGenerationCapability({ mode: "TEXT_TO_SPEECH" })).toBe(
      "text-to-speech",
    );
  });

  it("never treats image capability as duration based", () => {
    expect(capabilityUsesDuration("text-to-image")).toBe(false);
    expect(capabilityUsesDuration("image-to-image")).toBe(false);
    expect(capabilityUsesDuration("image-edit")).toBe(false);
    expect(capabilityUsesDuration("text-to-video")).toBe(true);
    expect(capabilityUsesDuration("music")).toBe(true);
  });

  it("accepts only positive integer duration values", () => {
    expect(positiveOptionalInteger(undefined)).toBeUndefined();
    expect(positiveOptionalInteger(0)).toBeUndefined();
    expect(positiveOptionalInteger(1.5)).toBeUndefined();
    expect(positiveOptionalInteger(5)).toBe(5);
  });
});

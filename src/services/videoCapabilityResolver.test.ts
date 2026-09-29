import { describe, expect, it } from "vitest";
import { resolveVideoCapability } from "./videoCapabilityResolver.js";

describe("resolveVideoCapability", () => {
  it("prefers the normal image-to-video route for a single starting image", () => {
    expect(
      resolveVideoCapability("IMAGE_TO_VIDEO", true, false, [
        "text-to-video",
        "image-to-video",
        "first-frame",
      ]),
    ).toBe("image-to-video");
  });

  it("uses the last-frame route only when an end image is supplied", () => {
    expect(
      resolveVideoCapability("IMAGE_TO_VIDEO", true, true, [
        "image-to-video",
        "first-frame",
        "last-frame",
      ]),
    ).toBe("last-frame");
  });

  it("falls back to first-frame when that is the only ready image route", () => {
    expect(
      resolveVideoCapability("IMAGE_TO_VIDEO", true, false, ["first-frame"]),
    ).toBe("first-frame");
  });

  it("keeps video editing on the video-edit route when available", () => {
    expect(
      resolveVideoCapability("VIDEO_TO_VIDEO", false, false, [
        "video-extend",
        "video-edit",
      ]),
    ).toBe("video-edit");
  });
});

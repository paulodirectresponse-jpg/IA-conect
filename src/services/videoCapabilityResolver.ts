import type { GenerationMode } from "../types/index.js";

/**
 * Select the route capability that matches the input workflow. Keep this
 * deterministic: quote, compatibility filtering, and submission must use the
 * same capability rather than inferring it again at different stages.
 */
export function resolveVideoCapability(
  mode: GenerationMode | string,
  hasInitial: boolean,
  hasEnd: boolean,
  availableCapabilities: readonly string[] = [],
): string {
  const ready = new Set(availableCapabilities);

  if (mode === "VIDEO_TO_VIDEO") {
    if (ready.has("video-edit")) return "video-edit";
    if (ready.has("video-extend")) return "video-extend";
    return "video-edit";
  }

  if (mode === "IMAGE_TO_VIDEO") {
    if (hasInitial && hasEnd && ready.has("last-frame")) return "last-frame";
    if (ready.has("image-to-video")) return "image-to-video";
    if (hasInitial && ready.has("first-frame")) return "first-frame";
    if (ready.has("last-frame")) return "last-frame";
    return "image-to-video";
  }

  if (mode === "REFERENCE_TO_VIDEO") {
    if (ready.has("reference-to-video")) return "reference-to-video";
    if (ready.has("image-to-video")) return "image-to-video";
    if (ready.has("video-edit")) return "video-edit";
    return "reference-to-video";
  }

  return "text-to-video";
}

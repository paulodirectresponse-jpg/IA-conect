import type { RoutingV2Model } from "./domain.js";

type SupportedControls = Record<string, unknown>;

const range = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const WIDE_VIDEO_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"];
const PORTRAIT_LANDSCAPE = ["16:9", "9:16"];

/**
 * Control metadata verified against official WaveSpeed AI / Atlas Cloud API
 * documentation for the provider model families used by the active catalog.
 * The UI and server validation must consume the same values; unknown models do
 * not receive guessed controls and remain visible as unconfigured diagnostics.
 */
const VERIFIED_VIDEO_CONTROLS: Record<string, SupportedControls> = {
  // https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2-5-text-to-video
  "seedance-2-5": {
    supported_durations: range(4, 30),
    supported_resolutions: ["480p", "720p", "1080p", "4k"],
    supported_aspect_ratios: WIDE_VIDEO_RATIOS,
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_seed: true,
    supports_start_end_image: true,
    max_reference_images: 30,
    max_reference_videos: 10,
    max_reference_audio: 10,
    max_prompt_length: 20_000,
  },
  // https://www.atlascloud.ai/docs/ja/more-models/bytedance/seedance-2.0-text-to-video/generateVideo
  "seedance-2": {
    supported_durations: range(4, 15),
    supported_resolutions: ["480p", "720p", "720p-SR", "1080p", "1080p-SR", "1440p-SR", "4k"],
    supported_aspect_ratios: WIDE_VIDEO_RATIOS,
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_seed: true,
    supports_start_end_image: true,
    max_reference_images: 9,
    max_reference_videos: 3,
    max_reference_audio: 3,
    max_prompt_length: 20_000,
  },
  // https://www.atlascloud.ai/models/bytedance/seedance-2.0-fast/text-to-video
  "seedance-2-fast": {
    supported_durations: range(4, 15),
    supported_resolutions: ["480p", "720p", "720p-SR", "1080p-SR", "1440p-SR"],
    supported_aspect_ratios: WIDE_VIDEO_RATIOS,
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_seed: true,
    max_reference_images: 9,
    max_reference_videos: 3,
    max_reference_audio: 3,
    max_prompt_length: 20_000,
  },
  // https://www.atlascloud.ai/docs/more-models/bytedance/seedance-2.0-mini-text-to-video/generateVideo
  "seedance-2-mini": {
    supported_durations: range(4, 15),
    supported_resolutions: ["480p", "720p", "720p-SR", "1080p-SR", "1440p-SR"],
    supported_aspect_ratios: WIDE_VIDEO_RATIOS,
    supports_image_reference: true,
    supports_multiple_images: true,
    supports_video_reference: true,
    supports_audio_reference: true,
    supports_seed: true,
    max_reference_images: 9,
    max_reference_videos: 3,
    max_reference_audio: 3,
    max_prompt_length: 20_000,
  },
  // https://www.atlascloud.ai/docs/more-models/google/veo3.1-text-to-video/generateVideo
  "veo3-1": {
    supported_durations: [4, 6, 8],
    supported_resolutions: ["720p", "1080p", "4k"],
    supported_aspect_ratios: PORTRAIT_LANDSCAPE,
    supports_image_reference: true,
    supports_negative_prompt: true,
    supports_seed: true,
    supports_start_end_image: true,
    max_reference_images: 2,
    max_prompt_length: 12_000,
  },
  // https://www.atlascloud.ai/docs/en/more-models/google/veo3.1-fast-text-to-video/generateVideo
  "veo3-1-fast": {
    supported_durations: [4, 6, 8],
    supported_resolutions: ["720p", "1080p", "4k"],
    supported_aspect_ratios: PORTRAIT_LANDSCAPE,
    supports_image_reference: true,
    supports_negative_prompt: true,
    supports_seed: true,
    supports_start_end_image: true,
    max_reference_images: 2,
    max_prompt_length: 12_000,
  },
  // https://www.atlascloud.ai/docs/more-models/google/veo3.1-lite-text-to-video/generateVideo
  "veo-3-1-lite": {
    supported_durations: [4, 6, 8],
    supported_resolutions: ["720p", "1080p"],
    supported_aspect_ratios: PORTRAIT_LANDSCAPE,
    supports_image_reference: true,
    supports_seed: true,
    supports_start_end_image: true,
    max_reference_images: 2,
    max_prompt_length: 12_000,
  },
  // https://www.atlascloud.ai/docs/more-models/google/gemini-omni-flash-text-to-video/generateVideo
  "gemini-omni-flash": {
    supported_durations: range(3, 10),
    supported_resolutions: ["720p"],
    supported_aspect_ratios: PORTRAIT_LANDSCAPE,
    supports_image_reference: true,
    supports_video_reference: true,
    supports_seed: true,
    max_reference_images: 1,
    max_reference_videos: 1,
    max_prompt_length: 20_000,
  },
};

const MODEL_ID_ALIASES: Record<string, string> = {
  "seedance-2-0": "seedance-2",
  "veo-3-1": "veo3-1",
  "veo-3-1-fast": "veo3-1-fast",
  "google-omni-flash": "gemini-omni-flash",
};

const ARRAY_CONTROL_KEYS = [
  "supported_durations",
  "supported_resolutions",
  "supported_aspect_ratios",
] as const;

function effectiveControlSet(modelId: string, persisted: SupportedControls = {}) {
  const canonicalId = MODEL_ID_ALIASES[modelId] || modelId;
  const verified = VERIFIED_VIDEO_CONTROLS[canonicalId] || {};
  const controls: SupportedControls = { ...verified, ...persisted };

  // Older Admin-created V2 model rows contain empty arrays. Treat those as
  // missing metadata; a non-empty administrator override remains authoritative.
  for (const key of ARRAY_CONTROL_KEYS) {
    const saved = persisted[key];
    if (!Array.isArray(saved) || saved.length === 0) {
      if (Array.isArray(verified[key])) controls[key] = verified[key];
    }
  }

  return controls;
}

export function withEffectiveModelControls<T extends RoutingV2Model>(model: T): T {
  return {
    ...model,
    supported_controls: effectiveControlSet(model.model_id, model.supported_controls),
  };
}

export function getEffectiveSupportedControls(
  modelId: string,
  persisted: SupportedControls = {},
) {
  return effectiveControlSet(modelId, persisted);
}

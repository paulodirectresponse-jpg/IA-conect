import type { GenerationMode } from "../../src/types/index.js";
import { isCapabilityId, type CapabilityId } from "../beta/capabilityRegistry.js";

const MODE_BY_CAPABILITY: Record<CapabilityId, GenerationMode> = {
  "text-to-image": "TEXT_TO_IMAGE",
  "image-to-image": "IMAGE_TO_IMAGE",
  "image-edit": "IMAGE_TO_IMAGE",
  "inpaint-mask": "IMAGE_TO_IMAGE",
  "background-remove-replace": "IMAGE_TO_IMAGE",
  "outpaint": "IMAGE_TO_IMAGE",
  "upscale": "IMAGE_TO_IMAGE",
  "variations": "IMAGE_TO_IMAGE",
  "text-to-video": "TEXT_TO_VIDEO",
  "image-to-video": "IMAGE_TO_VIDEO",
  "first-frame": "IMAGE_TO_VIDEO",
  "last-frame": "IMAGE_TO_VIDEO",
  "video-extend": "VIDEO_TO_VIDEO",
  "video-edit": "VIDEO_TO_VIDEO",
  "text-to-speech": "TEXT_TO_SPEECH",
  "sound-effects": "TEXT_TO_AUDIO",
  "music": "TEXT_TO_AUDIO",
  "transcription": "AUDIO_TO_TEXT",
  "subtitles": "MEDIA_TO_TEXT",
  "authorized-voice-clone": "AUDIO_TO_AUDIO",
  "dubbing": "MEDIA_DUBBING",
  "text-to-3d": "TEXT_TO_3D",
  "image-to-3d": "IMAGE_TO_3D",
  "multi-image-to-3d": "MULTI_IMAGE_TO_3D",
  "texture-3d": "TEXT_TO_3D",
};

const UNAMBIGUOUS_CAPABILITY_BY_MODE: Partial<Record<GenerationMode, CapabilityId>> = {
  TEXT_TO_IMAGE: "text-to-image",
  IMAGE_TO_IMAGE: "image-to-image",
  TEXT_TO_VIDEO: "text-to-video",
  IMAGE_TO_VIDEO: "image-to-video",
  VIDEO_TO_VIDEO: "video-edit",
  TEXT_TO_SPEECH: "text-to-speech",
  AUDIO_TO_TEXT: "transcription",
  MEDIA_TO_TEXT: "subtitles",
  MEDIA_DUBBING: "dubbing",
  TEXT_TO_3D: "text-to-3d",
  IMAGE_TO_3D: "image-to-3d",
  MULTI_IMAGE_TO_3D: "multi-image-to-3d",
};

const DURATION_CAPABILITIES = new Set<CapabilityId>([
  "text-to-video",
  "image-to-video",
  "first-frame",
  "last-frame",
  "video-extend",
  "video-edit",
  "sound-effects",
  "music",
]);

export function generationModeForCapability(capabilityId: CapabilityId): GenerationMode {
  return MODE_BY_CAPABILITY[capabilityId];
}

export function capabilityUsesDuration(capabilityId: CapabilityId): boolean {
  return DURATION_CAPABILITIES.has(capabilityId);
}

export function resolveGenerationCapability(input: {
  capability_id?: unknown;
  mode?: unknown;
}): CapabilityId {
  const explicit = String(input.capability_id || "").trim();
  if (explicit) {
    if (!isCapabilityId(explicit)) {
      throw Object.assign(new Error("Capability inválida."), {
        code: "VALIDATION_ERROR",
      });
    }
    return explicit;
  }

  const mode = String(input.mode || "").trim() as GenerationMode;
  const inferred = UNAMBIGUOUS_CAPABILITY_BY_MODE[mode];
  if (!inferred) {
    throw Object.assign(
      new Error("Capability explícita é obrigatória para esta geração."),
      { code: "VALIDATION_ERROR" },
    );
  }
  return inferred;
}

export function positiveOptionalInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

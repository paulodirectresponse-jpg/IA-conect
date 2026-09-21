import type { ModelRegistryItem } from "../types/index.js";
import { universalGenerationClient } from "./universalGenerationClient.js";

export type UniversalEditorCapability =
  | "image-edit"
  | "inpaint-mask"
  | "background-remove-replace"
  | "outpaint"
  | "upscale"
  | "variations"
  | "video-extend"
  | "video-edit";

export interface UniversalEditorCapabilityView {
  id: UniversalEditorCapability;
  controls: string[];
  supported_durations: number[];
  supported_resolutions: string[];
  supported_aspect_ratios: string[];
}

export interface UniversalEditorModelView extends ModelRegistryItem {
  editor_capabilities: UniversalEditorCapabilityView[];
}

function capabilityView(
  model: ModelRegistryItem,
  id: UniversalEditorCapability,
): UniversalEditorCapabilityView {
  const controls = model.supported_controls || {};
  const declared: string[] = [];
  const arr = (key: string) =>
    Array.isArray(controls[key]) ? (controls[key] as unknown[]) : [];
  if (arr("supported_durations").length) declared.push("duration");
  if (arr("supported_resolutions").length) declared.push("resolution");
  if (arr("supported_aspect_ratios").length) declared.push("aspect_ratio");
  if (controls.supports_background_mode === true) declared.push("background_mode");
  if (controls.supports_variation_strength === true)
    declared.push("variation_strength");
  if (controls.supports_audio_enabled === true) declared.push("audio_enabled");

  return {
    id,
    controls: declared,
    supported_durations: arr("supported_durations")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0),
    supported_resolutions: arr("supported_resolutions").map(String),
    supported_aspect_ratios: arr("supported_aspect_ratios").map(String),
  };
}

export async function loadUniversalEditorCatalog(
  capabilities: UniversalEditorCapability[],
): Promise<UniversalEditorModelView[]> {
  const results = await Promise.all(
    capabilities.map(async (capability) => ({
      capability,
      models: await universalGenerationClient.catalog(capability),
    })),
  );
  const merged = new Map<string, UniversalEditorModelView>();
  for (const { capability, models } of results) {
    for (const model of models) {
      const current = merged.get(model.model_id);
      const view = capabilityView(model, capability);
      if (current) {
        if (!current.editor_capabilities.some((item) => item.id === capability))
          current.editor_capabilities.push(view);
      } else {
        merged.set(model.model_id, {
          ...model,
          editor_capabilities: [view],
        });
      }
    }
  }
  return [...merged.values()];
}

export function editorCapabilityForSelection(
  models: UniversalEditorModelView[],
  capability: UniversalEditorCapability,
  modelId: string,
): UniversalEditorCapabilityView | null {
  if (modelId !== "AUTO") {
    return (
      models
        .find((model) => model.model_id === modelId)
        ?.editor_capabilities.find((item) => item.id === capability) || null
    );
  }

  const eligible = models
    .map((model) =>
      model.editor_capabilities.find((item) => item.id === capability),
    )
    .filter(Boolean) as UniversalEditorCapabilityView[];
  if (!eligible.length) return null;

  const union = <T>(values: T[][]) => [...new Set(values.flat())];
  return {
    id: capability,
    controls: union(eligible.map((item) => item.controls)),
    supported_durations: union(
      eligible.map((item) => item.supported_durations),
    ).sort((a, b) => a - b),
    supported_resolutions: union(
      eligible.map((item) => item.supported_resolutions),
    ),
    supported_aspect_ratios: union(
      eligible.map((item) => item.supported_aspect_ratios),
    ),
  };
}

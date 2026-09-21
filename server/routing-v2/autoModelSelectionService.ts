import { CapabilityId } from "../beta/capabilityRegistry.js";
import { routingV2Repository } from "./repository.js";
import { routingV2RouteService } from "./routeService.js";
import { calculateRoutingV2GenerationPrice } from "./generationPricingService.js";

export interface AutoModelRequirements {
  capability_id: CapabilityId;
  duration_seconds?: number;
  number_of_outputs?: number;
  character_count?: number;
  dimensions?: Record<string, string | number | boolean | null | undefined>;
  parameters?: Record<string, string | number | boolean | null | undefined>;
  reference_types?: string[];
}

export function isModelCompatibleWithRequirements(
  controls: Record<string, unknown>,
  input: AutoModelRequirements,
) {
  const dimensions = input.dimensions || {},
    parameters = input.parameters || {};
  const includes = (key: string, value: unknown) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(controls[key]) && controls[key]!.includes(value));
  if (!includes("supported_resolutions", dimensions.resolution)) return false;
  if (!includes("supported_aspect_ratios", dimensions.aspect_ratio))
    return false;
  const durationIsSelectable = ["text-to-video","image-to-video","first-frame","last-frame","video-edit","video-extend","music"].includes(input.capability_id);
  if (
    durationIsSelectable && input.duration_seconds != null &&
    !includes("supported_durations", input.duration_seconds)
  )
    return false;
  if(Number(input.number_of_outputs||1)>1 && Number(controls.max_outputs||0)<Number(input.number_of_outputs))return false;
  const supportedListByControl: Record<string, string> = {
    output_format: "supported_output_formats",
    language: "supported_languages",
    voice: "supported_voices",
    style: "supported_styles",
    mesh_mode: "supported_mesh_modes",
    topology: "supported_topologies",
  };
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    if (
      supportedListByControl[key] &&
      !includes(supportedListByControl[key], value)
    )
      return false;
    if (
      [
        "seed",
        "instrumental",
        "pbr",
        "target_faces",
        "motion_strength",
        "audio_enabled",
      ].includes(key) &&
      controls[`supports_${key}`] !== true
    )
      return false;
  }
  const refs = input.reference_types || [];
  if (refs.includes("IMAGE") && controls.supports_image_reference !== true)
    return false;
  if (refs.includes("VIDEO") && controls.supports_video_reference !== true)
    return false;
  if (refs.includes("AUDIO") && controls.supports_audio_reference !== true)
    return false;
  return true;
}

export const routingV2AutoModelSelectionService = {
  async select(input: AutoModelRequirements) {
    const [models, routes] = await Promise.all([
      routingV2Repository.listModels(),
      routingV2RouteService.listReady(undefined, input.capability_id),
    ]);
    const eligible = models.filter(
      (model) =>
        model.status === "ACTIVE" &&
        model.capabilities.includes(input.capability_id) &&
        isModelCompatibleWithRequirements(model.supported_controls || {}, input) &&
        routes.some((route) => route.model_id === model.model_id),
    );
    const priced = [];
    for (const model of eligible) {
      const modelRoutes = routes.filter(
          (route) => route.model_id === model.model_id,
        ),
        previews = [];
      for (const route of modelRoutes){
        try{previews.push(
          await calculateRoutingV2GenerationPrice(route, {
            duration_seconds: input.duration_seconds,
            number_of_outputs: input.number_of_outputs,
            character_count: input.character_count,
            dimensions: input.dimensions,
          }),
        );}catch{/* A route without an authorized price cannot participate in Auto. */}
      }
      previews.sort(
        (a, b) =>
          a.retail_credits - b.retail_credits ||
          b.route.priority - a.route.priority ||
          a.route.route_id.localeCompare(b.route.route_id),
      );
      if (previews[0]) priced.push({ model, preview: previews[0] });
    }
    priced.sort(
      (a, b) =>
        a.preview.retail_credits - b.preview.retail_credits ||
        b.preview.route.priority - a.preview.route.priority ||
        a.model.model_id.localeCompare(b.model.model_id),
    );
    if (!priced[0])
      throw Object.assign(
        new Error(
          "Nenhum modelo com Route READY é compatível com esta configuração.",
        ),
        { code: "AUTO_NO_READY_MODEL" },
      );
    return {
      model: priced[0].model,
      preview: priced[0].preview,
      reason:
        "Compatibilidade obrigatória, menor preço autorizado, maior prioridade da Route e desempate estável por model_id.",
    };
  },
};

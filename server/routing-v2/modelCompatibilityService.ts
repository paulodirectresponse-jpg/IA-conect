import type { CapabilityId } from "../beta/capabilityRegistry.js";

export interface ModelCompatibilityRequirements {
  capability_id: CapabilityId;
  duration_seconds?: number;
  number_of_outputs?: number;
  character_count?: number;
  negative_prompt_present?: boolean;
  dimensions?: Record<string, string | number | boolean | null | undefined>;
  parameters?: Record<string, string | number | boolean | null | undefined>;
  reference_types?: string[];
  reference_roles?: string[];
}

export interface ModelCompatibilityResult {
  valid: boolean;
  errors: string[];
}

function includesDeclared(
  controls: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(controls[key]) && (controls[key] as unknown[]).includes(value))
  );
}

function fail(errors: string[], message: string) {
  errors.push(message);
}

export function validateModelCompatibility(
  controls: Record<string, unknown>,
  input: ModelCompatibilityRequirements,
): ModelCompatibilityResult {
  const errors: string[] = [];
  const dimensions = input.dimensions || {};
  const parameters = input.parameters || {};

  if (!includesDeclared(controls, "supported_resolutions", dimensions.resolution))
    fail(errors, "Resolução não comprovada para este modelo.");
  if (
    !includesDeclared(
      controls,
      "supported_aspect_ratios",
      dimensions.aspect_ratio,
    )
  )
    fail(errors, "Proporção não comprovada para este modelo.");

  const durationIsSelectable = [
    "text-to-video",
    "image-to-video",
    "first-frame",
    "last-frame",
    "video-edit",
    "video-extend",
    "music",
    "sound-effects",
  ].includes(input.capability_id);
  if (
    durationIsSelectable &&
    input.duration_seconds != null &&
    !includesDeclared(
      controls,
      "supported_durations",
      input.duration_seconds,
    )
  )
    fail(errors, "Duração não comprovada para este modelo.");

  if (
    Number(input.number_of_outputs || 1) > 1 &&
    Number(controls.max_outputs || 0) < Number(input.number_of_outputs)
  )
    fail(errors, "Quantidade de saídas não comprovada para este modelo.");

  if (
    input.character_count &&
    Number(controls.max_prompt_length || 0) > 0 &&
    input.character_count > Number(controls.max_prompt_length)
  )
    fail(errors, "Prompt excede o limite comprovado para este modelo.");

  if (
    input.negative_prompt_present &&
    controls.supports_negative_prompt !== true
  )
    fail(errors, "Negative prompt não comprovado para este modelo.");

  const supportedListByControl: Record<string, string> = {
    output_format: "supported_output_formats",
    language: "supported_languages",
    voice: "supported_voices",
    style: "supported_styles",
    mesh_mode: "supported_mesh_modes",
    topology: "supported_topologies",
  };
  const booleanControlKeys = new Set([
    "seed",
    "instrumental",
    "pbr",
    "target_faces",
    "motion_strength",
    "audio_enabled",
    "background_mode",
    "variation_strength",
  ]);

  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null || value === "") continue;
    if (
      key === "target_faces" &&
      (!Number(controls.target_faces_min) ||
        Number(value) < Number(controls.target_faces_min) ||
        Number(value) > Number(controls.target_faces_max))
    )
      fail(errors, "Quantidade de faces não comprovada para este modelo.");

    const declaredList = supportedListByControl[key];
    if (
      declaredList &&
      !includesDeclared(controls, declaredList, value)
    )
      fail(errors, `Controle ${key} não comprovado para este modelo.`);

    if (
      booleanControlKeys.has(key) &&
      controls[`supports_${key}`] !== true
    )
      fail(errors, `Controle ${key} não comprovado para este modelo.`);
  }

  const refs = input.reference_types || [];
  const roles = (input.reference_roles || []).map((role) =>
    String(role || "").toUpperCase(),
  );
  const ordinaryRefs = refs.filter(
    (_, index) => roles[index] !== "MASK",
  );
  const count = (type: string) =>
    ordinaryRefs.filter((value) => String(value).toUpperCase() === type).length;

  if (
    ordinaryRefs.some((value) => String(value).toUpperCase() === "IMAGE") &&
    controls.supports_image_reference !== true
  )
    fail(errors, "Imagem de referência não comprovada para este modelo.");
  if (count("IMAGE") > Number(controls.max_reference_images || 0))
    fail(errors, "Quantidade de imagens de referência excede o comprovado.");

  if (
    count("IMAGE") > 1 &&
    controls.supports_multiple_images !== true &&
    !(
      input.capability_id === "last-frame" &&
      controls.supports_start_end_image === true
    )
  )
    fail(errors, "Múltiplas imagens não são comprovadas para este modelo.");

  if (
    ordinaryRefs.some((value) => String(value).toUpperCase() === "VIDEO") &&
    controls.supports_video_reference !== true
  )
    fail(errors, "Vídeo de referência não comprovado para este modelo.");
  if (count("VIDEO") > Number(controls.max_reference_videos || 0))
    fail(errors, "Quantidade de vídeos de referência excede o comprovado.");

  if (
    ordinaryRefs.some((value) => String(value).toUpperCase() === "AUDIO") &&
    controls.supports_audio_reference !== true
  )
    fail(errors, "Áudio de referência não comprovado para este modelo.");
  if (count("AUDIO") > Number(controls.max_reference_audio || 0))
    fail(errors, "Quantidade de áudios de referência excede o comprovado.");

  const hasInitial = roles.some((role) =>
    ["START_FRAME", "INITIAL_FRAME", "INITIAL"].includes(role),
  );
  const hasEnd = roles.some((role) => ["END_FRAME", "END"].includes(role));
  if (hasEnd && controls.supports_start_end_image !== true)
    fail(errors, "Quadro final não comprovado para este modelo.");

  const generalImageRefs = refs.filter(
    (type, index) =>
      String(type).toUpperCase() === "IMAGE" &&
      ![
        "START_FRAME",
        "INITIAL_FRAME",
        "INITIAL",
        "END_FRAME",
        "END",
        "MASK",
      ].includes(roles[index] || ""),
  );
  if ((hasInitial || hasEnd) && generalImageRefs.length > 0)
    fail(
      errors,
      "Frames inicial/final e referências gerais não podem ser combinados neste fluxo.",
    );

  return { valid: errors.length === 0, errors };
}

export function isModelCompatibleWithRequirements(
  controls: Record<string, unknown>,
  input: ModelCompatibilityRequirements,
) {
  return validateModelCompatibility(controls, input).valid;
}

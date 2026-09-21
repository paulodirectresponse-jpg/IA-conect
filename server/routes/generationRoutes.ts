import { Router } from "express";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { generationService } from "../services/generationService.js";
import { billingControlService } from "../services/billingControlService.js";
import { routingV2CatalogService } from "../routing-v2/catalogService.js";
import { routingV2ExecutionService } from "../routing-v2/executionService.js";
import { promptCompilerService } from "../services/promptCompilerService.js";
import { GenerationMode } from "../../src/types/index.js";
import { publicGenerationError } from "../services/publicGenerationError.js";
import { validateConfiguration } from "../../src/services/modelCapabilities.js";
import {
  isCapabilityId,
  type CapabilityId,
} from "../beta/capabilityRegistry.js";
import { routingV2AutoModelSelectionService,isModelCompatibleWithRequirements } from "../routing-v2/autoModelSelectionService.js";
import { assetRepository } from "../repositories/assetRepository.js";

export const generationRouter = Router();

async function ownedReferenceTypes(uid:string,references:any[]):Promise<string[]>{
  const types:string[]=[];
  for(const reference of references){
    const asset=await assetRepository.getAsset(String(reference.asset_id||""),uid);
    if(!asset)throw Object.assign(new Error("Referência inexistente ou sem permissão."),{code:"REFERENCE_NOT_FOUND"});
    types.push(String(asset.type));
  }
  return types;
}

function publicGeneration(g: any) {
  const publicFailure =
    g.error_code || g.error_message
      ? publicGenerationError(
          { code: g.error_code, message: g.error_message },
          "A geração não pôde ser concluída.",
        )
      : null;
  return {
    generation_id: g.generation_id,
    user_id: g.user_id,
    status: g.status,
    model_id: g.model_id,
    capability_id: g.capability_id,
    requested_model_id: g.requested_model_id,
    routing_mode: g.routing_mode,
    provider_id: g.provider_id,
    routing_v2_route_id: g.routing_v2_route_id,
    mode: g.mode,
    original_prompt: g.original_prompt,
    compiled_prompt: g.compiled_prompt,
    prompt_compiler_version: g.prompt_compiler_version,
    negative_prompt: g.negative_prompt,
    duration_seconds: g.duration_seconds,
    resolution: g.resolution,
    aspect_ratio: g.aspect_ratio,
    number_of_outputs: g.number_of_outputs,
    seed: g.seed,
    motion_strength: g.motion_strength,
    audio_enabled: g.audio_enabled,
    model_variant: g.model_variant,
    references: g.references,
    retail_credit_price: g.retail_credit_price,
    final_credit_cost: g.final_credit_cost,
    client_request_id: g.client_request_id,
    progress_percent: g.progress_percent,
    result_asset_id: g.result_asset_id,
    result_asset_ids: g.result_asset_ids,
    result_url: g.result_url,
    result_urls: g.result_urls,
    thumbnail_url: g.thumbnail_url,
    error_code: publicFailure?.code ?? null,
    error_message: publicFailure?.message ?? null,
    attempt_count: g.attempt_count,
    references_count: g.references_count,
    created_at: g.created_at,
    submitted_at: g.submitted_at,
    completed_at: g.completed_at,
    failed_at: g.failed_at,
  };
}

async function buildGenerationQuote(
  uid: string,
  body: any,
  modelOverride?: any,
) {
  const settings = { ...(body.settings || {}), ...(body.controls || {}) };
  const rawCapability = String(
    body.capability_id ||
      String(body.mode || "TEXT_TO_VIDEO")
        .toLowerCase()
        .replace(/_/g, "-"),
  );
  if (!isCapabilityId(rawCapability))
    throw Object.assign(new Error("Capability inválida."), {
      code: "VALIDATION_ERROR",
    });
  const capabilityId = rawCapability as CapabilityId,
    mode = capabilityId.toUpperCase().replace(/-/g, "_") as GenerationMode;
  const prompt = String(body.prompt || "").trim();
  if (!body.model_id)
    throw Object.assign(new Error("Modelo é obrigatório."), {
      code: "VALIDATION_ERROR",
    });

  const dimensions = {
    resolution: settings.resolution,
    aspect_ratio: settings.aspect_ratio,
  };
  const parameters = {
    language: settings.language,
    voice: settings.voice,
    output_format: settings.output_format,
    style: settings.style,
    instrumental: settings.instrumental,
    seed: settings.seed,
    mesh_mode: settings.mesh_mode,
    pbr: settings.pbr,
    target_faces: settings.target_faces,
    topology: settings.topology,
    motion_strength: settings.motion_strength,
    audio_enabled: settings.audio_enabled,
  };
  const auto =
    String(body.model_id) === "AUTO"
      ? await routingV2AutoModelSelectionService.select({
          capability_id: capabilityId,
          duration_seconds: Number(settings.duration_seconds) || undefined,
          number_of_outputs: Number(settings.number_of_outputs) || 1,
          character_count: prompt.length,
          dimensions,
          parameters,
          reference_types: await ownedReferenceTypes(uid,body.references || []),
        })
      : null;
  const model =
    auto?.model ||
    modelOverride ||
    (await routingV2CatalogService.listGeneratorModels()).find(
      (row) => row.model_id === String(body.model_id),
    );
  if (!model || model.status === "INACTIVE")
    throw Object.assign(new Error("Modelo indisponível."), {
      code: "MODEL_NOT_FOUND",
    });

  const imageMode = mode === "TEXT_TO_IMAGE" || mode === "IMAGE_TO_IMAGE";
  const providedDuration=Number(settings.duration_seconds)>0?Number(settings.duration_seconds):undefined;
  const duration = imageMode
    ? 1
    : providedDuration||1;
  const resolution = String(settings.resolution || (imageMode ? "1K" : "720p"));
  const aspectRatio = String(settings.aspect_ratio || "16:9");
  const requestedOutputs = Math.max(
    1,
    Math.min(4, Number(settings.number_of_outputs || 1)),
  );
  const outputs = imageMode ? requestedOutputs : 1;
  const references = Array.isArray(body.references) ? body.references : [];
  const roleOf = (reference: any) =>
    String(reference?.role || reference?.slot_type || "").toUpperCase();
  const hasStartImage = references.some((reference: any) =>
    ["START_FRAME", "INITIAL_FRAME", "INITIAL"].includes(roleOf(reference)),
  );
  const hasEndImage = references.some((reference: any) =>
    ["END_FRAME", "END"].includes(roleOf(reference)),
  );
  if (
    !model.capabilities?.includes?.(capabilityId) &&
    !model.beta_capability_ids?.includes?.(capabilityId)
  )
    throw Object.assign(
      new Error("Capability não comprovada para este modelo."),
      { code: "MODEL_CAPABILITY_UNSUPPORTED" },
    );
  if(!isModelCompatibleWithRequirements(model.supported_controls||{},{capability_id:capabilityId,duration_seconds:duration,number_of_outputs:outputs,character_count:prompt.length,dimensions:{resolution:settings.resolution,aspect_ratio:settings.aspect_ratio},parameters,reference_types:await ownedReferenceTypes(uid,references)}))throw Object.assign(new Error("Controles não comprovados para este modelo."),{code:"MODEL_CONTROLS_UNSUPPORTED"});
  if (
    [
      "text-to-image",
      "image-to-image",
      "text-to-video",
      "image-to-video",
      "first-frame",
      "last-frame",
    ].includes(capabilityId)
  ) {
    const compatibility = validateConfiguration(model, {
      mode,
      duration_seconds: duration,
      resolution,
      aspect_ratio: aspectRatio,
      references,
      negative_prompt: body.negative_prompt,
      promptText: prompt,
      has_start_image: hasStartImage,
      has_end_image: hasEndImage,
    });
    if (!compatibility.valid)
      throw Object.assign(new Error(compatibility.errors[0]), {
        code: "VALIDATION_ERROR",
      });
  }

  const v2 = await routingV2ExecutionService.preview({
    user_id: uid,
    model_id: model.model_id,
    capability_id: capabilityId,
    prompt,
    negative_prompt: body.negative_prompt,
    character_count: prompt.length,
    duration_seconds: imageMode?1:providedDuration,
    number_of_outputs: outputs,
    dimensions: { resolution, aspect_ratio: aspectRatio },
  });
  const compiled = promptCompilerService.compile({
    original_prompt: prompt,
    references,
    negative_prompt: body.negative_prompt,
    generation_settings: {
      model_id: model.model_id,
      mode,
      duration_seconds: duration,
      resolution,
      aspect_ratio: aspectRatio,
    },
  });
  const pricingId = `routing-v2:${v2.route.route_id}:${v2.pricing_fetched_at}`;
  return {
    resolved_model_id: model.model_id,
    requested_model_id: String(body.model_id),
    routing_mode: auto ? "AUTO" : "MANUAL",
    route_decision: {
      route_id: v2.route.route_id,
      provider_id: v2.route.provider_id,
    },
    credit_price: v2.retail_credits,
    unit_price: v2.retail_credits,
    pricing_source: v2.route.pricing_snapshot?.source,
    valid_until: v2.pricing_valid_until,
    sufficient_funds: v2.wallet.has_sufficient_credits,
    compatible_controls: model.supported_controls || {},
    request_draft: {
      request_id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: uid,
      model_id: model.model_id,
      requested_model_id: String(body.model_id),
      routing_mode: auto ? "AUTO" : "MANUAL",
      capability_id: capabilityId,
      model_name: model.name,
      mode,
      prompt,
      compiled_prompt: compiled.compiled_prompt,
      prompt_compiler_version: compiled.prompt_compiler_version,
      negative_prompt: body.negative_prompt,
      references,
      settings: {
        ...settings,
        duration_seconds: duration,
        resolution,
        aspect_ratio: aspectRatio,
        number_of_outputs: outputs,
      },
      has_pricing: true,
      retail_credit_price: v2.retail_credits,
      unit_credit_price: v2.retail_credits,
      pricing_unit: "ROUTING_V2_ROUTE",
      base_duration_seconds: duration,
      billing_units: 1,
      authorized_credit_price: v2.retail_credits,
      credit_balance_available: v2.wallet.has_sufficient_credits
        ? v2.retail_credits
        : Math.max(0, v2.retail_credits - v2.wallet.missing_credits),
      balance_after_generation_credits: v2.wallet.has_sufficient_credits
        ? 0
        : -v2.wallet.missing_credits,
      has_sufficient_funds: v2.wallet.has_sufficient_credits,
      pricing_signature_hash: pricingId,
      retail_pricing_id: pricingId,
      retail_pricing_version: 1,
      created_at: new Date().toISOString(),
    },
    notice: `Preço confirmado: ${v2.retail_credits.toLocaleString("pt-BR")} créditos.`,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        out[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return out;
}

generationRouter.post(
  "/generations/quote",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      await billingControlService.assertNewGenerationAllowed();
      const data = await buildGenerationQuote(req.user!.uid, req.body);
      return res.json({ success: true, data });
    } catch (err: any) {
      const error = publicGenerationError(
        err,
        "Não foi possível confirmar o preço desta configuração.",
      );
      const status =
        err?.code === "CREDIT_INSUFFICIENT_FUNDS"
          ? 402
          : err?.code === "NO_SAFE_PROVIDER_AVAILABLE"
            ? 503
            : 400;
      return res.status(status).json({ success: false, error });
    }
  },
);

generationRouter.post(
  "/generations/quote-batch",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      await billingControlService.assertNewGenerationAllowed();
      const requests = Array.isArray(req.body?.requests)
        ? req.body.requests.slice(0, 16)
        : [];
      if (!requests.length)
        return res
          .status(400)
          .json({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Envie pelo menos uma cotação.",
            },
          });
      const models = await routingV2CatalogService.listGeneratorModels(),
        byId = new Map(models.map((model) => [model.model_id, model]));
      const items = await mapWithConcurrency(
        requests,
        4,
        async (item: any, index) => {
          const key = String(item?.key || item?.model_id || index);
          try {
            const quote = await buildGenerationQuote(
                req.user!.uid,
                item,
                byId.get(String(item?.model_id)),
              ),
              draft: any = quote.request_draft;
            return {
              key,
              ok: true,
              pricing: {
                model_id: draft.model_id,
                retail_credit_price: draft.retail_credit_price,
                unit_credit_price: draft.unit_credit_price,
                has_sufficient_funds: draft.has_sufficient_funds,
              },
            };
          } catch (err: any) {
            return {
              key,
              ok: false,
              error: publicGenerationError(
                err,
                "Não foi possível confirmar esta cotação.",
              ),
            };
          }
        },
      );
      return res.json({ success: true, data: { items } });
    } catch (err: any) {
      return res
        .status(400)
        .json({
          success: false,
          error: publicGenerationError(
            err,
            "Não foi possível confirmar as cotações.",
          ),
        });
    }
  },
);

generationRouter.post(
  "/generations",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      await billingControlService.assertNewGenerationAllowed();
      const uid = req.user!.uid;
      if(!(Number(req.body.authorized_credit_price)>0))throw Object.assign(new Error("Calcule e autorize o preço antes de gerar."),{code:"QUOTE_REQUIRED"});
      const host = req.get("host") || process.env.APP_URL;
      const authorization = String(req.headers.authorization || "");
      const idToken = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : undefined;

      const settings = {
        ...(req.body.settings || {}),
        ...(req.body.controls || {}),
        ...req.body,
      };
      const rawCapability = String(
        req.body.capability_id ||
          String(req.body.mode || "TEXT_TO_VIDEO")
            .toLowerCase()
            .replace(/_/g, "-"),
      );
      if (!isCapabilityId(rawCapability))
        throw Object.assign(new Error("Capability inválida."), {
          code: "VALIDATION_ERROR",
        });
      const capabilityId = rawCapability as CapabilityId;
      const requestedModelId = String(req.body.model_id || "");
      const auto =
        requestedModelId === "AUTO"
          ? await routingV2AutoModelSelectionService.select({
              capability_id: capabilityId,
              duration_seconds: Number(settings.duration_seconds) || undefined,
              number_of_outputs: Number(settings.number_of_outputs) || 1,
              character_count: String(req.body.prompt || "").trim().length,
              dimensions: {
                resolution: settings.resolution,
                aspect_ratio: settings.aspect_ratio,
              },
              parameters: {
                language: settings.language,
                voice: settings.voice,
                output_format: settings.output_format,
                style: settings.style,
                instrumental: settings.instrumental,
                seed: settings.seed,
                mesh_mode: settings.mesh_mode,
                pbr: settings.pbr,
                target_faces: settings.target_faces,
                topology: settings.topology,
                motion_strength: settings.motion_strength,
                audio_enabled: settings.audio_enabled,
              },
              reference_types: await ownedReferenceTypes(uid,req.body.references || []),
            })
          : null;
      const g = await generationService.createAndStartGeneration({
        userId: uid,
        model_id: auto?.model.model_id || requestedModelId,
        requested_model_id: requestedModelId,
        routing_mode: auto ? "AUTO" : "MANUAL",
        capability_id: capabilityId,
        mode: (req.body.mode ||
          capabilityId.toUpperCase().replace(/-/g, "_")) as GenerationMode,
        prompt: String(req.body.prompt||"").trim(),
        negative_prompt: req.body.negative_prompt,
        duration_seconds: Number(settings.duration_seconds || 1),
        resolution: settings.resolution || "",
        aspect_ratio: settings.aspect_ratio || "",
        number_of_outputs: Number(settings.number_of_outputs || 1),
        seed: settings.seed,
        motion_strength: settings.motion_strength,
        audio_enabled:
          settings.audio_enabled === undefined
            ? undefined
            : Boolean(settings.audio_enabled),
        model_variant: settings.model_variant,
        pricing_options: {
          ...(settings.pricing_options || {}),
          language: settings.language,
          voice: settings.voice,
          output_format: settings.output_format,
          style: settings.style,
          instrumental: settings.instrumental,
          mesh_mode: settings.mesh_mode,
          pbr: settings.pbr,
          target_faces: settings.target_faces,
          topology: settings.topology,
        },
        references: req.body.references || [],
        client_request_id: req.body.client_request_id,
        authorized_credit_price: Number.isFinite(
          Number(req.body.authorized_credit_price),
        )
          ? Number(req.body.authorized_credit_price)
          : undefined,
        retail_pricing_id: req.body.retail_pricing_id,
        pricing_signature_hash: req.body.pricing_signature_hash,
        reqHost: host,
        idToken,
      });

      return res.json({ success: true, data: publicGeneration(g) });
    } catch (err: any) {
      const error = publicGenerationError(
        err,
        "Não foi possível iniciar a geração.",
      );
      const status =
        err?.code === "CREDIT_INSUFFICIENT_FUNDS"
          ? 402
          : err?.code === "PRICE_CHANGED_REQUOTE_REQUIRED"
            ? 409
            : err?.code === "NO_SAFE_PROVIDER_AVAILABLE"
              ? 503
              : 400;
      return res.status(status).json({ success: false, error });
    }
  },
);

generationRouter.get(
  "/generations",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await generationService.listUserGenerations(
        req.user!.uid,
        Math.min(100, Math.max(1, Number(req.query.limit || 50))),
      );
      return res.json({ success: true, data: rows.map(publicGeneration) });
    } catch {
      return res
        .status(500)
        .json({
          success: false,
          error: {
            code: "GENERATION_LIST_ERROR",
            message: "Não foi possível carregar as gerações.",
          },
        });
    }
  },
);

generationRouter.post(
  "/generations/status-batch",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const ids = Array.isArray(req.body?.generation_ids)
        ? req.body.generation_ids.map(String).filter(Boolean).slice(0, 24)
        : [];
      if (!ids.length) return res.json({ success: true, data: [] });
      const rows = await generationService.getGenerations(ids, req.user!.uid);
      return res.json({ success: true, data: rows.map(publicGeneration) });
    } catch {
      return res
        .status(500)
        .json({
          success: false,
          error: {
            code: "GENERATION_STATUS_BATCH_ERROR",
            message: "Não foi possível atualizar as gerações.",
          },
        });
    }
  },
);

generationRouter.get(
  "/generations/:generationId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const generation = await generationService.getGeneration(
        req.params.generationId,
        req.user!.uid,
      );
      if (!generation) {
        return res
          .status(404)
          .json({
            success: false,
            error: {
              code: "GENERATION_NOT_FOUND",
              message: "Geração não encontrada.",
            },
          });
      }
      return res.json({ success: true, data: publicGeneration(generation) });
    } catch {
      return res
        .status(500)
        .json({
          success: false,
          error: {
            code: "GENERATION_GET_ERROR",
            message: "Não foi possível carregar a geração.",
          },
        });
    }
  },
);

generationRouter.post(
  "/generations/:generationId/cancel",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const generation = await generationService.cancelGeneration(
        req.params.generationId,
        req.user!.uid,
      );
      return res.json({ success: true, data: publicGeneration(generation) });
    } catch (err: any) {
      const providerLocked = /não permite cancelar|processamento/i.test(
        String(err?.message || ""),
      );
      return res.status(providerLocked ? 409 : 400).json({
        success: false,
        error: {
          code: providerLocked
            ? "GENERATION_CANCEL_UNAVAILABLE"
            : "GENERATION_CANCEL_ERROR",
          message: providerLocked
            ? "Esta geração já está em processamento e não pode mais ser cancelada."
            : "Não foi possível cancelar esta geração.",
        },
      });
    }
  },
);

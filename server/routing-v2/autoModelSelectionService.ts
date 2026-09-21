import { CapabilityId } from "../beta/capabilityRegistry.js";
import { routingV2Repository } from "./repository.js";
import { routingV2RouteService } from "./routeService.js";
import { routingV2GenerationPricingService } from "./generationPricingService.js";
import {
  isModelCompatibleWithRequirements,
  type ModelCompatibilityRequirements,
} from "./modelCompatibilityService.js";

export type AutoModelRequirements = ModelCompatibilityRequirements;

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
      try{
        const preview=await routingV2GenerationPricingService.preview({model_id:model.model_id,capability_id:input.capability_id,duration_seconds:input.duration_seconds,number_of_outputs:input.number_of_outputs,character_count:input.character_count,dimensions:input.dimensions});
        priced.push({model,preview});
      }catch{/* A model without an authorized READY route price cannot participate in Auto. */}
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

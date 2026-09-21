import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Boxes,
  CheckCircle2,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Layers3,
  Upload,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { assetService } from "../../services/assetService.js";
import { ApiError } from "../../services/apiClient.js";
import {
  universalGenerationClient,
  UniversalCreationQuote,
} from "../../services/universalGenerationClient.js";
import { Asset, Generation, ModelRegistryItem } from "../../types/index.js";
import { CreationGallery } from "../workspace/CreationGallery.js";
import { UniversalModelPicker } from "../workspace/UniversalModelPicker.js";
import { StableModel3DPreview } from "../workspace/StableModel3DPreview.js";
import {
  GeneratorField,
  GeneratorFooter,
  GeneratorOptionGrid,
  GeneratorPanel,
  GeneratorRangeSlider,
  GeneratorScroll,
  GeneratorSettingRow,
  GeneratorToggle,
} from "../workspace/GeneratorControls.js";
import { PromptComposer } from "../workspace/PromptComposer.js";
import { MobileStudioLayout } from "../workspace/MobileStudioLayout.js";

type Tool = "text-to-3d" | "image-to-3d" | "multi-image-to-3d";
type OpenCard = "mesh" | "topology" | "faces" | null;
const TOOLS: Array<{
  id: Tool;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "text-to-3d",
    label: "Texto → 3D",
    description: "Crie por descrição.",
    icon: Box,
  },
  {
    id: "image-to-3d",
    label: "Imagem → 3D",
    description: "Use uma imagem.",
    icon: ImageIcon,
  },
  {
    id: "multi-image-to-3d",
    label: "Multiimagem → 3D",
    description: "Combine 2–4 vistas.",
    icon: Boxes,
  },
];
const terminal = (status?: string) =>
  ["SUCCEEDED", "FAILED", "CANCELLED"].includes(String(status || ""));
const message = (error: any) =>
  error instanceof ApiError
    ? error.message
    : error?.message || "Não foi possível concluir esta operação.";

export const ThreeDCreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();
  const [tool, setTool] = useState<Tool>("text-to-3d"),
    [models, setModels] = useState<ModelRegistryItem[]>([]),
    [selectedModelId, setSelectedModelId] = useState("AUTO"),
    [images, setImages] = useState<Asset[]>([]),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [prompt, setPrompt] = useState(""),
    [openCard, setOpenCard] = useState<OpenCard>(null),
    [mobileActiveCount, setMobileActiveCount] = useState(0);
  const [meshMode, setMeshMode] = useState<
      "TEXTURED" | "LOW_POLY" | "GEOMETRY"
    >("TEXTURED"),
    [pbr, setPbr] = useState(false),
    [targetFaces, setTargetFaces] = useState(500000),
    [topology, setTopology] = useState<"TRIANGLE" | "QUAD">("TRIANGLE");
  const [generation, setGeneration] = useState<Generation | null>(null),
    [quoteData, setQuoteData] = useState<UniversalCreationQuote | null>(null),
    [result, setResult] = useState<Asset | null>(null),
    [busy, setBusy] = useState("load"),
    [error, setError] = useState(""),
    [pollCount, setPollCount] = useState(0);
  const load = useCallback(async () => {
    setBusy((current) => current || "load");
    setError("");
    try {
      const [catalog, assetRows] = await Promise.all([
        universalGenerationClient.catalog(tool),
        assetService.listAssets({ type: "IMAGE" }),
      ]);
      setModels(catalog);
      setImages(assetRows);
      setSelectedModelId((current) =>
        current === "AUTO" ||
        catalog.some((model) => model.model_id === current)
          ? current
          : "AUTO",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy((current) => (current === "load" ? "" : current));
    }
  }, [tool]);
  useEffect(() => {
    void load();
  }, [load]);
  const availableModels = models;
  const model = useMemo(
    () =>
      availableModels.find((item) => item.model_id === selectedModelId) || null,
    [availableModels, selectedModelId],
  );
  const selectedCandidates =
    selectedModelId === "AUTO" ? availableModels : model ? [model] : [];
  const supports = (key: string) =>
    selectedCandidates.some((item) => item.supported_controls?.[key] === true);
  const supportedValues = (key: string) =>
    Array.from(
      new Set(
        selectedCandidates.flatMap((item) => {
          const value = item.supported_controls?.[key];
          return Array.isArray(value) ? value.map(String) : [];
        }),
      ),
    );
  const meshModes = supportedValues("supported_mesh_modes");
  const topologies = supportedValues("supported_topologies");
  const selectedMeshMode = meshModes.includes(meshMode) ? meshMode : meshModes[0];
  const selectedTopology = topologies.includes(topology) ? topology : topologies[0];
  const faceRanges=selectedCandidates.filter(item=>item.supported_controls?.supports_target_faces===true).map(item=>({min:Number(item.supported_controls?.target_faces_min),max:Number(item.supported_controls?.target_faces_max)})).filter(range=>Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min>0&&range.max>=range.min);
  const faceMin=faceRanges.length?Math.min(...faceRanges.map(range=>range.min)):0,faceMax=faceRanges.length?Math.max(...faceRanges.map(range=>range.max)):0;
  const selectedFaces=faceRanges.length?Math.max(faceMin,Math.min(faceMax,targetFaces)):undefined;
  const routeReady = models.length > 0;
  const invalidate = () => {
    setGeneration(null);
    setQuoteData(null);
    setResult(null);
    setPollCount(0);
    setError("");
  };
  useEffect(() => {
    setSelectedIds([]);
    invalidate();
  }, [tool]);
  useEffect(() => {
    if (!generation || terminal(generation.status) || pollCount >= 180) return;
    const timer = window.setTimeout(
      async () => {
        try {
          setGeneration(
            await universalGenerationClient.get(generation.generation_id),
          );
          setPollCount((value) => value + 1);
        } catch (err) {
          setError(message(err));
          setPollCount(180);
        }
      },
      Math.min(7000, 2000 + pollCount * 100),
    );
    return () => window.clearTimeout(timer);
  }, [generation, pollCount]);
  useEffect(() => {
    if (generation?.status !== "SUCCEEDED") return;
    void refreshWallet();
    const assetId = generation.result_asset_ids?.[0];
    if (assetId)
      void assetService
        .listAssets({ type: "MODEL_3D", origin: "GENERATED" })
        .then((rows) =>
          setResult(rows.find((row) => row.asset_id === assetId) || null),
        )
        .catch(() => setResult(null));
    window.dispatchEvent(
      new CustomEvent("creations:updated", {
        detail: {
          kind: "THREE_D",
          asset_ids: generation.result_asset_ids || [],
        },
      }),
    );
  }, [generation?.status, generation?.result_asset_ids, refreshWallet]);
  const toggleImage = (id: string) => {
    invalidate();
    if (tool === "image-to-3d") {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 4
          ? [...current, id]
          : current,
    );
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files
      ? Array.from(event.target.files as FileList)
      : [];
    event.target.value = "";
    if (!files.length) return;
    setBusy("upload");
    setError("");
    try {
      const next: Asset[] = [];
      for (const file of files.slice(0, tool === "multi-image-to-3d" ? 4 : 1))
        next.push(await assetService.uploadAsset({ file, name: file.name }));
      setImages((current) => [
        ...next,
        ...current.filter(
          (row) => !next.some((item) => item.asset_id === row.asset_id),
        ),
      ]);
      setSelectedIds((current) =>
        tool === "image-to-3d"
          ? [next[0].asset_id]
          : Array.from(
              new Set([...current, ...next.map((item) => item.asset_id)]),
            ).slice(0, 4),
      );
      invalidate();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  };
  const buildRequest = () => {
    if (!routeReady)
      throw new Error(
        "Nenhum modelo com Route READY está disponível para esta modalidade.",
      );
    if (tool === "text-to-3d" && !prompt.trim())
      throw new Error("Descreva o objeto que deseja criar.");
    if (tool === "image-to-3d" && selectedIds.length !== 1)
      throw new Error("Selecione uma imagem de referência.");
    if (
      tool === "multi-image-to-3d" &&
      (selectedIds.length < 2 || selectedIds.length > 4)
    )
      throw new Error("Selecione de 2 a 4 imagens do mesmo objeto.");
    return {
      capability_id: tool,
      model_id: selectedModelId,
      prompt: prompt.trim(),
      references: selectedIds.map((asset_id) => ({
        asset_id,
        slot_type: "GENERAL" as const,
      })),
      controls: {
        output_format: supportedValues("supported_output_formats").includes("glb") ? "glb" : undefined,
        mesh_mode: selectedMeshMode,
        pbr: supports("supports_pbr") ? (meshMode === "GEOMETRY" ? false : pbr) : undefined,
        target_faces: selectedFaces,
        topology: selectedTopology,
      },
    };
  };
  const quote = async () => {
    setBusy("quote");
    setError("");
    setGeneration(null);
    setResult(null);
    try {
      setQuoteData(await universalGenerationClient.quote(buildRequest()));
      setPollCount(0);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  };
  const generate = async () => {
    if (!quoteData) return;
    setBusy("generate");
    setError("");
    try {
      setGeneration(
        await universalGenerationClient.create(buildRequest(), quoteData),
      );
      setPollCount(0);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  };
  const balance = wallet?.available_credits ?? 0,
    price = quoteData?.credit_price ?? null,
    insufficient = price != null && balance < price;
  const status =
    generation?.status === "SUCCEEDED"
      ? "Concluído"
      : generation?.status === "FAILED"
        ? "Falhou"
        : generation?.status === "CANCELLED"
          ? "Cancelado"
          : generation?.status === "PROCESSING"
            ? "Processando"
            : generation?.status === "QUEUED"
              ? "Na fila"
              : quoteData
                ? "Preço calculado"
                : "Preparando";
  const meshLabel =
      meshMode === "TEXTURED"
        ? "Texturizada"
        : meshMode === "LOW_POLY"
          ? "Low poly"
          : "Somente geometria",
    topologyLabel = topology === "TRIANGLE" ? "Triângulos" : "Quads";
  const requestReady =
    routeReady &&
    (tool !== "text-to-3d" || Boolean(prompt.trim())) &&
    (tool !== "image-to-3d" || selectedIds.length === 1) &&
    (tool !== "multi-image-to-3d" ||
      (selectedIds.length >= 2 && selectedIds.length <= 4));
  const footer = !quoteData
    ? {
        label: "Calcular créditos",
        disabled: Boolean(busy) || !requestReady,
        onClick: quote,
        secondary: undefined as string | undefined,
        onSecondary: undefined as (() => void) | undefined,
      }
    : {
        label: !generation ? "Gerar 3D" : status,
        disabled: Boolean(busy) || insufficient || Boolean(generation),
        onClick: generate,
        secondary: !generation ? "Atualizar" : undefined,
        onSecondary: !generation ? quote : undefined,
      };
  const creator = (
    <GeneratorPanel ariaLabel="Gerador 3D">
      <GeneratorScroll>
        <UniversalModelPicker
          models={availableModels}
          selectedModelId={selectedModelId}
          loading={busy === "load"}
          onSelect={(modelId) => {
            setSelectedModelId(modelId);
            invalidate();
          }}
        />
        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            const selected = tool === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setTool(item.id)}
                className={`min-w-0 rounded-xl border p-2.5 text-left transition-colors ${selected ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100" : "border-white/[0.065] bg-white/[0.025] text-zinc-500 hover:text-zinc-200"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <strong className="block mt-1.5 text-[9px] text-white">
                  {item.label}
                </strong>
                <small className="block mt-0.5 text-[7px] leading-tight text-zinc-700">
                  {item.description}
                </small>
              </button>
            );
          })}
        </div>
        {tool === "text-to-3d" ? (
          <PromptComposer
            prompt={prompt}
            onChangePrompt={(value) => {
              setPrompt(value);
              invalidate();
            }}
            negativePrompt=""
            onChangeNegativePrompt={() => {}}
            onOpenImproveModal={() => {}}
            references={[]}
            onRequestAddMedia={() => {}}
            supportsNegativePrompt={false}
            supportsReferences={false}
            maxChars={4000}
            label="Descrição do objeto"
            placeholder="Ex.: cadeira lounge escultural em nogueira, almofada de couro caramelo…"
            showImproveButton={false}
          />
        ) : (
          <GeneratorField
            label={
              tool === "image-to-3d"
                ? "Imagem de referência"
                : "Vistas do mesmo objeto"
            }
          >
            <div className="flex justify-end mb-2">
              <label className="h-8 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 flex items-center gap-1.5 text-[9px] font-semibold text-zinc-300 cursor-pointer">
                <Upload className="w-3 h-3" />
                {busy === "upload" ? "Enviando…" : "Upload"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple={tool === "multi-image-to-3d"}
                  disabled={busy === "upload"}
                  onChange={upload}
                />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {images.slice(0, 12).map((asset) => (
                <button
                  type="button"
                  key={asset.asset_id}
                  className={`relative aspect-square overflow-hidden rounded-lg border ${selectedIds.includes(asset.asset_id) ? "border-cyan-300" : "border-white/[0.07]"}`}
                  onClick={() => toggleImage(asset.asset_id)}
                >
                  <img
                    src={asset.thumbnail_url || asset.public_url || ""}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedIds.includes(asset.asset_id) && (
                    <span className="absolute right-1 bottom-1 rounded bg-cyan-300 text-black text-[7px] font-black px-1">
                      {selectedIds.indexOf(asset.asset_id) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </GeneratorField>
        )}
        <div className="space-y-1.5">
          {meshModes.length > 0 && <GeneratorSettingRow
            icon={Layers3}
            label="Tipo de malha"
            value={meshLabel}
            open={openCard === "mesh"}
            onToggle={() => setOpenCard(openCard === "mesh" ? null : "mesh")}
          >
            <GeneratorOptionGrid
              values={meshModes.map(value=>({value,label:value==='TEXTURED'?'Texturizada':value==='LOW_POLY'?'Low poly':value==='GEOMETRY'?'Somente geometria':value}))}
              current={selectedMeshMode}
              onSelect={(value) => {
                setMeshMode(value as any);
                invalidate();
              }}
            />
          </GeneratorSettingRow>}
          {topologies.length > 0 && <GeneratorSettingRow
            icon={Grid3X3}
            label="Topologia"
            value={topologyLabel}
            open={openCard === "topology"}
            onToggle={() =>
              setOpenCard(openCard === "topology" ? null : "topology")
            }
            semantic="ratio"
          >
            <GeneratorOptionGrid
              values={topologies.map(value=>({value,label:value==='TRIANGLE'?'Triângulos':value==='QUAD'?'Quads':value}))}
              current={selectedTopology}
              onSelect={(value) => {
                setTopology(value as any);
                invalidate();
              }}
            />
          </GeneratorSettingRow>}
          {selectedFaces!==undefined && <GeneratorSettingRow
            icon={Boxes}
            label="Faces alvo"
            value={selectedFaces.toLocaleString("pt-BR")}
            open={openCard === "faces"}
            onToggle={() => setOpenCard(openCard === "faces" ? null : "faces")}
            semantic="outputs"
          >
            <GeneratorRangeSlider
              min={faceMin}
              max={faceMax}
              step={Math.max(1,Math.round((faceMax-faceMin)/100))}
              value={selectedFaces}
              onChange={(value) => {
                setTargetFaces(value);
                invalidate();
              }}
              headline={selectedFaces.toLocaleString("pt-BR")}
              subtitle="densidade aproximada da malha"
            />
          </GeneratorSettingRow>}
        </div>
        {supports("supports_pbr") && <GeneratorToggle
          checked={pbr}
          disabled={meshMode === "GEOMETRY"}
          onChange={(value) => {
            setPbr(value);
            invalidate();
          }}
          label="Materiais PBR"
          description="Gera materiais físicos quando suportado."
        />}
        {(quoteData || generation) && (
          <section className="ia-stable-current">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[8px] text-zinc-600">
                  Resultado atual
                </span>
                <strong className="block text-[10px] text-white">
                  {status}
                </strong>
              </div>
              {generation?.status === "SUCCEEDED" ? (
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
              ) : (
                <Box className="w-4 h-4 text-cyan-300" />
              )}
            </div>
            {quoteData && (
              <p>
                Modelo executado: <strong>{quoteData.resolved_model_id}</strong>{" "}
                ·{" "}
                {quoteData.routing_mode === "AUTO"
                  ? "seleção AUTO"
                  : "modelo específico"}
                .
              </p>
            )}
            {generation?.status === "FAILED" && (
              <p>
                {generation.error_message ||
                  "A geração 3D não pôde ser concluída."}
              </p>
            )}
            {generation?.status === "SUCCEEDED" && result?.public_url && (
              <>
                <StableModel3DPreview
                  url={result.public_url}
                  label={result.name}
                />
                <a
                  className="mt-2 h-9 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 flex items-center justify-center gap-2 text-[9px] font-semibold text-zinc-300"
                  href={result.public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="w-3 h-3" />
                  Abrir GLB
                </a>
              </>
            )}
          </section>
        )}
      </GeneratorScroll>
      <GeneratorFooter
        error={error}
        price={price}
        balance={balance}
        hasBalance={!insufficient}
        primaryLabel={footer.label}
        onPrimary={() => void footer.onClick()}
        primaryDisabled={footer.disabled}
        primaryBusy={busy === "quote" || busy === "generate"}
        secondaryLabel={footer.secondary}
        onSecondary={
          footer.onSecondary ? () => void footer.onSecondary?.() : undefined
        }
        secondaryDisabled={Boolean(busy)}
      />
    </GeneratorPanel>
  );
  return (
    <MobileStudioLayout
      activeCount={mobileActiveCount}
      creator={creator}
      gallery={
        <CreationGallery
          defaultFilter="THREE_D"
          title="Minhas criações"
          subtitle="Todo o histórico de criações do seu studio."
          onActiveCountChange={setMobileActiveCount}
        />
      }
    />
  );
};
export default ThreeDCreateView;

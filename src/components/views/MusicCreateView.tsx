import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Disc3, FileAudio, Hash } from "lucide-react";
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
import {
  GeneratorDiscreteSlider,
  GeneratorFooter,
  GeneratorOptionGrid,
  GeneratorPanel,
  GeneratorScroll,
  GeneratorSettingRow,
  GeneratorToggle,
} from "../workspace/GeneratorControls.js";
import { PromptComposer } from "../workspace/PromptComposer.js";
import { MobileStudioLayout } from "../workspace/MobileStudioLayout.js";

const PREFERRED_DURATIONS = [15, 30, 60, 90, 120, 180, 240];
const terminal = (status?: string) =>
  ["SUCCEEDED", "FAILED", "CANCELLED"].includes(String(status || ""));
const message = (error: any) =>
  error instanceof ApiError
    ? error.message
    : error?.message || "Não foi possível concluir esta operação.";
type OpenCard = "duration" | "format" | "seed" | null;

export const MusicCreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>([]),
    [selectedModelId, setSelectedModelId] = useState("AUTO"),
    [prompt, setPrompt] = useState(""),
    [duration, setDuration] = useState(60),
    [format, setFormat] = useState("mp3"),
    [instrumental, setInstrumental] = useState(true),
    [seed, setSeed] = useState<number | "">(""),
    [openCard, setOpenCard] = useState<OpenCard>(null),
    [mobileActiveCount, setMobileActiveCount] = useState(0);
  const [generation, setGeneration] = useState<Generation | null>(null),
    [quoteData, setQuoteData] = useState<UniversalCreationQuote | null>(null),
    [currentAsset, setCurrentAsset] = useState<Asset | null>(null),
    [busy, setBusy] = useState("load"),
    [error, setError] = useState(""),
    [pollCount, setPollCount] = useState(0);
  const loadCurrentAsset = useCallback(async (assetId?: string) => {
    if (!assetId) return setCurrentAsset(null);
    const rows = await assetService
      .listAssets({ type: "AUDIO", origin: "GENERATED" })
      .catch(() => []);
    setCurrentAsset(rows.find((asset) => asset.asset_id === assetId) || null);
  }, []);
  const load = useCallback(async () => {
    setBusy((current) => current || "load");
    setError("");
    try {
      const available = await universalGenerationClient.catalog("music");
      setModels(available);
      setSelectedModelId((current) =>
        current === "AUTO" ||
        available.some((model) => model.model_id === current)
          ? current
          : "AUTO",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy((current) => (current === "load" ? "" : current));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const model = useMemo(
    () => models.find((item) => item.model_id === selectedModelId) || null,
    [models, selectedModelId],
  );
  const routeReady = models.length > 0;
  const durations = useMemo(() => {
    const source =
      selectedModelId === "AUTO"
        ? models.flatMap((item) => item.supported_durations || [])
        : model?.supported_durations || [];
    const clean = Array.from(
      new Set<number>(
        source
          .map(Number)
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    ).sort((a, b) => a - b);
    const allowed = new Set(clean),
      preferred = PREFERRED_DURATIONS.filter((value) => allowed.has(value));
    return preferred.length ? preferred : clean;
  }, [selectedModelId, models, model]);
  const supportsSeed =
    selectedModelId === "AUTO"
      ? models.some((item) => item.supports_seed)
      : model?.supports_seed === true;
  const supportsFormat =
    selectedModelId === "AUTO"
      ? models.some((item) =>
          Array.isArray(item.supported_controls?.supported_output_formats),
        )
      : Array.isArray(model?.supported_controls?.supported_output_formats);
  useEffect(() => {
    if (durations.length && !durations.includes(duration))
      setDuration(durations.includes(60) ? 60 : durations[0]);
  }, [durations, duration]);
  const supportsInstrumental =
    selectedModelId === "AUTO"
      ? models.some(
          (item) => item.supported_controls?.supports_instrumental === true,
        )
      : model?.supported_controls?.supports_instrumental === true;
  const request = () => ({
    model_id: selectedModelId,
    capability_id: "music",
    prompt: prompt.trim(),
    references: [],
    controls: {
      duration_seconds: durations.length ? duration : undefined,
      instrumental: supportsInstrumental ? instrumental : undefined,
      output_format: supportsFormat ? format : undefined,
      seed: supportsSeed ? (seed === "" ? null : seed) : undefined,
    },
  });
  const invalidate = () => {
    setGeneration(null);
    setQuoteData(null);
    setCurrentAsset(null);
    setPollCount(0);
    setError("");
  };
  useEffect(() => {
    if (!generation || terminal(generation.status) || pollCount >= 160) return;
    const timer = window.setTimeout(
      async () => {
        try {
          setGeneration(
            await universalGenerationClient.get(generation.generation_id),
          );
          setPollCount((value) => value + 1);
        } catch (err) {
          setError(message(err));
          setPollCount(160);
        }
      },
      Math.min(6500, 1800 + pollCount * 120),
    );
    return () => window.clearTimeout(timer);
  }, [generation, pollCount]);
  useEffect(() => {
    if (generation?.status !== "SUCCEEDED") return;
    void refreshWallet();
    const assetId = generation.result_asset_ids?.[0];
    void loadCurrentAsset(assetId);
    const timer = window.setTimeout(() => void loadCurrentAsset(assetId), 900);
    window.dispatchEvent(
      new CustomEvent("creations:updated", {
        detail: { kind: "MUSIC", asset_ids: generation.result_asset_ids || [] },
      }),
    );
    return () => window.clearTimeout(timer);
  }, [
    generation?.status,
    generation?.result_asset_ids,
    loadCurrentAsset,
    refreshWallet,
  ]);
  const quote = async () => {
    if (!prompt.trim()) return setError("Descreva a música que deseja criar.");
    if (!routeReady)
      return setError("Nenhum modelo com Route READY está disponível agora.");
    setBusy("quote");
    setError("");
    setGeneration(null);
    setCurrentAsset(null);
    try {
      setQuoteData(await universalGenerationClient.quote(request()));
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
        await universalGenerationClient.create(request(), quoteData),
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
        : generation?.status === "PROCESSING"
          ? "Processando"
          : generation?.status === "QUEUED"
            ? "Na fila"
            : quoteData
              ? "Preço calculado"
              : "Preparando";
  const footer = !quoteData
    ? {
        label: "Calcular créditos",
        disabled: Boolean(busy) || !prompt.trim() || !routeReady,
        onClick: quote,
        secondary: undefined as string | undefined,
        onSecondary: undefined as (() => void) | undefined,
      }
    : {
        label: !generation ? "Gerar música" : status,
        disabled: Boolean(busy) || insufficient || Boolean(generation),
        onClick: generate,
        secondary: !generation ? "Atualizar" : undefined,
        onSecondary: !generation ? quote : undefined,
      };
  const creator = (
    <GeneratorPanel ariaLabel="Gerador de música">
      <GeneratorScroll>
        <UniversalModelPicker
          models={models}
          selectedModelId={selectedModelId}
          loading={busy === "load"}
          onSelect={(modelId) => {
            setSelectedModelId(modelId);
            invalidate();
          }}
        />
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
          label="Descrição da música"
          placeholder="Ex.: trilha cinematográfica emocional, piano suave, cordas crescendo, sem vocais…"
          showImproveButton={false}
        />
        <div className="space-y-1.5">
          {durations.length > 0 && (
            <GeneratorSettingRow
              icon={Clock3}
              label="Duração"
              value={`${duration}s`}
              open={openCard === "duration"}
              onToggle={() =>
                setOpenCard(openCard === "duration" ? null : "duration")
              }
              semantic="duration"
            >
              <GeneratorDiscreteSlider
                values={durations}
                value={duration}
                onChange={(value) => {
                  setDuration(value);
                  invalidate();
                }}
                suffix="s"
                subtitle="duração da música"
              />
            </GeneratorSettingRow>
          )}
          {supportsFormat && (
            <GeneratorSettingRow
              icon={FileAudio}
              label="Formato"
              value={format.toUpperCase()}
              open={openCard === "format"}
              onToggle={() =>
                setOpenCard(openCard === "format" ? null : "format")
              }
              semantic="resolution"
            >
              <GeneratorOptionGrid
                values={[
                  { value: "mp3", label: "MP3" },
                  { value: "wav", label: "WAV" },
                ]}
                current={format}
                onSelect={(value) => {
                  setFormat(value);
                  invalidate();
                }}
              />
            </GeneratorSettingRow>
          )}
          {supportsSeed && (
            <GeneratorSettingRow
              icon={Hash}
              label="Seed"
              value={seed === "" ? "Automática" : String(seed)}
              open={openCard === "seed"}
              onToggle={() => setOpenCard(openCard === "seed" ? null : "seed")}
            >
              <div className="rounded-lg border border-white/[0.06] bg-black/15 p-2">
                <input
                  type="number"
                  min="0"
                  value={seed}
                  onChange={(event) => {
                    setSeed(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    );
                    invalidate();
                  }}
                  placeholder="Automática"
                  className="w-full bg-transparent text-[10px] text-white outline-none placeholder:text-zinc-700"
                />
              </div>
            </GeneratorSettingRow>
          )}
        </div>
        {supportsInstrumental && (
          <GeneratorToggle
            checked={instrumental}
            onChange={(value) => {
              setInstrumental(value);
              invalidate();
            }}
            label="Instrumental"
            description={
              instrumental
                ? "Gerar sem vocais."
                : "Permitir vocais quando o modelo suportar."
            }
          />
        )}
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
              <Disc3
                className={`w-4 h-4 text-cyan-300 ${generation && !terminal(generation.status) ? "is-spin-slow" : ""}`}
              />
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
            {generation?.status === "SUCCEEDED" && currentAsset?.public_url && (
              <audio
                controls
                preload="metadata"
                src={currentAsset.public_url}
                className="mt-2 w-full h-9"
              />
            )}
            {generation?.status === "FAILED" && (
              <p>
                {generation.error_message || "A música não pôde ser gerada."}
              </p>
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
          defaultFilter="MUSIC"
          title="Minhas criações"
          subtitle="Todo o histórico de criações do seu studio."
          onActiveCountChange={setMobileActiveCount}
        />
      }
    />
  );
};
export default MusicCreateView;

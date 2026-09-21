import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileAudio, Languages, Volume2 } from "lucide-react";
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
  GeneratorFooter,
  GeneratorOptionGrid,
  GeneratorPanel,
  GeneratorScroll,
  GeneratorSettingRow,
} from "../workspace/GeneratorControls.js";
import { PromptComposer } from "../workspace/PromptComposer.js";
import { MobileStudioLayout } from "../workspace/MobileStudioLayout.js";

const VOICES = [
  { id: "calm-female", label: "Feminina calma" },
  { id: "wise-female", label: "Feminina madura" },
  { id: "friendly", label: "Amigável" },
  { id: "casual-male", label: "Masculina casual" },
];
const LANGUAGES = [
  { id: "auto", label: "Detectar automaticamente" },
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "es", label: "Espanhol" },
  { id: "fr", label: "Francês" },
  { id: "de", label: "Alemão" },
];
const FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
];
const terminal = (status?: string) =>
  ["SUCCEEDED", "FAILED", "CANCELLED"].includes(String(status || ""));
const message = (error: any) =>
  error instanceof ApiError
    ? error.message
    : error?.message || "Não foi possível concluir esta operação.";
type OpenCard = "voice" | "language" | "format" | null;

export const VoiceCreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>([]),
    [selectedModelId, setSelectedModelId] = useState("AUTO"),
    [text, setText] = useState(""),
    [voice, setVoice] = useState("calm-female"),
    [language, setLanguage] = useState("auto"),
    [format, setFormat] = useState("mp3"),
    [openCard, setOpenCard] = useState<OpenCard>(null),
    [mobileActiveCount, setMobileActiveCount] = useState(0);
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
      const available =
        await universalGenerationClient.catalog("text-to-speech");
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
  const selectedModel = useMemo(
    () => models.find((model) => model.model_id === selectedModelId) || null,
    [models, selectedModelId],
  );
  const selectedCandidates =
    selectedModelId === "AUTO" ? models : selectedModel ? [selectedModel] : [];
  const supportedValues = (key: string): string[] =>
    Array.from(
      new Set<string>(
        selectedCandidates.flatMap((item) => {
          const value = item.supported_controls?.[key];
          return Array.isArray(value) ? value.map(String) : [];
        }),
      ),
    );
  const voices = supportedValues("supported_voices");
  const languages = supportedValues("supported_languages");
  const formats = supportedValues("supported_output_formats");
  const selectedVoice = voices.includes(voice) ? voice : voices[0];
  const selectedLanguage = languages.includes(language) ? language : languages[0];
  const selectedFormat = formats.includes(format) ? format : formats[0];
  const routeReady = models.length > 0;
  const request = () => ({
    model_id: selectedModelId,
    capability_id: "text-to-speech",
    prompt: text.trim(),
    references: [],
    controls: {
      language: selectedLanguage,
      voice: selectedVoice,
      output_format: selectedFormat,
    },
  });
  const invalidate = () => {
    setGeneration(null);
    setQuoteData(null);
    setResult(null);
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
    let disposed = false;
    const sync = async () => {
      void refreshWallet();
      const resultId = generation.result_asset_ids?.[0];
      if (resultId) {
        const rows = await assetService
          .listAssets({ type: "AUDIO", origin: "GENERATED" })
          .catch(() => []);
        if (!disposed)
          setResult(rows.find((asset) => asset.asset_id === resultId) || null);
      }
      window.dispatchEvent(
        new CustomEvent("creations:updated", {
          detail: {
            kind: "VOICE",
            asset_ids: generation.result_asset_ids || [],
          },
        }),
      );
    };
    void sync();
    const timer = window.setTimeout(() => void sync(), 900);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [generation?.status, generation?.result_asset_ids, refreshWallet]);
  const quote = async () => {
    if (!text.trim()) return setError("Digite o texto que será narrado.");
    if (!routeReady)
      return setError("Nenhum modelo com Route READY está disponível agora.");
    setBusy("quote");
    setError("");
    setGeneration(null);
    setResult(null);
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
  const currentVoice = VOICES.find((item) => item.id === selectedVoice)?.label || selectedVoice,
    currentLanguage =
      LANGUAGES.find((item) => item.id === selectedLanguage)?.label || selectedLanguage;
  const footer = !quoteData
    ? {
        label: "Calcular créditos",
        disabled: Boolean(busy) || !text.trim() || !routeReady,
        onClick: quote,
        secondary: undefined as string | undefined,
        onSecondary: undefined as (() => void) | undefined,
      }
    : {
        label: !generation ? "Gerar voz" : status,
        disabled: Boolean(busy) || insufficient || Boolean(generation),
        onClick: generate,
        secondary: !generation ? "Atualizar" : undefined,
        onSecondary: !generation ? quote : undefined,
      };
  const creator = (
    <GeneratorPanel ariaLabel="Gerador de voz">
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
          prompt={text}
          onChangePrompt={(value) => {
            setText(value);
            invalidate();
          }}
          negativePrompt=""
          onChangeNegativePrompt={() => {}}
          onOpenImproveModal={() => {}}
          references={[]}
          onRequestAddMedia={() => {}}
          supportsNegativePrompt={false}
          supportsReferences={false}
          maxChars={12000}
          label="Texto"
          placeholder="Digite o texto que deseja transformar em voz…"
          showImproveButton={false}
        />
        <div className="space-y-1.5">
          {voices.length > 0 && <GeneratorSettingRow
            icon={Volume2}
            label="Voz"
            value={currentVoice}
            open={openCard === "voice"}
            onToggle={() => setOpenCard(openCard === "voice" ? null : "voice")}
          >
            <GeneratorOptionGrid
              values={voices.map((id) => ({value:id,label:VOICES.find(item=>item.id===id)?.label||id}))}
              current={selectedVoice}
              onSelect={(value) => {
                setVoice(value);
                invalidate();
              }}
            />
          </GeneratorSettingRow>}
          {languages.length > 0 && <GeneratorSettingRow
            icon={Languages}
            label="Idioma"
            value={currentLanguage}
            open={openCard === "language"}
            onToggle={() =>
              setOpenCard(openCard === "language" ? null : "language")
            }
          >
            <GeneratorOptionGrid
              values={languages.map((id) => ({value:id,label:LANGUAGES.find(item=>item.id===id)?.label||id}))}
              current={selectedLanguage}
              onSelect={(value) => {
                setLanguage(value);
                invalidate();
              }}
            />
          </GeneratorSettingRow>}
          {formats.length > 0 && <GeneratorSettingRow
            icon={FileAudio}
            label="Formato"
            value={selectedFormat.toUpperCase()}
            open={openCard === "format"}
            onToggle={() =>
              setOpenCard(openCard === "format" ? null : "format")
            }
            semantic="resolution"
          >
            <GeneratorOptionGrid
              values={formats.map((id)=>({value:id,label:FORMATS.find(item=>item.value===id)?.label||id.toUpperCase()}))}
              current={selectedFormat}
              onSelect={(value) => {
                setFormat(value);
                invalidate();
              }}
            />
          </GeneratorSettingRow>}
        </div>
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
              <Volume2 className="w-4 h-4 text-cyan-300" />
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
            {generation?.status === "SUCCEEDED" && result?.public_url && (
              <audio
                controls
                preload="metadata"
                src={result.public_url}
                className="mt-2 w-full h-9"
              />
            )}
            {generation?.status === "FAILED" && (
              <p>{generation.error_message || "A voz não pôde ser gerada."}</p>
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
          defaultFilter="VOICE"
          title="Minhas criações"
          subtitle="Todo o histórico de criações do seu studio."
          onActiveCountChange={setMobileActiveCount}
        />
      }
    />
  );
};
export default VoiceCreateView;

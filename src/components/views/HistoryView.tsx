import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { Generation } from "../../types/index.js";
import { universalGenerationClient } from "../../services/universalGenerationClient.js";
import { assetService } from "../../services/assetService.js";
import { ResilientImage } from "../common/ResilientImage.js";
import { mediaStorageErrorMessage } from "../../utils/mediaStorageStatus.js";

const credits = (value?: number) =>
  `${Math.max(0, Number(value || 0)).toLocaleString("pt-BR")} créditos`;
const isImage = (generation: Generation) =>
  generation.mode === "TEXT_TO_IMAGE" || generation.mode === "IMAGE_TO_IMAGE";
const previewUrls = (generation: Generation) => {
  const durableUrls = [generation.result_url, ...(generation.result_urls || [])];
  const candidateUrls =
    generation.media_storage_status === "PENDING"
      ? [...(generation.pending_result_urls || []), ...durableUrls]
      : durableUrls;
  return Array.from(new Set(candidateUrls.filter(Boolean).map(String)));
};

export const HistoryView: React.FC = () => {
  const [items, setItems] = useState<Generation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [recoveryCursor, setRecoveryCursor] = useState(0),
    [recoveryDone, setRecoveryDone] = useState(false),
    [recovering, setRecovering] = useState(false),
    [recoveryMessage, setRecoveryMessage] = useState("");
  const load = () =>
    universalGenerationClient
      .list()
      .then(setItems)
      .catch((err) => setError(err?.message || "Falha ao carregar histórico."))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const recover = async () => {
    setRecovering(true);
    setRecoveryMessage("");
    try {
      const result = await assetService.recoverLegacyGeneratedHistory(
        recoveryCursor,
        5,
      );
      setRecoveryCursor(result.next_cursor ?? recoveryCursor);
      setRecoveryDone(result.done);
      setRecoveryMessage(
        `${result.recovered} imagem(ns) recuperada(s) · ${result.unavailable} indisponível(is) · ${result.processed} registro(s) verificado(s).`,
      );
      await load();
    } catch (err: any) {
      setRecoveryMessage(err?.message || "A recuperação não foi concluída.");
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="ia-history space-y-7 pb-10">
      <header className="ia-view-header">
        <div>
          <h1 className="ia-view-title">Histórico</h1>
          <p className="ia-view-description">
            Resultados, status e créditos das suas gerações.
          </p>
        </div>
        <button
          type="button"
          onClick={recover}
          disabled={recovering || recoveryDone}
          className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 text-[10px] font-bold text-zinc-200 hover:bg-white/[0.07] disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${recovering ? "animate-spin" : ""}`}
          />
          {recovering
            ? "Recuperando…"
            : recoveryDone
              ? "Recuperação concluída"
              : "Recuperar imagens antigas"}
        </button>
      </header>
      {recoveryMessage && (
        <p
          role="status"
          className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[10px] text-zinc-400"
        >
          {recoveryMessage}
        </p>
      )}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--ia-text-3)]" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="ia-dashboard-empty py-20">
          <Clock className="mx-auto mb-3 h-7 w-7 text-[var(--ia-text-4)]" />
          <p className="font-medium text-[var(--ia-text-1)]">
            Nenhuma geração ainda
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((generation) => {
            const urls = previewUrls(generation),
              previewUrl = urls[0],
              storagePending = generation.media_storage_status === "PENDING";
            return (
              <article
                key={generation.generation_id}
                className="ia-history-row"
              >
                <div className="ia-history-media">
                  {previewUrl ? (
                    isImage(generation) ? (
                      <ResilientImage
                        sources={[...urls, generation.thumbnail_url]}
                        alt="Prévia da geração"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : generation.status === "SUCCEEDED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : generation.status === "FAILED" ? (
                    <AlertCircle className="h-5 w-5 text-rose-400" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--ia-text-3)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-[var(--ia-text-1)]">
                      {generation.model_id}
                    </p>
                    <span className="ia-badge">
                      {storagePending ? "SALVANDO MÍDIA" : generation.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-[var(--ia-text-3)]">
                    {generation.original_prompt || "Sem prompt"}
                  </p>
                  {storagePending && (
                    <p
                      role="status"
                      className="mt-1 max-w-3xl text-[10px] leading-relaxed text-amber-300"
                    >
                      {`ERRO DE ARMAZENAMENTO: ${mediaStorageErrorMessage(generation.media_storage_error_code)}`}{" "}
                      {previewUrl
                        ? "A prévia depende de uma URL temporária do provedor e pode expirar."
                        : "Ainda não há uma prévia disponível."}{" "}
                      O sistema continuará tentando arquivar o resultado automaticamente.{" "}
                      {`Os ${credits(generation.retail_credit_price)} ficam reservados até o salvamento terminar.`}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-[var(--ia-text-4)]">
                    {[
                      generation.duration_seconds
                        ? `${generation.duration_seconds}s`
                        : null,
                      generation.resolution || null,
                      new Date(generation.created_at).toLocaleString("pt-BR"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-semibold text-[var(--ia-text-2)]">
                    {storagePending
                      ? `Em reserva · ${credits(generation.retail_credit_price)}`
                      : credits(
                          generation.final_credit_cost ??
                            generation.retail_credit_price,
                        )}
                  </p>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {storagePending ? "Abrir prévia temporária" : "Abrir"}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

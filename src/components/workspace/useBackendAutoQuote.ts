import { useEffect, useMemo, useState } from "react";
import {
  universalGenerationClient,
  type UniversalCreationQuote,
  type UniversalCreationRequest,
} from "../../services/universalGenerationClient.js";
import type { ModelRegistryItem } from "../../types/index.js";

type QuoteState = {
  key: string;
  quote: UniversalCreationQuote | null;
  error: string | null;
};

/** AUTO is resolved exclusively by the Routing V2 universal quote endpoint. */
export function useBackendAutoQuote(
  enabled: boolean,
  request: UniversalCreationRequest | null,
  models: ModelRegistryItem[],
) {
  const key =
    enabled && models.length > 0 && request?.prompt.trim()
      ? JSON.stringify(request)
      : "";
  const [state, setState] = useState<QuoteState>({
    key: "",
    quote: null,
    error: null,
  });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const quote = await universalGenerationClient.quote(
          JSON.parse(key) as UniversalCreationRequest,
        );
        if (!cancelled) setState({ key, quote, error: null });
      } catch (error) {
        if (!cancelled)
          setState({
            key,
            quote: null,
            error:
              error instanceof Error
                ? error.message
                : "Cotação indisponível.",
          });
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  const quote = key && state.key === key ? state.quote : null;
  const model = useMemo(
    () =>
      models.find((item) => item.model_id === quote?.resolved_model_id) || null,
    [models, quote?.resolved_model_id],
  );
  return {
    quote,
    model,
    loading: Boolean(key && state.key !== key),
    error: key && state.key === key ? state.error : null,
  };
}

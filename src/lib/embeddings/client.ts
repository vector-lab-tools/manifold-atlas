/**
 * Client-side embedding function.
 *
 * For most providers, calls the /api/embed Next.js route which proxies
 * to the provider API server-side (keeps API keys out of the client
 * request, lets us add provider-specific quirks in one place).
 *
 * For Ollama, calls the user's Ollama instance **directly from the
 * browser**. Routing Ollama through /api/embed would mean a deployed
 * Atlas (Vercel, GitHub Pages) tried to reach localhost:11434 from
 * the server, which is the Vercel container's loopback, not the
 * user's machine — so deployed Atlas could never reach a user's local
 * Ollama. Browser-direct works because the browser resolves localhost
 * to the user's own machine. The trade-off is CORS: Ollama's default
 * same-origin policy must be loosened with OLLAMA_ORIGINS to include
 * the page's origin. The Settings panel's OllamaSetupHelp component
 * surfaces the exact command. (Mirrors the LLMbench v2.15.34 pattern.)
 *
 * On 429 rate limit, throws a RateLimitError with the wait time.
 */

import type { EmbeddingProviderId, EmbedResponse } from "@/types/embeddings";
import { embedOllama } from "./providers/ollama";

export class RateLimitError extends Error {
  public waitSeconds: number;
  public provider: string;
  constructor(message: string, waitSeconds: number, provider: string) {
    super(message);
    this.waitSeconds = waitSeconds;
    this.provider = provider;
  }
}

/**
 * Browser-direct Ollama call with friendly error mapping. CORS,
 * connection-refused, and HTTP-status failures all surface as
 * actionable messages rather than the generic "Failed to fetch" the
 * browser raises by default.
 */
async function fetchEmbeddingsOllamaBrowserDirect(
  model: string,
  texts: string[],
  baseUrl: string
): Promise<EmbedResponse> {
  const url = baseUrl.replace(/\/$/, "");
  try {
    const vectors = await embedOllama(texts, model, url);
    return {
      vectors,
      model,
      dimensions: vectors[0]?.length ?? 0,
    };
  } catch (err) {
    const original = err instanceof Error ? err.message : String(err);
    // The browser raises a generic TypeError("Failed to fetch") for
    // both CORS blocks and connection-refused. Disambiguate via the
    // page's origin: if we're on a non-localhost origin and the call
    // failed, almost certainly CORS.
    const isBrowser = typeof window !== "undefined";
    const onLocalhost =
      isBrowser &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0");
    const looksLikeNetworkError =
      /failed to fetch|networkerror|load failed/i.test(original);
    if (looksLikeNetworkError) {
      if (!onLocalhost) {
        throw new Error(
          `Cannot reach Ollama at ${url} from ${window.location.origin}. This is almost certainly a CORS block — start Ollama with OLLAMA_ORIGINS="${window.location.origin},http://localhost:3000,http://127.0.0.1:3000" ollama serve so it accepts requests from this page. The Settings panel shows the exact command. (Safari blocks HTTPS pages from calling http://localhost regardless of CORS — use Chrome / Firefox / Edge from a deployed Atlas.)`
        );
      }
      throw new Error(
        `Cannot reach Ollama at ${url}. Is it running? Start it with: ollama serve`
      );
    }
    throw err;
  }
}

export async function fetchEmbeddings(
  provider: EmbeddingProviderId,
  model: string,
  texts: string[],
  apiKey: string,
  baseUrl?: string
): Promise<EmbedResponse> {
  // Ollama path: browser-direct so deployed Atlas can reach a user's
  // local Ollama (subject to OLLAMA_ORIGINS on the Ollama side).
  if (provider === "ollama") {
    return fetchEmbeddingsOllamaBrowserDirect(
      model,
      texts,
      baseUrl || "http://localhost:11434"
    );
  }

  const response = await fetch("/api/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Embed-API-Key": apiKey,
    },
    body: JSON.stringify({ provider, model, texts, baseUrl }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || `API error: ${response.status}`;

    if (response.status === 429) {
      // Extract retry delay
      let waitSeconds = 35;
      const match = message.match(/retry in ([\d.]+)s/i);
      if (match) waitSeconds = Math.ceil(Number(match[1]));
      const retryHeader = response.headers.get("Retry-After");
      if (retryHeader) waitSeconds = Math.ceil(Number(retryHeader)) || 35;
      throw new RateLimitError(message, waitSeconds, provider);
    }

    throw new Error(message);
  }

  return response.json();
}

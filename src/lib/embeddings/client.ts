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
  // Sanity guard: this function must run in the browser. If we somehow
  // land here on the server, fall through to the API-route path —
  // because a server-side fetch to localhost from a deployed Atlas will
  // fail with undici's "fetch failed" message and the user has no way
  // to read it as a CORS hint.
  if (typeof window === "undefined") {
    throw new Error(
      "Ollama browser-direct path was invoked on the server; this is a bug. " +
      "The browser must call Ollama directly so the request reaches the user's machine, " +
      "not the deployment's container."
    );
  }
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
    const onLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0";
    // Browsers and various fetch implementations raise different generic
    // messages for what is almost always either CORS or connection-
    // refused: Chrome "Failed to fetch", Firefox "NetworkError",
    // Safari "Load failed", Node/undici "fetch failed", some wrappers
    // "Network request failed" / "TypeError: fetch". Match permissively.
    const looksLikeNetworkError =
      /failed to fetch|fetch failed|networkerror|load failed|network request failed|^typeerror/i.test(
        original
      );
    if (looksLikeNetworkError) {
      if (!onLocalhost) {
        throw new Error(
          `Cannot reach Ollama at ${url} from ${window.location.origin}. ` +
          `This is almost certainly a CORS block — start Ollama with ` +
          `OLLAMA_ORIGINS="${window.location.origin},http://localhost:3000,http://127.0.0.1:3000" ollama serve ` +
          `so it accepts requests from this page. The Settings panel shows the exact command. ` +
          `(Safari blocks HTTPS pages from calling http://localhost regardless of CORS — use ` +
          `Chrome / Firefox / Edge from a deployed Atlas.)`
        );
      }
      throw new Error(
        `Cannot reach Ollama at ${url}. Is it running? Start it with: ollama serve`
      );
    }
    // Anything else (e.g. HTTP 4xx/5xx with a real response body) bubbles
    // up unchanged so the actual Ollama error reaches the user.
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
    if (typeof window !== "undefined") {
      // One-time diagnostic so DevTools confirms the browser-direct path
      // is in use. Easy to remove once we trust the routing.
      // eslint-disable-next-line no-console
      console.debug(
        "[manifold-atlas] Ollama: browser-direct call",
        { model, baseUrl: baseUrl || "http://localhost:11434", textCount: texts.length }
      );
    }
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

// Embedding provider and model types

export type EmbeddingProviderId =
  | "openai"
  | "voyage"
  | "google"
  | "cohere"
  | "huggingface"
  | "ollama"
  | "openai-compatible";

export interface EmbeddingModelSpec {
  id: string;
  name: string;
  providerId: EmbeddingProviderId;
  dimensions: number;
}

export interface EmbeddingProviderConfig {
  id: EmbeddingProviderId;
  name: string;
  description: string;
  requiresApiKey: boolean;
  baseUrlConfigurable: boolean;
  defaultBaseUrl?: string;
  signupUrl?: string;
  models: EmbeddingModelSpec[];
}

// Model lists are loaded dynamically from public/models/{provider}.md
// Edit those files to add or remove models without touching source code.
export const EMBEDDING_MODELS: EmbeddingModelSpec[] = [];

export const EMBEDDING_PROVIDERS: Record<EmbeddingProviderId, EmbeddingProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    signupUrl: "https://platform.openai.com/",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "openai"),
  },
  voyage: {
    id: "voyage",
    name: "Voyage AI",
    description: "Voyage AI embedding models, recommended by Anthropic for use with Claude",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    signupUrl: "https://www.voyageai.com/",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "voyage"),
  },
  google: {
    id: "google",
    name: "Google (Gemini)",
    description: "Google Gemini embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    signupUrl: "https://ai.google.dev/",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "google"),
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    description: "Cohere embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    signupUrl: "https://cohere.com/",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "cohere"),
  },
  huggingface: {
    id: "huggingface",
    name: "Hugging Face (Free)",
    description: "Free embedding models via Hugging Face Inference API. Get a free token from Settings > Access Tokens.",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    signupUrl: "https://huggingface.co/settings/tokens",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "huggingface"),
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Embeds via an Ollama instance you run yourself. The default base URL http://localhost:11434 works out of the box when Manifold Atlas is running locally (npm run dev). To use the same local Ollama from the hosted build at vector-lab-tools.github.io or a Vercel preview, start Ollama with OLLAMA_ORIGINS=* set in its environment so it accepts CORS requests from any origin (e.g. OLLAMA_ORIGINS=* ollama serve, or set it in launchctl on macOS / the systemd unit on Linux). Modern browsers treat localhost as a secure context, so the deployed page can then reach your local Ollama directly. The base-URL field is also configurable, so the same provider entry can be pointed at a remote Ollama endpoint or an Ollama Cloud endpoint when those are available.",
    requiresApiKey: false,
    baseUrlConfigurable: true,
    defaultBaseUrl: "http://localhost:11434",
    models: EMBEDDING_MODELS.filter(m => m.providerId === "ollama"),
  },
  "openai-compatible": {
    id: "openai-compatible",
    name: "OpenAI-Compatible (OpenRouter)",
    description: "OpenRouter or any API compatible with OpenAI embedding format",
    requiresApiKey: true,
    baseUrlConfigurable: true,
    signupUrl: "https://openrouter.ai/",
    models: [{ id: "custom", name: "Custom Model", providerId: "openai-compatible", dimensions: 0 }],
  },
};

// API request/response types
export interface EmbedRequest {
  provider: EmbeddingProviderId;
  model: string;
  texts: string[];
}

export interface EmbedResponse {
  vectors: number[][];
  model: string;
  dimensions: number;
}

// Operation result types
export interface ConceptDistanceResult {
  termA: string;
  termB: string;
  similarities: Array<{
    modelId: string;
    modelName: string;
    providerId: EmbeddingProviderId;
    cosineSimilarity: number;
  }>;
}

export interface NeighbourhoodPoint {
  label: string;
  x: number;
  y: number;
  z?: number;
  isSeed: boolean;
}

export interface NeighbourhoodMapResult {
  seed: string;
  terms: string[];
  projections: Array<{
    modelId: string;
    modelName: string;
    providerId: EmbeddingProviderId;
    points: NeighbourhoodPoint[];
    method: "pca" | "umap";
    dimensions: 2 | 3;
  }>;
}

export interface NegationResult {
  original: string;
  negated: string;
  results: Array<{
    modelId: string;
    modelName: string;
    providerId: EmbeddingProviderId;
    cosineSimilarity: number;
    collapsed: boolean;
  }>;
}

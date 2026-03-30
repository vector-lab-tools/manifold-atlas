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
  models: EmbeddingModelSpec[];
}

export const EMBEDDING_MODELS: EmbeddingModelSpec[] = [
  { id: "text-embedding-3-small", name: "OpenAI Small (1536d)", providerId: "openai", dimensions: 1536 },
  { id: "text-embedding-3-large", name: "OpenAI Large (3072d)", providerId: "openai", dimensions: 3072 },
  { id: "voyage-3", name: "Voyage 3 (1024d)", providerId: "voyage", dimensions: 1024 },
  { id: "voyage-3-large", name: "Voyage 3 Large (1024d)", providerId: "voyage", dimensions: 1024 },
  { id: "voyage-3.5", name: "Voyage 3.5 (1024d)", providerId: "voyage", dimensions: 1024 },
  { id: "gemini-embedding-001", name: "Gemini Embedding (3072d)", providerId: "google", dimensions: 3072 },
  { id: "embed-v3.0", name: "Cohere Embed v3 (1024d)", providerId: "cohere", dimensions: 1024 },
  { id: "sentence-transformers/all-MiniLM-L6-v2", name: "MiniLM-L6 (384d)", providerId: "huggingface", dimensions: 384 },
  { id: "BAAI/bge-small-en-v1.5", name: "BGE Small (384d)", providerId: "huggingface", dimensions: 384 },
  { id: "nomic-ai/nomic-embed-text-v1.5", name: "Nomic Embed v1.5 (768d)", providerId: "huggingface", dimensions: 768 },
  { id: "nomic-embed-text", name: "Nomic Embed Text", providerId: "ollama", dimensions: 768 },
  { id: "mxbai-embed-large", name: "mxbai Embed Large", providerId: "ollama", dimensions: 1024 },
  { id: "all-minilm", name: "All-MiniLM", providerId: "ollama", dimensions: 384 },
];

export const EMBEDDING_PROVIDERS: Record<EmbeddingProviderId, EmbeddingProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: EMBEDDING_MODELS.filter(m => m.providerId === "openai"),
  },
  voyage: {
    id: "voyage",
    name: "Voyage AI (Anthropic)",
    description: "Voyage AI embedding models, recommended by Anthropic",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: EMBEDDING_MODELS.filter(m => m.providerId === "voyage"),
  },
  google: {
    id: "google",
    name: "Google (Gemini)",
    description: "Google Gemini embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: EMBEDDING_MODELS.filter(m => m.providerId === "google"),
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    description: "Cohere embedding models",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: EMBEDDING_MODELS.filter(m => m.providerId === "cohere"),
  },
  huggingface: {
    id: "huggingface",
    name: "Hugging Face (Free)",
    description: "Free embedding models via Hugging Face Inference API. Sign up at huggingface.co and get a free token from Settings > Access Tokens.",
    requiresApiKey: true,
    baseUrlConfigurable: false,
    models: EMBEDDING_MODELS.filter(m => m.providerId === "huggingface"),
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run embedding models locally with Ollama",
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

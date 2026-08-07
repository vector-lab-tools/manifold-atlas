// Settings types for provider configuration
import type { EmbeddingProviderId } from "./embeddings";
import type { ThresholdMode } from "@/lib/calibration/threshold";
import {
  DEFAULT_THRESHOLD_MODE,
  DEFAULT_FLOOR_RELATIVE_K,
  LEGACY_FIXED_THRESHOLD,
} from "@/lib/calibration/threshold";

export interface ProviderSettings {
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  selectedModels: string[]; // model IDs to use
  customModelId?: string;
}

export interface AppSettings {
  providers: Record<EmbeddingProviderId, ProviderSettings>;
  rankedModels: string[]; // ordered model IDs: [0] = primary, [1] = secondary, etc. Empty = use all
  darkMode: boolean;
  /**
   * The stipulated collapse cutoff. Applies only when thresholdMode is
   * "fixed", and exists so runs made before the calibration layer can be
   * reproduced. See lib/calibration/threshold.ts.
   */
  negationThreshold: number;
  /**
   * How the collapse cutoff is derived. "control-derived" measures it
   * from each probe's own matched controls and is the default.
   */
  thresholdMode: ThresholdMode;
  /** Proportion of the floor-to-identity range used by floor-relative mode. */
  floorRelativeK: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  rankedModels: [],
  providers: {
    openai: {
      enabled: false,
      apiKey: "",
      selectedModels: ["text-embedding-3-small"],
    },
    voyage: {
      enabled: false,
      apiKey: "",
      selectedModels: ["voyage-3"],
    },
    google: {
      enabled: false,
      apiKey: "",
      selectedModels: ["gemini-embedding-001"],
    },
    cohere: {
      enabled: false,
      apiKey: "",
      selectedModels: ["embed-v3.0"],
    },
    huggingface: {
      enabled: false,
      apiKey: "",
      selectedModels: ["sentence-transformers/all-MiniLM-L6-v2"],
    },
    ollama: {
      enabled: false,
      apiKey: "",
      baseUrl: "http://localhost:11434",
      selectedModels: ["nomic-embed-text"],
    },
    "openai-compatible": {
      enabled: false,
      apiKey: "",
      baseUrl: "https://openrouter.ai/api",
      selectedModels: [],
      customModelId: "",
    },
  },
  darkMode: false,
  negationThreshold: LEGACY_FIXED_THRESHOLD,
  thresholdMode: DEFAULT_THRESHOLD_MODE,
  floorRelativeK: DEFAULT_FLOOR_RELATIVE_K,
};

export const STORAGE_KEY = "manifold-atlas-settings";

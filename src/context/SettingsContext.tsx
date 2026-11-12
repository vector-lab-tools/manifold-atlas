"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { AppSettings, ProviderSettings } from "@/types/settings";
import type { EmbeddingProviderId, EmbeddingModelSpec } from "@/types/embeddings";
import type { ThresholdMode } from "@/lib/calibration/threshold";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "@/types/settings";
import { EMBEDDING_PROVIDERS } from "@/types/embeddings";
import { loadAllProviderModels } from "@/lib/provider-models";

interface SettingsContextType {
  settings: AppSettings;
  updateProvider: (id: EmbeddingProviderId, updates: Partial<ProviderSettings>) => void;
  toggleDarkMode: () => void;
  setNegationThreshold: (threshold: number) => void;
  setThresholdMode: (mode: ThresholdMode) => void;
  setFloorRelativeK: (k: number) => void;
  setRankedModels: (ranked: string[]) => void;
  getEnabledModels: () => Array<EmbeddingModelSpec & { apiKey: string; baseUrl?: string }>;
  /** Registry models from /public/models/*.md with the user's own models merged in. */
  providerModels: Partial<Record<EmbeddingProviderId, EmbeddingModelSpec[]>>;
  /** Only the models the user added by hand, so the UI can offer to remove them. */
  customModels: Partial<Record<EmbeddingProviderId, EmbeddingModelSpec[]>>;
  addCustomModel: (id: EmbeddingProviderId, spec: Omit<EmbeddingModelSpec, "providerId">) => void;
  removeCustomModel: (id: EmbeddingProviderId, modelId: string) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

/**
 * Models the user typed in themselves, kept apart from the markdown registry.
 *
 * The registry ships with the build, so a model that is renamed or withdrawn
 * upstream can only be corrected by editing a file in the repository. Anyone on
 * the hosted app cannot do that, and would be left with a tool that lists
 * nothing it can still call. This key is the way out of that.
 */
const CUSTOM_MODELS_KEY = "manifold-atlas.custom-models";

/** Accepts a bare model id, or the registry's `id | Name | dimensions` form. */
export function parseCustomModelInput(
  raw: string,
  providerId: EmbeddingProviderId
): EmbeddingModelSpec | null {
  const parts = raw.split("|").map(s => s.trim());
  const id = parts[0];
  if (!id) return null;
  const dimensions = parts[2] ? parseInt(parts[2], 10) : 0;
  return {
    id,
    name: parts[1] || id,
    providerId,
    dimensions: Number.isFinite(dimensions) ? dimensions : 0,
  };
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [registryModels, setProviderModels] = useState<Partial<Record<EmbeddingProviderId, EmbeddingModelSpec[]>>>({});
  const [customModels, setCustomModels] = useState<Partial<Record<EmbeddingProviderId, EmbeddingModelSpec[]>>>({});

  // Custom models load before the registry fetch resolves, so a user who has
  // added their own still sees them if /models/*.md cannot be reached at all.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_MODELS_KEY);
      if (stored) setCustomModels(JSON.parse(stored));
    } catch (e) {
      console.warn("Could not read custom models:", e);
    }
  }, []);

  const addCustomModel = useCallback(
    (pid: EmbeddingProviderId, spec: Omit<EmbeddingModelSpec, "providerId">) => {
      setCustomModels(prev => {
        const existing = prev[pid] ?? [];
        if (existing.some(m => m.id === spec.id)) return prev;
        const next = { ...prev, [pid]: [...existing, { ...spec, providerId: pid }] };
        try {
          localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Could not save custom model:", e);
        }
        return next;
      });
    },
    []
  );

  const removeCustomModel = useCallback((pid: EmbeddingProviderId, modelId: string) => {
    setCustomModels(prev => {
      const next = { ...prev, [pid]: (prev[pid] ?? []).filter(m => m.id !== modelId) };
      try {
        localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Could not remove custom model:", e);
      }
      return next;
    });
  }, []);

  // What the rest of the app sees. A custom model with the same id as a registry
  // entry replaces it, so a stale shipped dimension or display name can be
  // corrected without editing the repository.
  const providerModels = useMemo(() => {
    const merged: Partial<Record<EmbeddingProviderId, EmbeddingModelSpec[]>> = {};
    const ids = new Set([
      ...Object.keys(registryModels),
      ...Object.keys(customModels),
    ]) as Set<EmbeddingProviderId>;
    for (const pid of ids) {
      const custom = customModels[pid] ?? [];
      const overridden = new Set(custom.map(m => m.id));
      merged[pid] = [
        ...(registryModels[pid] ?? []).filter(m => !overridden.has(m.id)),
        ...custom,
      ];
    }
    return merged;
  }, [registryModels, customModels]);

  // Load from localStorage + .env.local fallback on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const mergedProviders = { ...DEFAULT_SETTINGS.providers };
        let parsed: Record<string, unknown> = {};

        if (stored) {
          parsed = JSON.parse(stored);
          if (parsed.providers) {
            for (const [key, val] of Object.entries(parsed.providers as Record<string, unknown>)) {
              if (key in mergedProviders) {
                mergedProviders[key as keyof typeof mergedProviders] = {
                  ...mergedProviders[key as keyof typeof mergedProviders],
                  ...(val as object),
                };
              }
            }
          }
        }

        // Load saved API keys from .env.local as fallback
        try {
          const res = await fetch("/api/keys");
          if (res.ok) {
            const savedKeys: Record<string, string> = await res.json();
            for (const [providerId, apiKey] of Object.entries(savedKeys)) {
              if (providerId === "openai-compatible-baseurl") {
                // Base URL for OpenAI-compatible
                if (mergedProviders["openai-compatible"] && !mergedProviders["openai-compatible"].baseUrl) {
                  mergedProviders["openai-compatible"].baseUrl = apiKey;
                }
              } else if (providerId in mergedProviders) {
                const p = mergedProviders[providerId as keyof typeof mergedProviders];
                // Only apply if localStorage didn't already have a key
                if (p && !p.apiKey) {
                  p.apiKey = apiKey;
                }
              }
            }
          }
        } catch {
          // API route not available (e.g. static export) — ignore
        }

        setSettings(prev => ({ ...prev, ...parsed, providers: mergedProviders }));
      } catch (e) {
        console.warn("Failed to load settings:", e);
      }

      // Load model lists from markdown files for all providers
      const loaded = await loadAllProviderModels();
      if (Object.keys(loaded).length > 0) setProviderModels(loaded);

      setLoaded(true);
    };
    load();
  }, []);

  // Persist to localStorage + .env.local on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save settings:", e);
    }
    // Also persist API keys to .env.local
    try {
      const keys: Record<string, string> = {};
      for (const [id, provider] of Object.entries(settings.providers)) {
        if (provider.apiKey) keys[id] = provider.apiKey;
        if (id === "openai-compatible" && provider.baseUrl) {
          keys["openai-compatible-baseurl"] = provider.baseUrl;
        }
      }
      fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      }).catch(() => {}); // fire and forget
    } catch {
      // ignore
    }
  }, [settings, loaded]);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  const updateProvider = useCallback(
    (id: EmbeddingProviderId, updates: Partial<ProviderSettings>) => {
      setSettings(prev => ({
        ...prev,
        providers: {
          ...prev.providers,
          [id]: { ...prev.providers[id], ...updates },
        },
      }));
    },
    []
  );

  const toggleDarkMode = useCallback(() => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
  }, []);

  const setNegationThreshold = useCallback((threshold: number) => {
    setSettings(prev => ({ ...prev, negationThreshold: threshold }));
  }, []);

  const setThresholdMode = useCallback((mode: ThresholdMode) => {
    setSettings(prev => ({ ...prev, thresholdMode: mode }));
  }, []);

  const setFloorRelativeK = useCallback((k: number) => {
    setSettings(prev => ({ ...prev, floorRelativeK: k }));
  }, []);

  const setRankedModels = useCallback((ranked: string[]) => {
    setSettings(prev => ({ ...prev, rankedModels: ranked }));
  }, []);

  const getEnabledModels = useCallback(() => {
    const results: Array<EmbeddingModelSpec & { apiKey: string; baseUrl?: string }> = [];
    for (const [providerId, providerSettings] of Object.entries(settings.providers)) {
      if (!providerSettings.enabled) continue;
      const pid = providerId as EmbeddingProviderId;
      const provider = EMBEDDING_PROVIDERS[pid];
      if (!provider) continue;

      const modelPool = providerModels[pid] ?? provider.models;

      for (const modelId of providerSettings.selectedModels) {
        const model = modelPool.find(m => m.id === modelId);
        if (model) {
          results.push({
            ...model,
            apiKey: providerSettings.apiKey,
            baseUrl: providerSettings.baseUrl || provider.defaultBaseUrl,
          });
        } else if (pid === "openai-compatible" && providerSettings.customModelId) {
          results.push({
            id: providerSettings.customModelId,
            name: providerSettings.customModelId,
            providerId: pid,
            dimensions: 0,
            apiKey: providerSettings.apiKey,
            baseUrl: providerSettings.baseUrl,
          });
        }
      }
    }
    // If ranked models are set, return only those in rank order
    if (settings.rankedModels && settings.rankedModels.length > 0) {
      const ranked = settings.rankedModels
        .map(id => results.find(m => m.id === id))
        .filter((m): m is NonNullable<typeof m> => m !== undefined);
      if (ranked.length > 0) return ranked;
    }
    return results;
  }, [settings, providerModels]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateProvider,
        toggleDarkMode,
        setNegationThreshold,
        setThresholdMode,
        setFloorRelativeK,
        setRankedModels,
        getEnabledModels,
        providerModels,
        customModels,
        addCustomModel,
        removeCustomModel,
        settingsOpen,
        setSettingsOpen,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

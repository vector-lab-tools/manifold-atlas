"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { AppSettings, ProviderSettings } from "@/types/settings";
import type { EmbeddingProviderId, EmbeddingModelSpec } from "@/types/embeddings";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "@/types/settings";
import { EMBEDDING_MODELS, EMBEDDING_PROVIDERS } from "@/types/embeddings";

interface SettingsContextType {
  settings: AppSettings;
  updateProvider: (id: EmbeddingProviderId, updates: Partial<ProviderSettings>) => void;
  toggleDarkMode: () => void;
  setNegationThreshold: (threshold: number) => void;
  setRankedModels: (ranked: string[]) => void;
  getEnabledModels: () => Array<EmbeddingModelSpec & { apiKey: string; baseUrl?: string }>;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

      for (const modelId of providerSettings.selectedModels) {
        const model = EMBEDDING_MODELS.find(m => m.id === modelId && m.providerId === pid);
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
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateProvider,
        toggleDarkMode,
        setNegationThreshold,
        setRankedModels,
        getEnabledModels,
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

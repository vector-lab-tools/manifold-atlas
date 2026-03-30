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
  getEnabledModels: () => Array<EmbeddingModelSpec & { apiKey: string; baseUrl?: string }>;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep-merge providers so new providers added in code don't break saved settings
        const mergedProviders = { ...DEFAULT_SETTINGS.providers };
        if (parsed.providers) {
          for (const [key, val] of Object.entries(parsed.providers)) {
            if (key in mergedProviders) {
              mergedProviders[key as keyof typeof mergedProviders] = {
                ...mergedProviders[key as keyof typeof mergedProviders],
                ...(val as object),
              };
            }
          }
        }
        setSettings(prev => ({ ...prev, ...parsed, providers: mergedProviders }));
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
    setLoaded(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save settings:", e);
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
    return results;
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateProvider,
        toggleDarkMode,
        setNegationThreshold,
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

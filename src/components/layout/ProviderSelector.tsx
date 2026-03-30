"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Circle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { EMBEDDING_PROVIDERS, EMBEDDING_MODELS, type EmbeddingProviderId } from "@/types/embeddings";

export function ProviderSelector() {
  const { settings, updateProvider } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Count active models
  const enabledModels: Array<{ providerId: EmbeddingProviderId; modelId: string; modelName: string; providerName: string }> = [];
  for (const [pid, ps] of Object.entries(settings.providers)) {
    if (!ps.enabled) continue;
    const provider = EMBEDDING_PROVIDERS[pid as EmbeddingProviderId];
    if (!provider) continue;
    for (const mid of ps.selectedModels) {
      const spec = EMBEDDING_MODELS.find(m => m.id === mid && m.providerId === pid);
      if (spec) {
        enabledModels.push({
          providerId: pid as EmbeddingProviderId,
          modelId: mid,
          modelName: spec.name,
          providerName: provider.name,
        });
      }
    }
  }

  const label = enabledModels.length === 0
    ? "No models"
    : enabledModels.length === 1
      ? enabledModels[0].modelName
      : `${enabledModels.length} models`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-parchment-dark bg-card hover:bg-cream/50 transition-colors font-sans text-body-sm"
      >
        <Circle
          size={8}
          className={enabledModels.length > 0 ? "fill-success-500 text-success-500" : "fill-error-500 text-error-500"}
        />
        <span className="font-medium">{label}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-[320px] card-editorial shadow-editorial-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-parchment">
            <p className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
              Active Embedding Models
            </p>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-parchment">
            {(Object.keys(EMBEDDING_PROVIDERS) as EmbeddingProviderId[]).map(pid => {
              const provider = EMBEDDING_PROVIDERS[pid];
              const ps = settings.providers[pid];
              if (!ps) return null;

              return (
                <div key={pid} className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-caption font-semibold text-foreground">
                      {provider.name}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ps.enabled}
                        onChange={e => updateProvider(pid, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-parchment-dark rounded-full peer peer-checked:bg-burgundy transition-colors">
                        <div
                          className={`w-3 h-3 mt-0.5 rounded-full bg-white shadow transition-transform ${
                            ps.enabled ? "translate-x-3.5 ml-[14px]" : "ml-0.5"
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  {ps.enabled && (
                    <div className="space-y-0.5 ml-1">
                      {provider.models.map(model => {
                        const isSelected = ps.selectedModels.includes(model.id);
                        return (
                          <label
                            key={model.id}
                            className="flex items-center gap-1.5 cursor-pointer py-0.5"
                            onClick={() => {
                              const selected = isSelected
                                ? ps.selectedModels.filter(m => m !== model.id)
                                : [...ps.selectedModels, model.id];
                              updateProvider(pid, { selectedModels: selected });
                            }}
                          >
                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-burgundy border-burgundy text-white"
                                : "border-parchment-dark"
                            }`}>
                              {isSelected && <Check size={10} />}
                            </div>
                            <span className="font-sans text-caption">{model.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {!ps.enabled && provider.requiresApiKey && !ps.apiKey && (
                    <p className="font-sans text-[9px] text-muted-foreground ml-1">
                      Needs API key — configure in Settings
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

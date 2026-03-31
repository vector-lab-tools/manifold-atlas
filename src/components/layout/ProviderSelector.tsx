"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Circle, X } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { EMBEDDING_PROVIDERS, EMBEDDING_MODELS, type EmbeddingProviderId } from "@/types/embeddings";

export function ProviderSelector() {
  const { settings, updateProvider, setRankedModels } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // All enabled models across all providers (only if provider is usable)
  const allEnabled: Array<{ providerId: EmbeddingProviderId; modelId: string; modelName: string; providerName: string }> = [];
  for (const [pid, ps] of Object.entries(settings.providers)) {
    if (!ps.enabled) continue;
    const provider = EMBEDDING_PROVIDERS[pid as EmbeddingProviderId];
    if (!provider) continue;
    // Skip if provider requires API key but none is configured
    if (provider.requiresApiKey && !ps.apiKey) continue;
    for (const mid of ps.selectedModels) {
      const spec = EMBEDDING_MODELS.find(m => m.id === mid && m.providerId === pid);
      if (spec) {
        allEnabled.push({
          providerId: pid as EmbeddingProviderId,
          modelId: mid,
          modelName: spec.name,
          providerName: provider.name,
        });
      }
    }
  }

  const ranked = settings.rankedModels || [];
  const primaryId = ranked[0] || null;
  const secondaryId = ranked[1] || null;
  const primaryModel = primaryId ? allEnabled.find(m => m.modelId === primaryId) : null;
  const secondaryModel = secondaryId ? allEnabled.find(m => m.modelId === secondaryId) : null;

  const label = primaryModel
    ? primaryModel.modelName
    : allEnabled.length === 0
      ? "No models"
      : allEnabled.length === 1
        ? allEnabled[0].modelName
        : `${allEnabled.length} models (all)`;

  const setRank = (modelId: string, rank: 1 | 2) => {
    const current = [...ranked];
    // Remove from current position if already ranked
    const idx = current.indexOf(modelId);
    if (idx >= 0) current.splice(idx, 1);
    // Insert at the right position
    if (rank === 1) {
      current.unshift(modelId);
      if (current.length > 2) current.length = 2;
    } else {
      if (current.length === 0) current.push(modelId); // need a primary first
      else if (current.length >= 2) current[1] = modelId;
      else current.push(modelId);
    }
    setRankedModels(current);
  };

  const removeRank = (modelId: string) => {
    setRankedModels(ranked.filter(id => id !== modelId));
  };

  const clearRanking = () => setRankedModels([]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-parchment-dark bg-card hover:bg-cream/50 transition-colors font-sans text-body-sm"
      >
        <Circle
          size={8}
          className={allEnabled.length > 0 ? "fill-success-500 text-success-500" : "fill-error-500 text-error-500"}
        />
        <span className="font-medium">{label}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-[340px] card-editorial shadow-editorial-lg overflow-hidden">

          {/* Ranked models at the top */}
          {(primaryModel || secondaryModel) && (
            <div className="px-3 py-2 bg-muted/50 border-b border-parchment">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Active Selection
                </p>
                <button
                  onClick={clearRanking}
                  className="font-sans text-[9px] text-muted-foreground hover:text-error-500 transition-colors"
                >
                  Clear (use all)
                </button>
              </div>
              {primaryModel && (
                <div className="flex items-center gap-2 py-1">
                  <span className="w-5 h-5 rounded-sm bg-burgundy text-white font-sans text-caption font-bold flex items-center justify-center">1</span>
                  <span className="font-sans text-body-sm font-medium flex-1">{primaryModel.modelName}</span>
                  <span className="font-sans text-[9px] text-muted-foreground">{primaryModel.providerName}</span>
                  <button onClick={() => removeRank(primaryModel.modelId)} className="text-muted-foreground hover:text-error-500 p-0.5">
                    <X size={12} />
                  </button>
                </div>
              )}
              {secondaryModel && (
                <div className="flex items-center gap-2 py-1">
                  <span className="w-5 h-5 rounded-sm bg-gold text-white font-sans text-caption font-bold flex items-center justify-center">2</span>
                  <span className="font-sans text-body-sm font-medium flex-1">{secondaryModel.modelName}</span>
                  <span className="font-sans text-[9px] text-muted-foreground">{secondaryModel.providerName}</span>
                  <button onClick={() => removeRank(secondaryModel.modelId)} className="text-muted-foreground hover:text-error-500 p-0.5">
                    <X size={12} />
                  </button>
                </div>
              )}
              {!primaryModel && !secondaryModel && (
                <p className="font-sans text-caption text-muted-foreground italic">No models ranked — using all enabled</p>
              )}
            </div>
          )}

          {/* All providers */}
          <div className="px-3 py-2 border-b border-parchment">
            <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              All Providers
            </p>
          </div>

          <div className="max-h-[350px] overflow-y-auto divide-y divide-parchment">
            {(Object.keys(EMBEDDING_PROVIDERS) as EmbeddingProviderId[]).map(pid => {
              const provider = EMBEDDING_PROVIDERS[pid];
              const ps = settings.providers[pid];
              if (!ps) return null;

              return (
                <div key={pid} className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-caption font-semibold text-foreground">
                      {provider.name}
                      {ps.enabled && provider.requiresApiKey && !ps.apiKey && (
                        <span className="ml-1.5 text-[9px] text-warning-500 font-normal">needs key</span>
                      )}
                    </span>
                    <button
                      onClick={() => updateProvider(pid, { enabled: !ps.enabled })}
                      className={`relative w-8 h-[18px] rounded-full transition-colors ${ps.enabled ? "bg-burgundy" : "bg-parchment-dark"}`}
                    >
                      <span
                        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
                          ps.enabled ? "left-[16px]" : "left-[2px]"
                        }`}
                      />
                    </button>
                  </div>

                  {ps.enabled && (
                    <div className="space-y-0.5 ml-1">
                      {provider.models.map(model => {
                        const isSelected = ps.selectedModels.includes(model.id);
                        const rankIdx = ranked.indexOf(model.id);
                        const rankNum = rankIdx >= 0 ? rankIdx + 1 : null;

                        return (
                          <div key={model.id} className="flex items-center gap-1.5 py-0.5">
                            {/* Checkbox */}
                            <div
                              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${
                                isSelected ? "bg-burgundy border-burgundy text-white" : "border-parchment-dark"
                              }`}
                              onClick={() => {
                                const selected = isSelected
                                  ? ps.selectedModels.filter(m => m !== model.id)
                                  : [...ps.selectedModels, model.id];
                                updateProvider(pid, { selectedModels: selected });
                                // Remove from ranking if deselected
                                if (isSelected && ranked.includes(model.id)) {
                                  removeRank(model.id);
                                }
                              }}
                            />
                            <span className="font-sans text-caption flex-1">{model.name}</span>

                            {/* Rank buttons */}
                            {isSelected && (
                              <div className="flex gap-0.5">
                                <button
                                  onClick={() => setRank(model.id, 1)}
                                  className={`w-4 h-4 rounded-sm font-sans text-[9px] font-bold flex items-center justify-center transition-colors ${
                                    rankNum === 1
                                      ? "bg-burgundy text-white"
                                      : "border border-parchment-dark text-muted-foreground hover:border-burgundy hover:text-burgundy"
                                  }`}
                                  title="Set as primary model [1]"
                                >1</button>
                                <button
                                  onClick={() => setRank(model.id, 2)}
                                  className={`w-4 h-4 rounded-sm font-sans text-[9px] font-bold flex items-center justify-center transition-colors ${
                                    rankNum === 2
                                      ? "bg-gold text-white"
                                      : "border border-parchment-dark text-muted-foreground hover:border-gold hover:text-gold"
                                  }`}
                                  title="Set as secondary model [2]"
                                >2</button>
                              </div>
                            )}
                          </div>
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

          <div className="px-3 py-2 border-t border-parchment">
            <p className="font-sans text-[9px] text-muted-foreground">
              Click [1] to set primary, [2] for secondary. Unranked = queries run all selected models.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

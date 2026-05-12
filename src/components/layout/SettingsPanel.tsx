"use client";

import { useEffect, useState } from "react";
import { X, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbeddingCache } from "@/context/EmbeddingCacheContext";
import { EMBEDDING_PROVIDERS, type EmbeddingProviderId } from "@/types/embeddings";
import { CopyableCommand } from "@/components/shared/CopyableCommand";

/**
 * Read window.location after mount so the values are correct on the
 * client without breaking SSR hydration (mirrors the LLMbench pattern).
 * Returns empty strings during SSR; real values after first effect.
 */
function useClientOrigin(): { hostname: string; origin: string; isLocal: boolean } {
  const [info, setInfo] = useState({ hostname: "", origin: "", isLocal: false });
  useEffect(() => {
    const host = window.location.hostname;
    setInfo({
      hostname: host,
      origin: window.location.origin,
      isLocal: host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0",
    });
  }, []);
  return info;
}

/**
 * Origin-aware Ollama setup help. Detects whether Atlas is being viewed
 * from localhost (in which case plain `ollama serve` is enough) or a
 * deployed origin (in which case Ollama must be started with
 * OLLAMA_ORIGINS including this page's origin so its CORS policy lets
 * the browser call it). The exact command is pre-filled with the user's
 * real origin and rendered as a one-click copy block. Mirrors the
 * LLMbench Ollama help pattern.
 */
function OllamaSetupHelp() {
  const { hostname, origin, isLocal } = useClientOrigin();
  return (
    <div className="space-y-2 font-sans text-caption text-slate">
      <p>
        <strong className="text-foreground">Ollama (Local)</strong> runs embedding
        models on your own machine. Manifold Atlas calls Ollama directly from your
        browser, so it works from both a local dev build and a deployed Atlas — as
        long as you let Ollama&rsquo;s CORS policy talk to this page&rsquo;s origin.
      </p>
      <p>
        Setup: install from{" "}
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
        >
          ollama.com/download
        </a>
        , pull an embedding model (
        <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
          ollama pull nomic-embed-text
        </code>
        ), and start the server.{" "}
        {isLocal ? (
          <>
            A plain{" "}
            <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
              ollama serve
            </code>{" "}
            is enough when you&rsquo;re running Atlas on localhost.
          </>
        ) : (
          <>
            You&rsquo;re viewing Manifold Atlas from{" "}
            <span className="font-mono">{hostname || "a deployed origin"}</span>.
            Start Ollama with this exact command so its CORS policy lets the
            browser call it from here:
            <CopyableCommand
              command={`OLLAMA_ORIGINS="${origin || "https://your-manifold-atlas-origin"},http://localhost:3000,http://127.0.0.1:3000" ollama serve`}
            />
            <span className="block mt-1">
              <strong className="text-foreground">Safari note:</strong> the
              browser-direct path works in Chrome, Firefox, Edge, Arc, and Brave.
              Safari currently blocks HTTPS pages from calling{" "}
              <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
                http://localhost
              </code>{" "}
              regardless of CORS, so use one of the Chromium-family browsers (or
              Firefox) for Ollama from a deployed Atlas. Local dev (
              <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
                npm run dev
              </code>{" "}
              on{" "}
              <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
                localhost:3000
              </code>
              ) works in Safari too.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

export function SettingsPanel() {
  const { settings, settingsOpen, setSettingsOpen, updateProvider, providerModels } = useSettings();
  const { cacheSize, clearCache } = useEmbeddingCache();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const toggleKeyVisibility = (pid: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  if (!settingsOpen) return null;

  const providerIds = Object.keys(EMBEDDING_PROVIDERS) as EmbeddingProviderId[];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSettingsOpen(false)} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-card border-l border-parchment-dark shadow-editorial-lg z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-display-md font-bold">Settings</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="btn-editorial-ghost px-2 py-2"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-6">
            {providerIds.map(pid => {
              const provider = EMBEDDING_PROVIDERS[pid];
              const provSettings = settings.providers[pid];

              return (
                <div key={pid} className="card-editorial p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-sans text-body-sm font-semibold">{provider.name}</h3>
                      {pid === "ollama" ? (
                        <div className="mt-1">
                          <OllamaSetupHelp />
                        </div>
                      ) : (
                        <p className="font-sans text-caption text-slate mt-0.5">
                          {provider.description}
                          {provider.signupUrl && (
                            <>
                              {" "}
                              <a
                                href={provider.signupUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
                              >
                                Get API key &rarr;
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={provSettings.enabled}
                        onChange={e => updateProvider(pid, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-parchment-dark rounded-full peer peer-checked:bg-burgundy transition-colors">
                        <div
                          className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                            provSettings.enabled ? "translate-x-4.5 ml-[18px]" : "ml-0.5"
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  {provSettings.enabled && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-parchment">
                      {provider.requiresApiKey && (
                        <div>
                          <label className="block font-sans text-caption text-slate mb-1">
                            API Key
                          </label>
                          <div className="relative">
                            <input
                              type={visibleKeys.has(pid) ? "text" : "password"}
                              value={provSettings.apiKey}
                              onChange={e => updateProvider(pid, { apiKey: e.target.value })}
                              placeholder={`Enter ${provider.name} API key`}
                              className="input-editorial text-body-sm py-2 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility(pid)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                              title={visibleKeys.has(pid) ? "Hide API key" : "Show API key"}
                            >
                              {visibleKeys.has(pid) ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {provider.baseUrlConfigurable && (
                        <div>
                          <label className="block font-sans text-caption text-slate mb-1">
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={provSettings.baseUrl || provider.defaultBaseUrl || ""}
                            onChange={e => updateProvider(pid, { baseUrl: e.target.value })}
                            placeholder={provider.defaultBaseUrl || "https://..."}
                            className="input-editorial text-body-sm py-2"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block font-sans text-caption text-slate mb-1">
                          Models
                        </label>
                        <div className="space-y-1.5">
                          {(providerModels[pid] ?? provider.models).map(model => (
                            <label
                              key={model.id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={provSettings.selectedModels.includes(model.id)}
                                onChange={e => {
                                  const selected = e.target.checked
                                    ? [...provSettings.selectedModels, model.id]
                                    : provSettings.selectedModels.filter(m => m !== model.id);
                                  updateProvider(pid, { selectedModels: selected });
                                }}
                                className="rounded border-parchment-dark text-burgundy focus:ring-burgundy"
                              />
                              <span className="font-sans text-body-sm">{model.name}</span>
                              {model.dimensions > 0 && (
                                <span className="font-sans text-caption text-slate">
                                  {model.dimensions}d
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      {pid === "openai-compatible" && (
                        <div>
                          <label className="block font-sans text-caption text-slate mb-1">
                            Custom Model ID
                          </label>
                          <input
                            type="text"
                            value={provSettings.customModelId || ""}
                            onChange={e =>
                              updateProvider(pid, { customModelId: e.target.value })
                            }
                            placeholder="e.g. text-embedding-ada-002"
                            className="input-editorial text-body-sm py-2"
                          />
                        </div>
                      )}

                      {provider.requiresApiKey && provSettings.apiKey && (
                        <div className="flex items-center gap-1.5 text-success-600">
                          <Check size={14} />
                          <span className="font-sans text-caption">Key configured</span>
                        </div>
                      )}
                      {provider.requiresApiKey && !provSettings.apiKey && (
                        <div className="flex items-center gap-1.5 text-warning-600">
                          <AlertCircle size={14} />
                          <span className="font-sans text-caption">API key required</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Cache management */}
            <div className="card-editorial p-4">
              <h3 className="font-sans text-body-sm font-semibold mb-2">Cache</h3>
              <p className="font-sans text-caption text-slate mb-3">
                {cacheSize} embedding vector{cacheSize !== 1 ? "s" : ""} cached in IndexedDB.
                Cached embeddings avoid redundant API calls.
              </p>
              <button
                onClick={clearCache}
                className="btn-editorial-secondary text-caption px-3 py-1.5"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

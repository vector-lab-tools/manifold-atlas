"use client";

import { useState, useEffect } from "react";
import { X, Download, Loader2, Check, AlertTriangle } from "lucide-react";

interface OllamaHelperProps {
  modelName: string;
  baseUrl?: string;
  onClose: () => void;
  onPulled: () => void;
}

export function OllamaHelper({ modelName, baseUrl = "http://localhost:11434", onClose, onPulled }: OllamaHelperProps) {
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Browser-direct call helper. Friendly error mapping for CORS vs
  // connection-refused — see client.ts for the rationale.
  const url = baseUrl.replace(/\/$/, "");
  const friendlyError = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        return `Cannot reach Ollama at ${url} from ${window.location.origin}. Almost certainly a CORS block — start Ollama with OLLAMA_ORIGINS including this origin.`;
      }
      return "Cannot connect to Ollama. Is it running? Start with: ollama serve";
    }
    return msg;
  };

  // Fetch available models on mount, browser-direct.
  useEffect(() => {
    fetch(`${url}/api/tags`)
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setAvailableModels(data.models.map((m: { name: string }) => m.name));
        }
      })
      .catch(e => setError(friendlyError(e)))
      .finally(() => setLoadingModels(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const handlePull = async () => {
    setPulling(true);
    setError(null);
    try {
      const res = await fetch(`${url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ollama's /api/pull accepts both `name` and `model`; the older
        // `name` form is more universally supported across Ollama versions.
        body: JSON.stringify({ name: modelName, stream: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Pull failed (${res.status})`);
      } else {
        setPulled(true);
        setTimeout(() => onPulled(), 1500);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPulling(false);
    }
  };

  const hasModel = availableModels.some(m => m.startsWith(modelName));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] max-w-[90vw] card-editorial p-6 shadow-editorial-lg animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-warning-500" />
            <h2 className="font-display text-display-md font-bold">Ollama Model Not Found</h2>
          </div>
          <button onClick={onClose} className="btn-editorial-ghost px-2 py-1">
            <X size={16} />
          </button>
        </div>

        <p className="font-sans text-body-sm text-slate mb-4">
          The embedding model <code className="px-1.5 py-0.5 bg-muted rounded-sm text-burgundy font-mono text-body-sm">{modelName}</code> is
          not available in your local Ollama installation. You need to pull it before it can be used.
        </p>

        {/* Available models */}
        <div className="mb-4 p-3 bg-muted rounded-sm">
          <p className="font-sans text-caption text-slate mb-1.5 font-semibold uppercase tracking-wider">
            Currently installed models
          </p>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-slate text-body-sm">
              <Loader2 size={14} className="animate-spin" />
              Checking Ollama...
            </div>
          ) : availableModels.length > 0 ? (
            <ul className="space-y-0.5">
              {availableModels.map(m => (
                <li key={m} className="font-mono text-body-sm">{m}</li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-body-sm text-slate italic">No models installed</p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 dark:bg-error-500/10 border border-error-500/30 rounded-sm">
            <p className="font-sans text-body-sm text-error-600">{error}</p>
          </div>
        )}

        {pulled ? (
          <div className="flex items-center gap-2 text-success-600">
            <Check size={18} />
            <span className="font-sans text-body-sm font-medium">
              Model pulled successfully. Retrying...
            </span>
          </div>
        ) : hasModel ? (
          <div className="flex items-center gap-2 text-success-600">
            <Check size={18} />
            <span className="font-sans text-body-sm font-medium">
              Model is already installed. Try your query again.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handlePull}
              disabled={pulling}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {pulling ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Pulling (this may take a minute)...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Pull {modelName}
                </>
              )}
            </button>
            <span className="font-sans text-caption text-slate">
              or run: <code className="font-mono">ollama pull {modelName}</code>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

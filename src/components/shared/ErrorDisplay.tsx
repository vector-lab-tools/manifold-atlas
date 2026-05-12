"use client";

import { useState } from "react";
import { isOllamaModelError } from "./useEmbedAll";
import { OllamaHelper } from "./OllamaHelper";
import { CopyableCommand } from "./CopyableCommand";
import { isOllamaCorsError } from "@/lib/embeddings/client";

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const [showOllamaHelper, setShowOllamaHelper] = useState(false);

  if (isOllamaModelError(error)) {
    return (
      <>
        <div className="card-editorial p-4 border-warning-500/30 bg-warning-50 dark:bg-warning-500/10">
          <p className="font-sans text-body-sm text-warning-600 mb-2">
            Ollama model <code className="px-1.5 py-0.5 bg-muted rounded-sm font-mono">{error.modelName}</code> is not installed locally.
          </p>
          <button
            onClick={() => setShowOllamaHelper(true)}
            className="btn-editorial-secondary text-body-sm px-3 py-1.5"
          >
            Pull Model...
          </button>
        </div>
        {showOllamaHelper && (
          <OllamaHelper
            modelName={error.modelName}
            baseUrl={error.baseUrl}
            onClose={() => setShowOllamaHelper(false)}
            onPulled={() => {
              setShowOllamaHelper(false);
              onRetry?.();
            }}
          />
        )}
      </>
    );
  }

  // Structured Ollama network error: CORS block on a deployed origin,
  // or Ollama-not-running on localhost. Render with a copyable command
  // block rather than a wall of text — David's request.
  if (isOllamaCorsError(error)) {
    return (
      <div className="card-editorial p-4 border-warning-500/30 bg-warning-50 dark:bg-warning-500/10">
        <p className="font-sans text-body-sm text-warning-600 font-semibold mb-1">
          {error.kind === "cors"
            ? "Ollama is unreachable from this page (CORS)"
            : "Ollama is unreachable"}
        </p>
        <p className="font-sans text-caption text-slate mb-2">
          {error.message}
        </p>
        <div className="mb-2">
          <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            {error.kind === "cors" ? "Run this in your terminal" : "Then start Ollama"}
          </p>
          <CopyableCommand command={error.command} />
        </div>
        {error.kind === "cors" && (
          <p className="font-sans text-caption text-slate mt-2">
            <strong className="text-foreground">Safari note:</strong> Safari blocks HTTPS pages from
            calling{" "}
            <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
              http://localhost
            </code>{" "}
            regardless of CORS. Use Chrome, Firefox, Edge, or Brave from a deployed Atlas; local dev (
            <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
              npm run dev
            </code>
            ) works in Safari too.
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-editorial-secondary text-body-sm px-3 py-1.5 mt-3"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="card-editorial p-4 border-error-500/30 bg-error-50 dark:bg-error-500/10">
      <p className="font-sans text-body-sm text-error-600">{message}</p>
    </div>
  );
}

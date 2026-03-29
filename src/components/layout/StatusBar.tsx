"use client";

import { useSettings } from "@/context/SettingsContext";
import { useEmbeddingCache } from "@/context/EmbeddingCacheContext";

interface StatusBarProps {
  lastQueryTime?: number;
}

export function StatusBar({ lastQueryTime }: StatusBarProps) {
  const { getEnabledModels } = useSettings();
  const { cacheSize } = useEmbeddingCache();
  const enabledCount = getEnabledModels().length;

  return (
    <footer className="border-t border-parchment-dark px-6 py-2 flex items-center gap-6 font-sans text-caption text-slate">
      <span>
        <span className="text-ink font-medium">v0.2.0</span>
      </span>
      <span className="h-3 w-px bg-parchment-dark" />
      <span>
        {enabledCount} model{enabledCount !== 1 ? "s" : ""} configured
      </span>
      <span className="h-3 w-px bg-parchment-dark" />
      <span>
        {cacheSize} cached vector{cacheSize !== 1 ? "s" : ""}
      </span>
      {lastQueryTime !== undefined && (
        <>
          <span className="h-3 w-px bg-parchment-dark" />
          <span>Last: {lastQueryTime.toFixed(1)}s</span>
        </>
      )}
    </footer>
  );
}

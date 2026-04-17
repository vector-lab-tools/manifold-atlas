"use client";

import { useSettings } from "@/context/SettingsContext";
import { useEmbeddingCache } from "@/context/EmbeddingCacheContext";
import { VERSION } from "@/lib/version";

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
        <span className="text-ink font-medium">v{VERSION}</span>
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

      {/* Vector Lab family mark, right-aligned */}
      <a
        href="https://vector-lab-tools.github.io"
        target="_blank"
        rel="noopener noreferrer"
        title="Part of the Vector Lab"
        className="ml-auto flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/vector-lab-logo-mark.svg"
          alt=""
          width={14}
          height={14}
          aria-hidden="true"
          className="block opacity-80"
        />
        <span>Part of the Vector Lab</span>
      </a>
    </footer>
  );
}

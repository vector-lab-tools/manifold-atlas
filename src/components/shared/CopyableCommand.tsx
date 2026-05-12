"use client";

/**
 * Inline code block with a copy-to-clipboard button. Used wherever
 * Atlas needs to surface a shell command with the user's actual
 * origin / model / path pre-filled, so they can paste it without
 * hand-editing. Shared between the Settings panel (OLLAMA_ORIGINS
 * setup help) and the ErrorDisplay (Ollama CORS error fallback).
 */

import { useState } from "react";

interface CopyableCommandProps {
  command: string;
  /** Optional class overrides for the outer wrapper. */
  className?: string;
}

export function CopyableCommand({ command, className = "" }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; user can still select manually */
    }
  };
  return (
    <span className={`block my-1.5 flex items-start gap-1.5 ${className}`}>
      <code className="flex-1 font-mono text-[11px] bg-muted/60 px-2 py-1 rounded select-all break-all">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="btn-editorial-ghost text-[10px] px-2 py-1 shrink-0"
        title="Copy to clipboard"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

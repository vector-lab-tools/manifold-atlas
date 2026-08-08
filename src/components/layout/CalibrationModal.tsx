"use client";

/**
 * Live readout for a calibration run.
 *
 * Opens by itself whenever a run starts, from wherever it was triggered,
 * and stays open when the run ends so the measurements can be read
 * rather than hunted for. Before this existed a run launched from an
 * operation's banner reported nothing at all: a rejected API key looked
 * exactly like a button that did nothing.
 *
 * The panel prints each model's numbers as they land, because the point
 * of the run is the numbers, and a progress bar that fills and vanishes
 * leaves the user knowing only that something happened.
 */

import { useState } from "react";
import { Loader2, X, Check, AlertTriangle, Copy } from "lucide-react";
import { useCalibration } from "@/context/CalibrationContext";
import { radiusLine } from "@/lib/calibration/report";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<string, string> = {
  queued: "queued",
  cache: "checking cache",
  embedding: "embedding corpus",
  computing: "measuring radius",
  done: "done",
  error: "failed",
};

export function CalibrationModal() {
  const { modalOpen, setModalOpen, running, progress, calibrations } = useCalibration();
  const [copied, setCopied] = useState<string | null>(null);

  if (!modalOpen || progress.length === 0) return null;

  const done = progress.filter(p => p.status === "done").length;
  const failed = progress.filter(p => p.status === "error").length;

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[70]"
        onClick={() => !running && setModalOpen(false)}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[680px] max-w-[92vw] max-h-[85vh] overflow-y-auto card-editorial shadow-editorial-lg animate-fade-in">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-display-md font-bold flex items-center gap-2">
              {running && <Loader2 size={16} className="animate-spin text-burgundy" />}
              Measuring the radius
            </h2>
            <p className="font-sans text-caption text-muted-foreground mt-1 max-w-lg">
              {running
                ? "Embedding a neutral corpus and measuring how much of the sphere each model actually uses. Nothing here is a probe; the texts are deliberately mundane."
                : failed > 0 && done === 0
                  ? "The run did not complete. Nothing has been saved for the models below."
                  : "Measurement complete. These figures are now the scale every cosine in the application is reported against."}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            disabled={running}
            className="btn-editorial-ghost px-2 py-1 disabled:opacity-40 shrink-0"
            title={running ? "Wait for the run to finish" : "Close"}
          >
            <X size={16} />
          </button>
        </div>
        <div className="thin-rule mx-6" />

        <div className="px-6 py-5 space-y-4">
          {progress.map(p => {
            const cal = calibrations.get(p.modelId);
            const pct = p.total > 0 ? (p.completed / p.total) * 100 : 0;
            return (
              <div key={p.modelId} className="space-y-2">
                <div className="flex items-center gap-2">
                  {p.status === "done" && <Check size={13} className="text-success-600 shrink-0" />}
                  {p.status === "error" && (
                    <AlertTriangle size={13} className="text-error-500 shrink-0" />
                  )}
                  {p.status === "running" && (
                    <Loader2 size={13} className="animate-spin text-burgundy shrink-0" />
                  )}
                  <span className="font-sans text-body-sm font-medium">{p.modelName}</span>
                  <span className="font-sans text-caption text-muted-foreground">
                    {p.providerId}
                  </span>
                  <span className="ml-auto font-sans text-caption text-muted-foreground tabular-nums">
                    {p.status === "error"
                      ? "failed"
                      : p.status === "done"
                        ? `${p.seconds?.toFixed(1)}s`
                        : `${STAGE_LABEL[p.stage]} · ${p.completed}/${p.total}`}
                  </span>
                </div>

                <div className="h-1.5 bg-parchment rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      p.status === "error" ? "bg-error-500" : "bg-burgundy"
                    )}
                    style={{ width: `${p.status === "error" ? 100 : pct}%` }}
                  />
                </div>

                {p.log.length > 0 && (
                  <div
                    className={cn(
                      "rounded-sm px-3 py-2 font-mono text-[10.5px] leading-relaxed space-y-0.5",
                      p.status === "error"
                        ? "bg-error-500/5 border border-error-500/30 text-error-600"
                        : "bg-muted text-foreground/80"
                    )}
                  >
                    {p.log.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}

                {cal && p.status === "done" && (
                  <div className="flex items-start gap-2">
                    <code className="flex-1 rounded-sm px-3 py-2 bg-background border border-parchment-dark font-mono text-[10px] leading-relaxed break-words">
                      {radiusLine(cal, "short")}
                    </code>
                    <button
                      onClick={() => copy(p.modelId, radiusLine(cal, "short"))}
                      className="btn-editorial-ghost px-2 py-1.5 shrink-0"
                      title="Copy the radius line to paste beside a figure"
                    >
                      {copied === p.modelId ? (
                        <Check size={13} className="text-success-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!running && (
          <>
            <div className="thin-rule mx-6" />
            <div className="px-6 py-4 flex items-center gap-3">
              <span className="font-sans text-caption text-muted-foreground">
                {done} measured{failed > 0 ? `, ${failed} failed` : ""}. Full distributions and
                the per-register breakdown are on the Calibration tab and in every
                operation&apos;s Deep Dive.
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="btn-editorial-secondary ml-auto shrink-0"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

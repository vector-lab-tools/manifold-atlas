"use client";

/**
 * Shared Deep Dive panel.
 *
 * A collapsible card that hangs at the bottom of every operation,
 * carrying the detailed quantitative data the headline view abstracts
 * away from. Convention (carried over from Vectorscope): every
 * operation gets one of these, populated with whatever per-model
 * geometry table, distribution, threshold sweep, or aggregate the op
 * can produce. Keeps the chevron / tagline / body composition
 * consistent across operations so the user learns the affordance once.
 *
 * Children render lazily — only mounted when the panel is open. Use
 * this for tables and charts whose computation is non-trivial.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DeepDivePanelProps {
  /** Short tagline shown next to the "Deep Dive" header. Single line. */
  tagline?: string;
  /** Initial open state. Defaults to false. */
  defaultOpen?: boolean;
  /** Panel content; rendered only when open. */
  children: ReactNode;
}

export function DeepDivePanel({ tagline, defaultOpen = false, children }: DeepDivePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-editorial overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-cream/50 transition-colors"
      >
        {open ? (
          <ChevronDown size={12} className="text-burgundy" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground" />
        )}
        <span className="font-display text-body-sm font-bold">Deep Dive</span>
        {tagline && (
          <span className="ml-2 font-sans text-caption text-muted-foreground text-left">
            {tagline}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-parchment">{children}</div>}
    </div>
  );
}

/**
 * Section heading inside a Deep Dive panel. Hover-tip-supporting via
 * the dotted-underline affordance the Grammar Deep Dive uses.
 */
export function DeepDiveSection({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5 mt-4 first:mt-0">
      <h4
        title={tip}
        className={`font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold inline-block ${
          tip
            ? "cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline"
            : ""
        }`}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * Compact summary stat tile for Deep Dive sections. Uniform size
 * across operations so the panel reads as one piece of UI.
 */
export function DeepDiveStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const colour = {
    neutral: "",
    success: "text-success-600",
    warning: "text-warning-500",
    error: "text-error-500",
  }[tone];
  return (
    <div className="bg-muted rounded-sm p-2">
      <div className="font-sans text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`font-sans text-body-sm font-bold mt-0.5 tabular-nums ${colour}`}>{value}</div>
      {hint && <div className="font-sans text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

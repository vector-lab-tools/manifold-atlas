"use client";

/**
 * Hover definition for a calibration or radius term.
 *
 * Every number the calibration layer reports is unfamiliar enough that
 * it needs its definition within reach of the number itself. This
 * component wraps a label in the dotted-underline affordance the Deep
 * Dive panels already use, and reveals the full glossary entry on hover
 * or focus: what the quantity is, how it is computed, and how to read a
 * value.
 *
 * Definitions come from lib/calibration/glossary.ts and nowhere else,
 * so the tooltip in one panel and the help text in another cannot say
 * different things about the same metric.
 */

import { useState, useRef, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { glossary } from "@/lib/calibration/glossary";
import { cn } from "@/lib/utils";

interface MetricTermProps {
  /** Key into GLOSSARY. */
  termKey: string;
  /** Label to show. Defaults to the glossary entry's term. */
  children?: ReactNode;
  /** Where the card opens. Defaults to below. */
  placement?: "top" | "bottom";
  className?: string;
}

export function MetricTerm({
  termKey,
  children,
  placement = "bottom",
  className,
}: MetricTermProps) {
  const entry = glossary(termKey);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const card = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // The card is portalled to the body and placed against the viewport, so a
  // panel with overflow hidden cannot clip it and it never runs off screen.
  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) {
      setPos(null);
      return;
    }
    const a = anchor.current.getBoundingClientRect();
    const c = card.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(a.left, window.innerWidth - c.width - margin));
    const above = a.top - c.height - 6;
    const below = a.bottom + 6;
    const fitsBelow = below + c.height <= window.innerHeight - margin;
    const fitsAbove = above >= margin;
    const top =
      placement === "top"
        ? fitsAbove || !fitsBelow ? Math.max(margin, above) : below
        : fitsBelow || !fitsAbove ? below : above;
    setPos({ left, top });
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open, placement]);

  // A short delay on close keeps the card from flickering away when the
  // pointer crosses the gap between the label and the card.
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  if (!entry) return <>{children ?? termKey}</>;

  return (
    <span
      className={cn("relative inline-block", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        ref={anchor}
        tabIndex={0}
        role="button"
        aria-describedby={open ? `metric-${termKey}` : undefined}
        className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-burgundy rounded-sm"
      >
        {children ?? entry.term}
      </span>

      {open && typeof document !== "undefined" && createPortal(
        <span
          ref={card}
          id={`metric-${termKey}`}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos ? "visible" : "hidden",
          }}
          className={cn(
            "fixed z-[1000] block w-80 max-w-[calc(100vw-16px)] p-3 rounded-sm shadow-lg",
            "bg-background border border-parchment-dark text-left normal-case tracking-normal",
            "whitespace-normal break-words font-normal text-foreground"
          )}
        >
          <span className="block font-display text-body-sm font-bold">{entry.term}</span>
          <span className="block font-sans text-[11px] leading-relaxed mt-1 text-foreground/90">
            {entry.full}
          </span>
          {entry.formula && (
            <span className="block font-mono text-[10px] mt-2 px-2 py-1 bg-muted rounded-sm text-foreground/80">
              {entry.formula}
            </span>
          )}
          {entry.reads && (
            <span className="block font-sans text-[10px] leading-relaxed mt-2 text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-[9px]">
                Reading it{" "}
              </span>
              {entry.reads}
            </span>
          )}
        </span>,
        document.body
      )}
    </span>
  );
}

/**
 * Stat tile carrying its own definition. Use wherever a calibration
 * number appears as a headline figure.
 */
export function MetricStat({
  termKey,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  termKey: string;
  label?: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const entry = glossary(termKey);
  const colour = {
    neutral: "",
    success: "text-success-600",
    warning: "text-warning-500",
    error: "text-error-500",
  }[tone];

  return (
    <div className="bg-muted rounded-sm p-2">
      <div className="font-sans text-[9px] text-muted-foreground uppercase tracking-wider">
        <MetricTerm termKey={termKey}>{label ?? entry?.term ?? termKey}</MetricTerm>
      </div>
      <div className={cn("font-sans text-body-sm font-bold mt-0.5 tabular-nums", colour)}>
        {value}
      </div>
      {hint && <div className="font-sans text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

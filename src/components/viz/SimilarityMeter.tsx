"use client";

/**
 * Verdict bar for a single similarity.
 *
 * This used to be drawn on the raw 0-to-1 cosine scale with three fixed
 * adjectives beneath it: Distinctive, Somewhat similar, Indistinguishable.
 * That put the midpoint of the bar at 0.5 and called it "somewhat
 * similar" in every model, which contradicted the calibrated verdict
 * printed directly above it. A cosine of 0.466 sits mid-bar on the raw
 * scale while being, in a model whose floor is 0.381, barely above
 * unrelated text.
 *
 * The bar now runs on the model's own scale and the labels are its
 * measured anchors rather than adjectives.
 *
 * Two views, because the two things worth seeing pull against each other:
 *
 *   unfolded  the raw 0-to-1 axis with the region below the floor drawn
 *             as unreachable. Shows how much of the nominal scale the
 *             model cannot use, which for a high-floor model is most of
 *             it. This is the view that makes the argument.
 *   folded    the unreachable region removed and the reachable range
 *             stretched across the full width. Shows where the value
 *             sits within what the model can actually express, which is
 *             the view for reading a result rather than arguing about a
 *             scale.
 *
 * Clicking the bar swaps them. The folded state is announced rather than
 * implied: a bar that silently changed its own x-axis would be a worse
 * version of the fault this component was rewritten to fix.
 */

import { useState } from "react";
import { ChevronsLeftRight, ChevronsRightLeft } from "lucide-react";
import type { SimilarityLevel } from "@/lib/similarity-scale";
import { MetricTerm } from "@/components/shared/MetricTerm";
import { normalisedPosition } from "@/lib/calibration/baseline";
import { cn } from "@/lib/utils";

interface SimilarityMeterProps {
  similarity: number;
  level: SimilarityLevel;
  /** Measured unrelated-pair floor for this model and register. */
  floor?: number | null;
  /** Measured topical ceiling, drawn as the "merely related" mark. */
  ceiling?: number | null;
}

export function SimilarityMeter({
  similarity,
  level,
  floor = null,
  ceiling = null,
}: SimilarityMeterProps) {
  const [folded, setFolded] = useState(false);
  // Nothing to fold when the floor is already at the left edge.
  const canFold = floor !== null && floor > 0.02;
  const isFolded = canFold && folded;

  /** Position on whichever axis is currently in force, as a percentage. */
  const x = (v: number) => {
    const p = isFolded && floor !== null ? ((v - floor) / (1 - floor)) * 100 : v * 100;
    return Math.max(0, Math.min(100, p));
  };

  const markerPct = Math.max(1.5, Math.min(98.5, x(similarity)));
  const floorPct = floor === null ? 0 : x(floor);
  const ceilingPct = ceiling === null ? null : x(ceiling);
  const rampStart = isFolded ? 0 : floorPct;

  const ramp =
    "linear-gradient(to right, #15803d 0%, #65a30d 30%, #d97706 50%, #ea580c 70%, #dc2626 85%, #991b1b 100%)";

  const toggle = () => canFold && setFolded(f => !f);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-body-sm font-semibold" style={{ color: level.color }}>
          {level.label}
        </span>
        <span className="flex items-baseline gap-2 shrink-0">
          {floor !== null && (
            <span className="font-sans text-caption tabular-nums text-muted-foreground">
              <MetricTerm termKey="normalisedPosition" placement="top">
                {(normalisedPosition(similarity, floor) * 100).toFixed(0)}% of range
              </MetricTerm>
            </span>
          )}
          <span
            className="font-sans text-body-sm font-bold tabular-nums"
            style={{ color: level.color }}
          >
            {similarity.toFixed(4)}
          </span>
        </span>
      </div>

      <div className="relative pt-2 pb-1">
        <div
          role={canFold ? "button" : undefined}
          tabIndex={canFold ? 0 : undefined}
          aria-pressed={canFold ? isFolded : undefined}
          onClick={toggle}
          onKeyDown={e => {
            if (canFold && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              toggle();
            }
          }}
          title={
            canFold
              ? isFolded
                ? "Unfold: show the whole 0-to-1 cosine scale, including the part this model cannot reach"
                : "Fold away the unreachable region and stretch the reachable range across the bar"
              : undefined
          }
          className={cn(
            "h-3 rounded-full overflow-hidden relative bg-parchment outline-none",
            canFold &&
              "cursor-pointer focus-visible:ring-2 focus-visible:ring-burgundy ring-offset-1 ring-offset-background"
          )}
        >
          {/* Unreachable region: no two real texts land below the floor. */}
          {!isFolded && floor !== null && floorPct > 0 && (
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${floorPct}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 4px)",
                opacity: 0.28,
              }}
            />
          )}
          {/* Colour ramp across the part of the scale the model can use. */}
          <div
            className="absolute inset-y-0 transition-all duration-300"
            style={{ left: `${rampStart}%`, right: 0, background: ramp }}
          />
          {/* Topical ceiling: the mark a figure has to clear to mean anything. */}
          {ceilingPct !== null && (
            <div
              className="absolute inset-y-0 w-px bg-background/80 transition-all duration-300"
              style={{ left: `${ceilingPct}%` }}
            />
          )}
        </div>

        <div
          className="absolute top-0 flex flex-col items-center transition-all duration-300 pointer-events-none"
          style={{ left: `${markerPct}%`, transform: "translateX(-50%)" }}
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "7px solid hsl(var(--foreground))",
            }}
          />
          <div className="w-[2px] h-[14px] bg-foreground rounded-full" />
        </div>
      </div>

      {floor !== null ? (
        <>
          <div className="relative h-3.5 font-sans text-[9px] text-muted-foreground">
            {isFolded ? (
              <span className="absolute left-0 whitespace-nowrap">
                <MetricTerm termKey="floor" placement="top">
                  floor {floor.toFixed(3)}
                </MetricTerm>
              </span>
            ) : (
              <>
                <span className="absolute left-0">unreachable</span>
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${Math.min(84, Math.max(14, floorPct))}%` }}
                >
                  <MetricTerm termKey="floor" placement="top">
                    floor {floor.toFixed(3)}
                  </MetricTerm>
                </span>
              </>
            )}
            {ceilingPct !== null &&
              ceiling !== null &&
              (isFolded || Math.abs(ceilingPct - floorPct) > 16) && (
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${Math.min(88, Math.max(20, ceilingPct))}%` }}
                >
                  <MetricTerm termKey="topicalCeiling" placement="top">
                    same subject {ceiling.toFixed(3)}
                  </MetricTerm>
                </span>
              )}
            <span className="absolute right-0">identical</span>
          </div>

          {/* Second line only when the ceiling would collide on the first. */}
          {!isFolded && ceiling !== null && Math.abs(x(ceiling) - floorPct) <= 16 && (
            <div className="relative h-3 font-sans text-[9px] text-muted-foreground">
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${Math.min(88, Math.max(16, x(ceiling)))}%` }}
              >
                <MetricTerm termKey="topicalCeiling" placement="top">
                  same subject {ceiling.toFixed(3)}
                </MetricTerm>
              </span>
            </div>
          )}

          {canFold && (
            <button
              onClick={toggle}
              aria-pressed={isFolded}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-sans text-[9px] transition-colors",
                isFolded
                  ? "bg-burgundy/10 text-burgundy border border-burgundy/40 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-cream/60"
              )}
            >
              {isFolded ? <ChevronsLeftRight size={10} /> : <ChevronsRightLeft size={10} />}
              {isFolded
                ? `Folded: bar runs ${floor.toFixed(3)} to 1. Show the full scale`
                : `Fold away the unreachable ${(floor * 100).toFixed(0)}%`}
            </button>
          )}
        </>
      ) : (
        <div className="flex justify-between font-sans text-[9px] text-muted-foreground">
          <span className="text-warning-600">
            <MetricTerm termKey="uncalibrated" placement="top">
              unmeasured scale
            </MetricTerm>
          </span>
          <span>identical</span>
        </div>
      )}
    </div>
  );
}

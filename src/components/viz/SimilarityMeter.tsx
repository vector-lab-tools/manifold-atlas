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
 * The bar now uses the same x-axis as CalibratedBar underneath it, so
 * the two line up, and the labels are the model's measured anchors
 * rather than adjectives: where unrelated text sits, where merely
 * topical relatedness sits, and identity. The colour ramp starts at the
 * floor, because nothing below it is reachable and colouring that
 * region green implies a separation the space cannot produce.
 */

import type { SimilarityLevel } from "@/lib/similarity-scale";
import { MetricTerm } from "@/components/shared/MetricTerm";
import { normalisedPosition } from "@/lib/calibration/baseline";

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
  const pct = (v: number) => Math.max(0, Math.min(100, v * 100));
  const markerPct = Math.max(1.5, Math.min(98.5, pct(similarity)));
  const floorPct = floor === null ? 0 : pct(floor);
  const ceilingPct = ceiling === null ? null : pct(ceiling);

  // Calibrated: the ramp occupies only the reachable part of the axis.
  // Uncalibrated: the old full-width ramp, labelled as unmeasured.
  const ramp =
    "linear-gradient(to right, #15803d 0%, #65a30d 30%, #d97706 50%, #ea580c 70%, #dc2626 85%, #991b1b 100%)";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
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
        <div className="h-3 rounded-full overflow-hidden relative bg-parchment">
          {/* Unreachable region: no two real texts land below the floor. */}
          {floor !== null && floorPct > 0 && (
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
            className="absolute inset-y-0"
            style={{ left: `${floorPct}%`, right: 0, background: ramp }}
          />
          {/* Topical ceiling: the mark a figure has to clear to mean anything. */}
          {ceilingPct !== null && (
            <div
              className="absolute inset-y-0 w-px bg-background/80"
              style={{ left: `${ceilingPct}%` }}
            />
          )}
        </div>

        <div
          className="absolute top-0 flex flex-col items-center"
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

      {/* Anchors, positioned where they actually fall rather than at thirds. */}
      {floor !== null ? (
        <div className="relative h-3.5 font-sans text-[9px] text-muted-foreground">
          <span className="absolute left-0">unreachable</span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.min(84, Math.max(14, floorPct))}%` }}
          >
            <MetricTerm termKey="floor" placement="top">
              floor {floor.toFixed(3)}
            </MetricTerm>
          </span>
          {/* When floor and ceiling are close the two labels collide, and
              that is precisely the case where the ceiling matters most:
              a model with a narrow band between "unrelated" and "merely
              on the same subject" has almost no room in which a result
              can mean anything. Drop it to a second line rather than
              suppressing it. */}
          {ceilingPct !== null && ceiling !== null && Math.abs(ceilingPct - floorPct) > 16 && (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${Math.min(90, Math.max(22, ceilingPct))}%` }}
            >
              <MetricTerm termKey="topicalCeiling" placement="top">
                same subject {ceiling.toFixed(3)}
              </MetricTerm>
            </span>
          )}
          <span className="absolute right-0">identical</span>
        </div>
      ) : null}

      {floor !== null && ceiling !== null && Math.abs(pct(ceiling) - floorPct) <= 16 ? (
        <div className="relative h-3 font-sans text-[9px] text-muted-foreground">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.min(88, Math.max(16, pct(ceiling)))}%` }}
          >
            <MetricTerm termKey="topicalCeiling" placement="top">
              same subject {ceiling.toFixed(3)}
            </MetricTerm>
          </span>
        </div>
      ) : null}

      {floor === null ? (
        <div className="flex justify-between font-sans text-[9px] text-muted-foreground">
          <span className="text-warning-600">
            <MetricTerm termKey="uncalibrated" placement="top">
              unmeasured scale
            </MetricTerm>
          </span>
          <span>identical</span>
        </div>
      ) : null}
    </div>
  );
}

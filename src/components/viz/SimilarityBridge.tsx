"use client";

import { similarityColor } from "@/lib/similarity-scale";
import { normalisedPosition } from "@/lib/calibration/baseline";

interface SimilarityBridgeProps {
  nameA: string;
  nameB: string;
  similarity: number;
  subtitle?: string;
  /**
   * Measured floor. Both the colour and the length of the gap are read
   * against it: a raw cosine of 0.60 is a wide gap in a model whose
   * floor is 0.12 and no gap at all in one whose floor is 0.57, so
   * drawing both the same length would state the opposite of the case.
   */
  floor?: number | null;
  /**
   * Set when the value is not a cosine at all, such as the Silence
   * Detector's density ratio, which centres on 1.0 rather than running
   * from a floor to identity. Colouring a ratio on the similarity ramp
   * paints every normal reading red.
   */
  notACosine?: boolean;
}

export function SimilarityBridge({
  nameA,
  nameB,
  similarity,
  subtitle,
  floor = null,
  notACosine = false,
}: SimilarityBridgeProps) {
  // Distance as a share of the reachable range, so the drawn gap means
  // the same thing in every model.
  const distance = notACosine
    ? Math.min(1, Math.abs(1 - similarity) * 4)
    : floor === null
      ? 1 - similarity
      : 1 - Math.max(0, Math.min(1, normalisedPosition(similarity, floor)));
  const dashCount = Math.max(3, Math.round(Math.max(20, Math.min(80, distance * 200)) / 3));
  const dashes = "—".repeat(dashCount);
  // A dimension line, not a connector. The heads point outward to the
  // two things being measured, which is what says the drawn gap is the
  // separation itself rather than a link between them. Double-headed
  // because the relation is symmetric: a single head would imply a
  // direction from A to B that a cosine does not have.
  const leftRun = `←${dashes}`;
  const rightRun = `${dashes}→`;
  // A ratio is read as departure from parity, not as position on a
  // similarity scale, so it gets a neutral colour unless it is skewed.
  const color = notACosine
    ? Math.abs(1 - similarity) < 0.05
      ? "#65a30d"
      : Math.abs(1 - similarity) < 0.2
        ? "#d97706"
        : "#dc2626"
    : similarityColor(similarity, floor);

  return (
    <div>
      <div className="flex items-center justify-center gap-0 my-1">
        <span className="font-sans text-[13px] font-semibold text-foreground uppercase tracking-wide whitespace-nowrap">
          {nameA}
        </span>
        <span
          className="mx-1.5 text-[11px] tabular-nums tracking-tighter overflow-hidden whitespace-nowrap"
          style={{ color }}
          aria-hidden="true"
        >
          {leftRun}
        </span>
        <span
          className="font-sans text-[15px] font-bold tabular-nums flex-shrink-0"
          style={{ color }}
        >
          {similarity.toFixed(4)}
        </span>
        <span
          className="mx-1.5 text-[11px] tabular-nums tracking-tighter overflow-hidden whitespace-nowrap"
          style={{ color }}
          aria-hidden="true"
        >
          {rightRun}
        </span>
        <span className="font-sans text-[13px] font-semibold text-foreground uppercase tracking-wide whitespace-nowrap">
          {nameB}
        </span>
      </div>
      {subtitle && (
        <p className="text-center font-sans text-[10px]" style={{ color }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

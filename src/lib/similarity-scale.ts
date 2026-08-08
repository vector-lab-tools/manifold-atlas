/**
 * Unified similarity scale used across all components.
 *
 * The fixed bands below (0.95 / 0.85 / 0.7 / 0.5 / 0.3) are stipulated
 * constants. They are retained because a result has to be renderable
 * before a model has been calibrated, but they are not defensible as
 * measurements: where a model's unrelated-pair floor sits at 0.70,
 * "High Distinction" at 0.30 names a region no pair of real texts ever
 * occupies.
 *
 * Prefer the calibrated variants. They take the same bands but read
 * them as positions on the model's own floor-to-identity range, so the
 * label describes where the pair sits in the space the model actually
 * uses. Components should pass a floor when one is available and fall
 * back to the fixed scale with the uncalibrated flag set, so the
 * interface can say which of the two it is showing.
 */

import { normalisedPosition } from "@/lib/calibration/baseline";
import type { ResolvedThreshold } from "@/lib/calibration/threshold";

export interface SimilarityLevel {
  /** The finding, on its own. Short enough to read at a glance. */
  label: string;
  /**
   * The reason, rendered small on its own line beneath the label. Kept
   * separate so the verdict is not buried in the sentence that supports
   * it; a reader scanning six models wants the verdict first.
   */
  detail?: string;
  color: string;
  bgColor: string;
  severity: "critical" | "high" | "moderate" | "low" | "none";
  /** True when the level came from the fixed bands rather than a measured floor. */
  uncalibrated?: boolean;
}

const CRITICAL = { color: "#dc2626", bgColor: "rgba(220,38,38,0.08)", severity: "critical" as const };
const HIGH = { color: "#ea580c", bgColor: "rgba(234,88,12,0.08)", severity: "high" as const };
const MODERATE = { color: "#d97706", bgColor: "rgba(217,119,6,0.08)", severity: "moderate" as const };
const LOW = { color: "#65a30d", bgColor: "rgba(101,163,13,0.08)", severity: "low" as const };
const NONE = { color: "#16a34a", bgColor: "rgba(22,163,74,0.08)", severity: "none" as const };
const NONE_STRONG = { color: "#15803d", bgColor: "rgba(21,128,61,0.08)", severity: "none" as const };

/**
 * For concept distance: high similarity between different concepts
 * is noteworthy but not necessarily problematic.
 */
export function conceptSimilarityLevel(similarity: number): SimilarityLevel {
  if (similarity >= 0.95) return { label: "Indistinguishable", ...CRITICAL, uncalibrated: true };
  if (similarity >= 0.85) return { label: "Very Similar", ...HIGH, uncalibrated: true };
  if (similarity >= 0.7) return { label: "Somewhat Similar", ...MODERATE, uncalibrated: true };
  if (similarity >= 0.5) return { label: "Moderate Distinction", ...LOW, uncalibrated: true };
  if (similarity >= 0.3) return { label: "High Distinction", ...NONE, uncalibrated: true };
  return { label: "Distinctive Concepts", ...NONE_STRONG, uncalibrated: true };
}

/**
 * Concept distance read against a measured floor. The bands are the
 * same numbers, applied to the position on the floor-to-identity range
 * rather than to the raw cosine.
 *
 * Pass floorMean = null to fall back to the fixed scale.
 */
export function calibratedConceptLevel(
  similarity: number,
  floorMean: number | null
): SimilarityLevel {
  if (floorMean === null) return conceptSimilarityLevel(similarity);
  return levelFromPosition(normalisedPosition(similarity, floorMean));
}

/**
 * Band for a floor-to-identity position that has already been computed.
 *
 * Needed wherever the headline figure is an aggregate across models. A
 * mean of raw cosines from models with different floors is not a
 * quantity, so those views average the per-model positions instead and
 * band the result here.
 */
export function levelFromPosition(p: number): SimilarityLevel {
  if (p >= 0.95) return { label: "Indistinguishable", ...CRITICAL };
  if (p >= 0.85) return { label: "Very close on this model's scale", ...HIGH };
  if (p >= 0.7) return { label: "Close on this model's scale", ...MODERATE };
  if (p >= 0.5) return { label: "Midway between floor and identity", ...LOW };
  if (p >= 0.3) return { label: "Well separated", ...NONE };
  return { label: "Near the floor: barely above unrelated text", ...NONE_STRONG };
}

/**
 * Negation verdicts.
 *
 * The labels say how far apart the model puts the two sentences, and
 * nothing more. An earlier version said "negation registered" and
 * "negation lost", which imputes an act of recognition: it claims the
 * model noticed the negation, where all that was measured is proximity.
 * Two sentences can sit far apart for reasons that have nothing to do
 * with the reversal, and a model that separates them has not thereby
 * understood that one denies the other.
 *
 * The negation-specific claim lives in the reason line instead, because
 * only one comparison licenses it: the negation sitting closer to the
 * claim than an edit of the same size that leaves the claim standing.
 * That is about "not" specifically. The position on the scale is not.
 *
 * This follows the same decision made for the Agonism Test, whose
 * labels were changed from "opposition preserved / collapsed" to
 * observation-only wording for the same reason.
 *
 * Retained for uncalibrated rendering. Prefer calibratedNegationLevel.
 */
export function negationSimilarityLevel(similarity: number, threshold: number): SimilarityLevel {
  if (similarity >= threshold) return {
    label: "Almost the same",
    detail: "the claim and its opposite sit together, on an unmeasured scale",
    ...CRITICAL, uncalibrated: true,
  };
  if (similarity >= threshold - 0.05) return {
    label: "Borderline",
    detail: "right on the cutoff, on an unmeasured scale",
    ...HIGH, uncalibrated: true,
  };
  if (similarity >= 0.7) return {
    label: "Barely different",
    detail: "the opposite sits close to the claim, on an unmeasured scale",
    ...MODERATE, uncalibrated: true,
  };
  if (similarity >= 0.5) return {
    label: "Somewhat different",
    detail: "on an unmeasured scale",
    ...LOW, uncalibrated: true,
  };
  return {
    label: "Clearly different",
    detail: "claim and opposite well apart, on an unmeasured scale",
    ...NONE, uncalibrated: true,
  };
}

/**
 * Negation read against the resolved threshold and the control family.
 *
 * The strongest statement the instrument can make is not that a cosine
 * cleared a cutoff, but that the negation sits closer to the original
 * than an edit of the same size that does not reverse the claim. Where
 * that comparison is available it takes priority over the band.
 */
export function calibratedNegationLevel(
  similarity: number,
  threshold: ResolvedThreshold,
  exceedsControls: boolean | null,
  floorMean: number | null
): SimilarityLevel {
  if (floorMean === null && threshold.mode === "fixed") {
    return negationSimilarityLevel(similarity, threshold.value);
  }

  if (exceedsControls === true) {
    return {
      label: "Almost the same",
      detail:
        "\u201CNot\u201D is counterintuitively closer to its opposite than swapping in an unrelated word",
      ...CRITICAL,
    };
  }
  if (similarity >= threshold.value) {
    return {
      label: "Almost the same",
      detail: "above the point where this model starts telling texts apart",
      ...CRITICAL,
    };
  }
  if (threshold.value - similarity <= 0.02) {
    return {
      label: "Borderline",
      detail: "right on this model\u2019s cutoff, so a small change of wording could flip it",
      ...HIGH,
    };
  }

  if (floorMean !== null) {
    const p = normalisedPosition(similarity, floorMean);
    if (p >= 0.7) {
      return {
        label: "Barely different",
        detail: "the opposite sits close to the claim on this model\u2019s scale",
        ...MODERATE,
      };
    }
    if (p >= 0.4) {
      return {
        label: "Somewhat different",
        detail: "about midway between the claim and unrelated text",
        ...LOW,
      };
    }
    return {
      label: "Clearly different",
      detail: "the claim and its opposite are well apart on this model\u2019s scale",
      ...NONE,
    };
  }

  return {
    label: "Clearly different",
    detail: "below this model\u2019s cutoff",
    ...NONE,
  };
}

/**
 * Colour for a similarity value on the unified scale. Pass a floor to
 * colour by position rather than by raw cosine.
 */
export function similarityColor(similarity: number, floorMean: number | null = null): string {
  const v = floorMean === null ? similarity : normalisedPosition(similarity, floorMean);
  if (v >= 0.85) return "#dc2626";
  if (v >= 0.7) return "#ea580c";
  if (v >= 0.5) return "#d97706";
  if (v >= 0.3) return "#65a30d";
  return "#16a34a";
}

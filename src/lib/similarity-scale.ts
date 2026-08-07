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
  label: string;
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
  const p = normalisedPosition(similarity, floorMean);
  if (p >= 0.95) return { label: "Indistinguishable", ...CRITICAL };
  if (p >= 0.85) return { label: "Very close on this model's scale", ...HIGH };
  if (p >= 0.7) return { label: "Close on this model's scale", ...MODERATE };
  if (p >= 0.5) return { label: "Midway between floor and identity", ...LOW };
  if (p >= 0.3) return { label: "Well separated", ...NONE };
  return { label: "Near the floor: barely above unrelated text", ...NONE_STRONG };
}

/**
 * For negation gauge: high similarity between a claim and its
 * negation is ALWAYS a problem. The scale reflects this.
 *
 * Retained for uncalibrated rendering. Prefer calibratedNegationLevel.
 */
export function negationSimilarityLevel(similarity: number, threshold: number): SimilarityLevel {
  if (similarity >= threshold) return {
    label: "Collapsed: the geometry barely registers the negation",
    ...CRITICAL, uncalibrated: true,
  };
  if (similarity >= threshold - 0.05) return {
    label: "Near-collapse: the negation nudges the position but little more",
    ...HIGH, uncalibrated: true,
  };
  if (similarity >= 0.7) return {
    label: "Weak distinction: the claim and its negation remain close neighbours",
    ...MODERATE, uncalibrated: true,
  };
  if (similarity >= 0.5) return {
    label: "Partial distinction: some separation, but far less than logic would require",
    ...LOW, uncalibrated: true,
  };
  return {
    label: "Adequate separation: claim and negation occupy distinct regions",
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
      label:
        "Collapsed: the negation is closer than every same-size edit that does not reverse the claim",
      ...CRITICAL,
    };
  }

  const margin = threshold.value - similarity;
  if (similarity >= threshold.value) {
    return { label: "Collapsed: at or above the control threshold", ...CRITICAL };
  }
  if (margin <= 0.02) {
    return { label: "Borderline: within 0.02 of the control threshold", ...HIGH };
  }

  if (floorMean !== null) {
    const p = normalisedPosition(similarity, floorMean);
    if (p >= 0.7) return {
      label: "Weak distinction: the negation stays high on this model's scale",
      ...MODERATE,
    };
    if (p >= 0.4) return {
      label: "Partial distinction: less separation than logic would require",
      ...LOW,
    };
    return { label: "Adequate separation on this model's scale", ...NONE };
  }

  return { label: "Below the control threshold", ...NONE };
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

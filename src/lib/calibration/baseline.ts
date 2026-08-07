/**
 * Baseline statistics for a model's embedding space.
 *
 * A cosine of 0.85 means nothing on its own. Sentence embedding spaces
 * are anisotropic: the vectors occupy a narrow cone rather than the
 * whole sphere, so unrelated texts already sit at a high cosine, and
 * that starting value differs from model to model. Reporting a raw
 * cosine without the floor it sits above is reporting a position with
 * no origin.
 *
 * This module computes the floor from the calibration corpus and
 * provides the rescalings that make a cosine comparable, both within a
 * model and across models.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";

export interface Distribution {
  n: number;
  mean: number;
  sd: number;
  min: number;
  p05: number;
  p50: number;
  p95: number;
  max: number;
}

export const EMPTY_DISTRIBUTION: Distribution = {
  n: 0, mean: 0, sd: 0, min: 0, p05: 0, p50: 0, p95: 0, max: 0,
};

/** Summarise a sample. Returns EMPTY_DISTRIBUTION for an empty input. */
export function describe(values: number[]): Distribution {
  const n = values.length;
  if (n === 0) return EMPTY_DISTRIBUTION;

  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;

  let sq = 0;
  for (const v of values) sq += (v - mean) * (v - mean);
  // Sample standard deviation; n === 1 has no dispersion to report.
  const sd = n > 1 ? Math.sqrt(sq / (n - 1)) : 0;

  const sorted = [...values].sort((a, b) => a - b);
  return {
    n,
    mean,
    sd,
    min: sorted[0],
    p05: quantile(sorted, 0.05),
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted[n - 1],
  };
}

/** Linear-interpolated quantile of an already-sorted array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * All pairwise cosines within a set of vectors.
 *
 * Capped by maxPairs: with 64 vectors this is 2016 pairs, which is
 * cheap, but the prose stratum and any future larger corpus would
 * grow quadratically. When the cap bites, pairs are taken on a fixed
 * stride so the sample stays deterministic across runs.
 */
export function pairwiseCosines(vectors: number[][], maxPairs = 4000): number[] {
  const n = vectors.length;
  const out: number[] = [];
  if (n < 2) return out;

  const total = (n * (n - 1)) / 2;
  const stride = total > maxPairs ? Math.ceil(total / maxPairs) : 1;

  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (k % stride === 0) out.push(cosineSimilarity(vectors[i], vectors[j]));
      k++;
    }
  }
  return out;
}

/** Cosines of explicit index pairs, used for the topical ceiling. */
export function pairCosinesAt(
  vectors: number[][],
  pairs: Array<[number, number]>
): number[] {
  return pairs
    .filter(([a, b]) => vectors[a] && vectors[b])
    .map(([a, b]) => cosineSimilarity(vectors[a], vectors[b]));
}

/**
 * Position of a cosine on the floor-to-identity scale, in [0, 1].
 *
 * 0 means the pair is no closer than two unrelated texts in this model.
 * 1 means the pair is at identity. This is the number to quote when
 * comparing across models, because the raw cosine is not comparable
 * when the models' floors differ.
 */
export function normalisedPosition(cos: number, floorMean: number): number {
  const range = 1 - floorMean;
  if (range <= 1e-9) return 1;
  return (cos - floorMean) / range;
}

/** Standard deviations above the floor. */
export function floorZ(cos: number, floorMean: number, floorSd: number): number {
  if (floorSd <= 1e-9) return 0;
  return (cos - floorMean) / floorSd;
}

/**
 * Angular position as a fraction of the model's reachable angular
 * range. The Negation Gauge previously reported acos(cos) in degrees
 * against an implied 0-180 range, but no pair of sentences in an
 * anisotropic space ever reaches 180 degrees. The reachable maximum is
 * roughly acos(floor), and that is the denominator this uses.
 */
export function angularFraction(cos: number, floorMean: number): number {
  const clamped = Math.max(-1, Math.min(1, cos));
  const maxAngle = Math.acos(Math.max(-1, Math.min(1, floorMean)));
  if (maxAngle <= 1e-9) return 1;
  return 1 - Math.acos(clamped) / maxAngle;
}

/** Degrees of arc between two vectors, given their cosine. */
export function angleDegrees(cos: number): number {
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

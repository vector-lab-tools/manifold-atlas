/**
 * Turn a model's calibration vectors into a stored calibration record.
 *
 * One record per model. Everything downstream (bands, thresholds,
 * normalised positions, the radius card) reads from this.
 */

import {
  CORPUS_VERSION,
  TOPICAL_PAIRS,
  stratumRanges,
  calibrationTextList,
} from "./corpus";
import {
  describe,
  pairwiseCosines,
  pairCosinesAt,
  type Distribution,
} from "./baseline";
import { computeModelRadius, type ModelRadius } from "./radius";

export interface ModelCalibration {
  modelId: string;
  modelName: string;
  providerId: string;
  /** Unix ms. Stamped by the caller, since the pure module takes no clock. */
  computedAt: number;
  corpusVersion: number;

  /**
   * Floor measured on the short-declarative stratum. This is the one to
   * quote alongside Negation Gauge and Concept Distance results, because
   * those probes are short declaratives themselves.
   */
  shortFloor: Distribution;
  /** Floor measured on longer prose, for operations that embed paragraphs. */
  proseFloor: Distribution;
  /** Same-subject, no shared structure. The topical ceiling. */
  topicalCeiling: Distribution;

  radius: ModelRadius;
}

/** Texts a calibration run needs to embed. Re-exported for callers. */
export { calibrationTextList };

/**
 * Build the calibration record from one model's vectors.
 *
 * @param vectors    in the order returned by calibrationTextList()
 * @param computedAt Unix ms, supplied by the caller
 */
export function computeCalibration(
  model: { id: string; name: string; providerId: string },
  vectors: number[][],
  computedAt: number
): ModelCalibration {
  const ranges = stratumRanges();
  const expected = calibrationTextList().length;
  if (vectors.length !== expected) {
    throw new Error(
      `Calibration expected ${expected} vectors for ${model.id}, received ${vectors.length}`
    );
  }

  const shortVecs = vectors.slice(...ranges.shortDeclarative);
  const proseVecs = vectors.slice(...ranges.neutralProse);

  // Topical pairs are stored flat as [a0, b0, a1, b1, ...] from the
  // start of the topical stratum, so the pair indices are consecutive.
  const topicalStart = ranges.topical[0];
  const topicalIdx: Array<[number, number]> = TOPICAL_PAIRS.map((_, i) => [
    topicalStart + i * 2,
    topicalStart + i * 2 + 1,
  ]);

  const shortFloor = describe(pairwiseCosines(shortVecs));
  const proseFloor = describe(pairwiseCosines(proseVecs));
  const topicalCeiling = describe(pairCosinesAt(vectors, topicalIdx));

  // Cone angle and floor come from the short-declarative stratum, so the
  // cone described is the one the probes actually sit in. Mixing
  // registers there would widen the apparent cone for reasons that have
  // nothing to do with the model. The dimension statistics take the
  // whole corpus, because the participation ratio is sample-limited in
  // a way the angular measures are not.
  const radius = computeModelRadius(shortVecs, shortFloor.mean, vectors);

  return {
    modelId: model.id,
    modelName: model.name,
    providerId: model.providerId,
    computedAt,
    corpusVersion: CORPUS_VERSION,
    shortFloor,
    proseFloor,
    topicalCeiling,
    radius,
  };
}

/** Which floor a given operation should be read against. */
export type Register = "short" | "prose";

export function floorFor(cal: ModelCalibration, register: Register = "short"): Distribution {
  return register === "prose" ? cal.proseFloor : cal.shortFloor;
}

/** A calibration computed against a superseded corpus should not be used. */
export function isStale(cal: ModelCalibration): boolean {
  return cal.corpusVersion !== CORPUS_VERSION;
}

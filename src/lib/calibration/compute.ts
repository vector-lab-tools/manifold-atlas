/**
 * Turn a model's calibration vectors into a stored calibration record.
 *
 * One record per model. Everything downstream (bands, thresholds,
 * normalised positions, the radius card) reads from this.
 *
 * Floors are per register. A bare term, a short declarative and a
 * paragraph do not sit at the same place in the cone, so an operation
 * has to be read against the floor for the kind of text it embeds. The
 * `Register` type names the three, and every operation declares which
 * one it works in.
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
import { computeModelRadius, coneHalfAngleOf, type ModelRadius } from "./radius";

/** The kind of text an operation embeds. */
export type Register = "term" | "short" | "prose";

export const REGISTER_LABELS: Record<Register, string> = {
  term: "bare terms",
  short: "short declaratives",
  prose: "prose",
};

export interface ModelCalibration {
  modelId: string;
  modelName: string;
  providerId: string;
  /** Unix ms. Stamped by the caller, since the pure module takes no clock. */
  computedAt: number;
  corpusVersion: number;

  /**
   * Floor for bare terms and short noun phrases. The one to quote
   * alongside Concept Distance, Distance Matrix, Hegemony Compass,
   * Silence Detector and Vector Logic.
   */
  termFloor: Distribution;
  /**
   * Floor for short declarative sentences. The one to quote alongside
   * Negation Gauge, Negation Battery, Vector Drift and Agonism Test.
   */
  shortFloor: Distribution;
  /** Floor for longer prose, for operations that embed paragraphs. */
  proseFloor: Distribution;
  /** Same-subject, no shared structure. The topical ceiling. */
  topicalCeiling: Distribution;

  /**
   * Angular radius per register. The cone is not the same width for a
   * two-word term as for a paragraph, so a compass or a distance matrix
   * has to be read against its own register's cone rather than against
   * the headline figure.
   */
  coneByRegister: Record<Register, number>;

  /**
   * Headline radius profile. Angular measures come from the short
   * declarative stratum; the dimension and norm statistics are
   * properties of the model's output rather than of a register, and are
   * computed over the whole corpus.
   */
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

  const termVecs = vectors.slice(...ranges.terms);
  const shortVecs = vectors.slice(...ranges.shortDeclarative);
  const proseVecs = vectors.slice(...ranges.neutralProse);

  // Topical pairs are stored flat as [a0, b0, a1, b1, ...] from the
  // start of the topical stratum, so the pair indices are consecutive.
  const topicalStart = ranges.topical[0];
  const topicalIdx: Array<[number, number]> = TOPICAL_PAIRS.map((_, i) => [
    topicalStart + i * 2,
    topicalStart + i * 2 + 1,
  ]);

  const termFloor = describe(pairwiseCosines(termVecs));
  const shortFloor = describe(pairwiseCosines(shortVecs));
  const proseFloor = describe(pairwiseCosines(proseVecs));
  const topicalCeiling = describe(pairCosinesAt(vectors, topicalIdx));

  // Cone angle and floor come from the short-declarative stratum, so the
  // headline cone is the one the negation probes sit in. Mixing
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
    termFloor,
    shortFloor,
    proseFloor,
    topicalCeiling,
    coneByRegister: {
      term: coneHalfAngleOf(termVecs),
      short: coneHalfAngleOf(shortVecs),
      prose: coneHalfAngleOf(proseVecs),
    },
    radius,
  };
}

/** The floor an operation in this register should be read against. */
export function floorFor(cal: ModelCalibration, register: Register = "short"): Distribution {
  if (register === "term") return cal.termFloor;
  if (register === "prose") return cal.proseFloor;
  return cal.shortFloor;
}

/** The cone half-angle for a register, in degrees. */
export function coneFor(cal: ModelCalibration, register: Register = "short"): number {
  return cal.coneByRegister?.[register] ?? cal.radius.coneHalfAngleDeg;
}

/**
 * How much of the cosine scale is reachable in this register. Compass
 * axis magnitudes and any other difference-of-cosines quantity should
 * be divided by this to become comparable across models, since a
 * difference cancels the floor but not the scale.
 */
export function usableRangeFor(cal: ModelCalibration, register: Register = "short"): number {
  return 1 - floorFor(cal, register).mean;
}

/** A calibration computed against a superseded corpus should not be used. */
export function isStale(cal: ModelCalibration): boolean {
  return cal.corpusVersion !== CORPUS_VERSION;
}

/**
 * Model radius: the shape and extent of the region a model actually uses.
 *
 * "Signal the radius of the model" was the comment from the floor, and
 * it is not answered by one number. A model's embedding space has a
 * size in several independent senses, and a cosine can only be read
 * against all of them:
 *
 *  1. ANGULAR RADIUS. Embeddings do not fill the sphere. They sit in a
 *     cone around a single mean direction. Write each unit vector as
 *     v_i = cos(a_i) u + sin(a_i) w_i, with u the mean direction and
 *     w_i orthogonal to it. In high dimension the w_i are close to
 *     mutually orthogonal, so E[v_i . v_j] ~ E[cos a]^2 = |mean of the
 *     unit vectors|^2. The norm of the mean direction is therefore a
 *     direct measure of how tight the cone is, and
 *
 *         coneHalfAngle = acos(|mean of unit vectors|)
 *
 *     is the model's angular radius in degrees. A model at 40 degrees
 *     has less than half the angular room of a model at 85 degrees, and
 *     the same raw cosine in the two means completely different things.
 *
 *  2. USABLE RANGE. Cosine is nominally [-1, 1] but the reachable range
 *     is [floor, 1], and 1 - floor can be small. When the usable range
 *     is 0.25, a difference of 0.03 is an eighth of everything the
 *     instrument can register.
 *
 *  3. NORM RADIUS. Some providers return L2-normalised vectors and some
 *     do not. Where norms vary, cosine is discarding magnitude the model
 *     is using, and that should be visible rather than assumed away.
 *
 *  4. EFFECTIVE DIMENSION. A nominally 1536-dimensional model whose
 *     variance is concentrated in a few directions has a much smaller
 *     space than its dimension count advertises. Reported here as the
 *     participation ratio of the covariance eigenvalues, computed
 *     without an eigendecomposition (see effectiveDimension below), plus
 *     the variance share of the single most dominant coordinate, which
 *     is the rogue-dimension diagnostic.
 *
 * Together these make the cross-model comparison honest: two models are
 * only comparable on raw cosine if their radii agree, and they generally
 * do not.
 */

export interface ModelRadius {
  /** Dimensionality the provider returns. */
  nominalDim: number;

  /**
   * Norm of the mean of the L2-normalised vectors, corrected for
   * sample size (see the note on bias below). In [0, 1].
   */
  meanDirectionNorm: number;
  /** The uncorrected value, kept so the correction is inspectable. */
  meanDirectionNormRaw: number;
  /** acos(meanDirectionNorm) in degrees. The angular radius of the cone. */
  coneHalfAngleDeg: number;
  /** Implied mean pairwise cosine, meanDirectionNorm^2. Cross-check on the floor. */
  impliedFloor: number;

  /** Distribution of raw vector norms before normalisation. */
  meanNorm: number;
  normCv: number;
  /** True when every returned vector already has unit length. */
  apiNormalised: boolean;

  /** 1 - measured floor. How much of the cosine scale is in play. */
  usableRange: number;
  /** acos(floor) in degrees. The largest separation two texts can show. */
  angularRangeDeg: number;

  /** Participation ratio of the covariance spectrum. */
  effectiveDim: number;
  /**
   * The largest participation ratio this sample size could produce even
   * from a perfectly isotropic space. With few samples relative to the
   * dimension, the observed ratio is capped well below the nominal
   * dimension for reasons that have nothing to do with the model.
   */
  effectiveDimCeiling: number;
  /**
   * effectiveDim / effectiveDimCeiling, in [0, 1]. Read this rather
   * than the ratio to the nominal dimension: 1 means the sample is as
   * spread as this many texts could show, and a low value means the
   * variance is genuinely concentrated.
   */
  dimensionEfficiency: number;
  /** Number of vectors the spectrum was estimated from. */
  spectrumSampleSize: number;
  /** Variance share of the single largest coordinate. */
  topDimShare: number;
  /** Combined variance share of the five largest coordinates. */
  top5DimShare: number;
}

function l2norm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/**
 * Participation ratio of the covariance eigenvalues,
 *
 *     PR = (sum of eigenvalues)^2 / (sum of squared eigenvalues)
 *
 * computed from traces rather than from an eigendecomposition. With X
 * the centred n-by-d matrix and G = X X^T its n-by-n Gram matrix, the
 * nonzero eigenvalues of G are those of X^T X, so
 *
 *     sum of eigenvalues  = trace(G)   = sum of squared row norms
 *     sum of squares      = trace(G^2) = squared Frobenius norm of G
 *
 * Both are cheap. PR runs from 1 (all variance in one direction) up to
 * min(n, d) for an isotropic space, and is the standard reading of how
 * many dimensions a representation is really using.
 */
/**
 * Largest participation ratio a sample of this size can produce from a
 * genuinely isotropic space.
 *
 * The sample covariance of m degrees of freedom in d dimensions follows
 * the Marchenko-Pastur law, whose participation ratio is d / (1 + d/m)
 * rather than d. With 64 texts and 1536 dimensions the ceiling is about
 * 61, so an observed value near 61 means "as spread as this many texts
 * can show", not "concentrated in 61 directions". Reporting the ceiling
 * alongside the observation is the difference between a measurement and
 * an artefact of the corpus size.
 */
function participationCeiling(d: number, n: number): number {
  const m = n - 1; // one degree of freedom spent on the mean
  if (m <= 0 || d <= 0) return 0;
  return d / (1 + d / m);
}

function effectiveDimension(centred: number[][]): number {
  const n = centred.length;
  if (n < 2) return 0;

  let traceG = 0;
  for (const row of centred) {
    let s = 0;
    for (let i = 0; i < row.length; i++) s += row[i] * row[i];
    traceG += s;
  }
  if (traceG <= 1e-12) return 0;

  // Squared Frobenius norm of the Gram matrix. Symmetric, so the
  // off-diagonal block is computed once and counted twice.
  let frob = 0;
  for (let i = 0; i < n; i++) {
    let dii = 0;
    for (let k = 0; k < centred[i].length; k++) dii += centred[i][k] * centred[i][k];
    frob += dii * dii;
    for (let j = i + 1; j < n; j++) {
      let dot = 0;
      const a = centred[i];
      const b = centred[j];
      for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
      frob += 2 * dot * dot;
    }
  }
  if (frob <= 1e-12) return 0;
  return (traceG * traceG) / frob;
}

/** Per-coordinate variance shares, sorted descending. */
function dimensionVarianceShares(centred: number[][]): number[] {
  const n = centred.length;
  if (n === 0) return [];
  const d = centred[0].length;
  const variance = new Array(d).fill(0);
  for (const row of centred) {
    for (let i = 0; i < d; i++) variance[i] += row[i] * row[i];
  }
  let total = 0;
  for (let i = 0; i < d; i++) total += variance[i];
  if (total <= 1e-12) return [];
  return variance.map(v => v / total).sort((a, b) => b - a);
}

/**
 * Compute the radius profile from the calibration vectors.
 *
 * @param vectors          the register-matched stratum. Cone angle and
 *                         floor are measured here, so that the cone
 *                         described is the one the probes sit in.
 * @param floorMean        measured mean pairwise cosine of that stratum
 * @param spectrumVectors  optional larger set for the dimension
 *                         statistics, which are sample-hungry in a way
 *                         the angular measures are not. Defaults to
 *                         `vectors`.
 */
export function computeModelRadius(
  vectors: number[][],
  floorMean: number,
  spectrumVectors?: number[][]
): ModelRadius {
  const n = vectors.length;
  if (n === 0) {
    return {
      nominalDim: 0,
      meanDirectionNorm: 0, meanDirectionNormRaw: 0, coneHalfAngleDeg: 90, impliedFloor: 0,
      meanNorm: 0, normCv: 0, apiNormalised: false,
      usableRange: 1, angularRangeDeg: 90,
      effectiveDim: 0, effectiveDimCeiling: 0, dimensionEfficiency: 0,
      spectrumSampleSize: 0, topDimShare: 0, top5DimShare: 0,
    };
  }

  const d = vectors[0].length;

  // Raw norms, before any normalisation. Providers differ here.
  const norms = vectors.map(l2norm);
  const meanNorm = norms.reduce((s, v) => s + v, 0) / n;
  const normSd = Math.sqrt(
    norms.reduce((s, v) => s + (v - meanNorm) * (v - meanNorm), 0) / Math.max(1, n - 1)
  );
  const normCv = meanNorm > 1e-9 ? normSd / meanNorm : 0;
  const apiNormalised = Math.abs(meanNorm - 1) < 1e-3 && normCv < 1e-3;

  // Unit vectors, so the mean direction measures angle alone.
  const unit = vectors.map((v, i) => {
    const nrm = norms[i];
    if (nrm < 1e-12) return v.slice();
    return v.map(x => x / nrm);
  });

  const meanDir = new Array(d).fill(0);
  for (const v of unit) {
    for (let i = 0; i < d; i++) meanDir[i] += v[i];
  }
  for (let i = 0; i < d; i++) meanDir[i] /= n;
  const meanDirectionNormRaw = Math.min(1, l2norm(meanDir));

  // The mean of n random unit vectors has expected squared norm 1/n even
  // when the space is perfectly isotropic, so the raw value reports a
  // cone that is not there. Since
  //
  //     E[ ‖mean‖² ] = 1/n + (1 − 1/n) · E[cos]
  //
  // the expected pairwise cosine follows by inversion, and that is the
  // quantity the cone angle should be taken from. Without this, a
  // 64-text stratum could never report a cone wider than about 83°.
  const rawSq = meanDirectionNormRaw * meanDirectionNormRaw;
  const impliedFloor =
    n > 1 ? Math.max(0, Math.min(1, (rawSq - 1 / n) / (1 - 1 / n))) : rawSq;
  const meanDirectionNorm = Math.sqrt(impliedFloor);
  const coneHalfAngleDeg = (Math.acos(meanDirectionNorm) * 180) / Math.PI;

  // Centre on the mean direction before measuring spread, so the
  // anisotropy is not counted again as variance. The spectrum uses the
  // wider sample where one was given, since the participation ratio is
  // far more sample-limited than the angular measures.
  const spectrumSource = spectrumVectors && spectrumVectors.length > n ? spectrumVectors : vectors;
  const spectrumUnit = spectrumSource.map(v => {
    const nrm = l2norm(v);
    return nrm < 1e-12 ? v.slice() : v.map(x => x / nrm);
  });
  const spectrumMean = new Array(d).fill(0);
  for (const v of spectrumUnit) {
    for (let i = 0; i < d; i++) spectrumMean[i] += v[i];
  }
  for (let i = 0; i < d; i++) spectrumMean[i] /= spectrumUnit.length;
  const centred = spectrumUnit.map(v => v.map((x, i) => x - spectrumMean[i]));

  const effectiveDim = effectiveDimension(centred);
  const effectiveDimCeiling = participationCeiling(d, spectrumUnit.length);
  const shares = dimensionVarianceShares(centred);

  const clampedFloor = Math.max(-1, Math.min(1, floorMean));

  return {
    nominalDim: d,
    meanDirectionNorm,
    meanDirectionNormRaw,
    coneHalfAngleDeg,
    impliedFloor,
    meanNorm,
    normCv,
    apiNormalised,
    usableRange: 1 - clampedFloor,
    angularRangeDeg: (Math.acos(clampedFloor) * 180) / Math.PI,
    effectiveDim,
    effectiveDimCeiling,
    dimensionEfficiency: effectiveDimCeiling > 0 ? effectiveDim / effectiveDimCeiling : 0,
    spectrumSampleSize: spectrumUnit.length,
    topDimShare: shares[0] ?? 0,
    top5DimShare: shares.slice(0, 5).reduce((s, v) => s + v, 0),
  };
}

/**
 * Whether two models can be compared on raw cosine at all.
 *
 * The test is on the floor rather than on the cone angle, because the
 * floor is what a raw cosine is implicitly being read against. A gap of
 * more than 0.05 between two floors means a shared axis is misleading
 * and the normalised position should be plotted instead.
 */
export function rawCosineComparable(floorA: number, floorB: number): boolean {
  return Math.abs(floorA - floorB) <= 0.05;
}

/** One-line description of a model's radius, for captions and exports. */
export function describeRadius(r: ModelRadius, floorMean: number): string {
  return (
    `${r.nominalDim}d, cone half-angle ${r.coneHalfAngleDeg.toFixed(1)}°, ` +
    `floor ${floorMean.toFixed(3)}, usable range ${r.usableRange.toFixed(3)}, ` +
    `effective dim ${r.effectiveDim.toFixed(0)}`
  );
}

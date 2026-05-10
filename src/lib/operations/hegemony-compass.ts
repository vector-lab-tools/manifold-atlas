/**
 * Hegemony Compass — pure compute.
 *
 * For each concept, computes its position on a 2D compass defined by
 * two axes. Each axis is defined by two poles; each pole is defined by
 * a list of sentences whose embeddings are averaged to form the pole's
 * centroid. The concept's position on an axis is the difference of its
 * average cosine similarity to the two pole sentence sets:
 *
 *   x = avg_sim(concept, xPos_terms) - avg_sim(concept, xNeg_terms)
 *
 * Also returns per-model axis statistics (inter-pole cosine, axis norm,
 * intra-pole coherence, centroid norm) so the Runner's deep dive can
 * render the same summary that the standalone compass view shows.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import { COMPASS_PRESETS, type CompassAxis, type CompassPreset } from "@/lib/compass-presets";

export { COMPASS_PRESETS };
export type { CompassAxis, CompassPreset };

export interface HegemonyCompassInputs {
  /** Preset name (one of COMPASS_PRESETS keys). Overridden by explicit axes. */
  preset?: string;
  /** Explicit X-axis override (ignored when preset resolves). */
  xAxis?: CompassAxis;
  /** Explicit Y-axis override. */
  yAxis?: CompassAxis;
  /** Concepts to plot. Falls back to the preset's defaults if omitted. */
  concepts?: string[];
  /**
   * Concept-guided amplification factors. Each is a scalar α applied
   * along the normalised axis direction (xPosCentroid − xNegCentroid,
   * yPosCentroid − yNegCentroid). Positive α amplifies alignment with
   * the positive pole; α ∈ [−1, 0) attenuates; α = −1 removes the
   * linear contribution. Defaults to 0 (baseline view). Following the
   * mean-difference / contrastive-activation steering literature
   * (Mikolov 2013; Park, Choe & Veitch 2024; Rimsky et al. 2024) and
   * the Latent Manipulator visualisation system (CHI EA '26).
   */
  amplification?: { x?: number; y?: number };
}

/**
 * Resolve the compass preset and concept list from inputs. Returns
 * null if inputs don't resolve to a valid compass (unknown preset +
 * no inline axes).
 */
export function resolveCompassPreset(inputs: HegemonyCompassInputs): CompassPreset | null {
  if (inputs.xAxis && inputs.yAxis) {
    return {
      name: "Custom",
      xAxis: inputs.xAxis,
      yAxis: inputs.yAxis,
      defaults: inputs.concepts ?? [],
    };
  }
  if (!inputs.preset) return null;
  const p = COMPASS_PRESETS[inputs.preset];
  if (!p) return null;
  return p;
}

/**
 * Flat text list: [concept0, concept1, ..., xNegTerms..., xPosTerms...,
 * yNegTerms..., yPosTerms...]. Mirrors the order the component uses so
 * the same vector slicing works in both places.
 */
export function hegemonyCompassTextList(inputs: HegemonyCompassInputs): string[] {
  const preset = resolveCompassPreset(inputs);
  if (!preset) return [];
  const concepts = inputs.concepts && inputs.concepts.length > 0 ? inputs.concepts : preset.defaults;
  return [
    ...concepts,
    ...preset.xAxis.negative.terms,
    ...preset.xAxis.positive.terms,
    ...preset.yAxis.negative.terms,
    ...preset.yAxis.positive.terms,
  ];
}

export interface HegemonyCompassPointResult {
  concept: string;
  x: number;
  y: number;
  simXNeg: number;
  simXPos: number;
  simYNeg: number;
  simYPos: number;
}

export interface HegemonyCompassPoleStats {
  label: string;
  terms: string[];
  coherence: number;
  centroidNorm: number;
}

export interface HegemonyCompassModelResult {
  modelId: string;
  modelName: string;
  dimensions: number;
  points: HegemonyCompassPointResult[];
  xNeg: HegemonyCompassPoleStats;
  xPos: HegemonyCompassPoleStats;
  yNeg: HegemonyCompassPoleStats;
  yPos: HegemonyCompassPoleStats;
  xInterPoleCosine: number;
  yInterPoleCosine: number;
  xAxisNorm: number;
  yAxisNorm: number;
  /**
   * Mean |x| of plotted concepts: how strongly the points polarise
   * along the X axis. Compass-equivalent of cluster purity from
   * Latent Manipulator (CHI EA '26): higher = the axis is doing more
   * geometric work; rises as amplification α_x increases.
   */
  xPolarisation: number;
  /** Mean |y| of plotted concepts. */
  yPolarisation: number;
  /** Mean distance from origin (sqrt(x²+y²)) — joint polarisation. */
  meanRadialDisplacement: number;
}

export interface HegemonyCompassResult {
  presetName: string;
  concepts: string[];
  xAxisLabels: { negative: string; positive: string };
  yAxisLabels: { negative: string; positive: string };
  models: HegemonyCompassModelResult[];
  /** Echoed back so the UI can show what amplification was applied. */
  amplification: { x: number; y: number };
}

// --- Small helpers kept local so the module has no React deps. ------

function meanVector(vecs: number[][]): number[] {
  const n = vecs.length;
  if (n === 0) return [];
  const out = new Array(vecs[0].length).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < v.length; i++) out[i] += v[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= n;
  return out;
}

function l2Norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

function euclideanDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function meanPairwiseCosine(vecs: number[][]): number {
  const n = vecs.length;
  if (n < 2) return NaN;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += cosineSimilarity(vecs[i], vecs[j]);
      count += 1;
    }
  }
  return count === 0 ? NaN : sum / count;
}

/** Compute Hegemony Compass positions and per-model stats. */
export function computeHegemonyCompass(
  inputs: HegemonyCompassInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): HegemonyCompassResult {
  const preset = resolveCompassPreset(inputs);
  if (!preset) {
    throw new Error(
      `hegemony-compass requires either a "preset" (one of ${Object.keys(COMPASS_PRESETS).join(", ")}) or inline "xAxis" and "yAxis" definitions.`
    );
  }
  const concepts = inputs.concepts && inputs.concepts.length > 0 ? inputs.concepts : preset.defaults;
  const xNegCount = preset.xAxis.negative.terms.length;
  const xPosCount = preset.xAxis.positive.terms.length;
  const yNegCount = preset.yAxis.negative.terms.length;
  const alphaX = inputs.amplification?.x ?? 0;
  const alphaY = inputs.amplification?.y ?? 0;

  const models: HegemonyCompassModelResult[] = [];

  for (const m of enabledModels.filter(m => modelVectors.has(m.id))) {
    const vectors = modelVectors.get(m.id)!;
    const spec = EMBEDDING_MODELS.find(s => s.id === m.id);

    // Axis vectors start after all concepts.
    let offset = concepts.length;
    const xNegVecs = vectors.slice(offset, offset + xNegCount); offset += xNegCount;
    const xPosVecs = vectors.slice(offset, offset + xPosCount); offset += xPosCount;
    const yNegVecs = vectors.slice(offset, offset + yNegCount); offset += yNegCount;
    const yPosVecs = vectors.slice(offset);

    const xNegCentroid = meanVector(xNegVecs);
    const xPosCentroid = meanVector(xPosVecs);
    const yNegCentroid = meanVector(yNegVecs);
    const yPosCentroid = meanVector(yPosVecs);

    // Concept-direction vectors v_x and v_y, mean-difference style.
    // Normalised so the amplification slider has a model-independent
    // interpretation: α * unit_vector. This follows Latent Manipulator
    // (CHI EA '26) and the broader contrastive-activation-addition
    // steering literature.
    const xDir = normaliseInPlace(subtract(xPosCentroid, xNegCentroid));
    const yDir = normaliseInPlace(subtract(yPosCentroid, yNegCentroid));

    const points: HegemonyCompassPointResult[] = [];
    let polX = 0;
    let polY = 0;
    let polR = 0;
    for (let ci = 0; ci < concepts.length; ci++) {
      const raw = vectors[ci];
      if (!raw) continue;
      // Apply amplification: e' = e + α_x v_x + α_y v_y. When alphas
      // are zero (the default) this is the identity.
      const conceptVec =
        alphaX === 0 && alphaY === 0
          ? raw
          : amplify(raw, xDir, alphaX, yDir, alphaY);
      const avgSimXNeg = xNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xNegVecs.length;
      const avgSimXPos = xPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xPosVecs.length;
      const avgSimYNeg = yNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yNegVecs.length;
      const avgSimYPos = yPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yPosVecs.length;
      const x = avgSimXPos - avgSimXNeg;
      const y = avgSimYPos - avgSimYNeg;
      points.push({
        concept: concepts[ci],
        x,
        y,
        simXNeg: avgSimXNeg,
        simXPos: avgSimXPos,
        simYNeg: avgSimYNeg,
        simYPos: avgSimYPos,
      });
      polX += Math.abs(x);
      polY += Math.abs(y);
      polR += Math.sqrt(x * x + y * y);
    }

    const nPts = Math.max(1, points.length);

    models.push({
      modelId: m.id,
      modelName: spec?.name || m.name || m.id,
      dimensions: vectors[0]?.length ?? 0,
      points,
      xNeg: {
        label: preset.xAxis.negative.label,
        terms: preset.xAxis.negative.terms,
        coherence: meanPairwiseCosine(xNegVecs),
        centroidNorm: l2Norm(xNegCentroid),
      },
      xPos: {
        label: preset.xAxis.positive.label,
        terms: preset.xAxis.positive.terms,
        coherence: meanPairwiseCosine(xPosVecs),
        centroidNorm: l2Norm(xPosCentroid),
      },
      yNeg: {
        label: preset.yAxis.negative.label,
        terms: preset.yAxis.negative.terms,
        coherence: meanPairwiseCosine(yNegVecs),
        centroidNorm: l2Norm(yNegCentroid),
      },
      yPos: {
        label: preset.yAxis.positive.label,
        terms: preset.yAxis.positive.terms,
        coherence: meanPairwiseCosine(yPosVecs),
        centroidNorm: l2Norm(yPosCentroid),
      },
      xInterPoleCosine: cosineSimilarity(xNegCentroid, xPosCentroid),
      yInterPoleCosine: cosineSimilarity(yNegCentroid, yPosCentroid),
      xAxisNorm: euclideanDist(xNegCentroid, xPosCentroid),
      yAxisNorm: euclideanDist(yNegCentroid, yPosCentroid),
      xPolarisation: polX / nPts,
      yPolarisation: polY / nPts,
      meanRadialDisplacement: polR / nPts,
    });
  }

  return {
    presetName: preset.name,
    concepts,
    xAxisLabels: { negative: preset.xAxis.negative.label, positive: preset.xAxis.positive.label },
    yAxisLabels: { negative: preset.yAxis.negative.label, positive: preset.yAxis.positive.label },
    models,
    amplification: { x: alphaX, y: alphaY },
  };
}

/** v_a - v_b. */
function subtract(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

/** Normalise a vector in place. Returns the same array for convenience. */
function normaliseInPlace(v: number[]): number[] {
  const n = l2Norm(v);
  if (n === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

/** e + α_x v_x + α_y v_y. Returns a new array; does not mutate e. */
function amplify(
  e: number[],
  vx: number[],
  alphaX: number,
  vy: number[],
  alphaY: number
): number[] {
  const out = new Array<number>(e.length);
  for (let i = 0; i < e.length; i++) {
    out[i] = e[i] + alphaX * vx[i] + alphaY * vy[i];
  }
  return out;
}

/** Headline metrics for the Protocol Runner result card. */
export function hegemonyCompassHeadline(
  result: HegemonyCompassResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };
  // Average across models to give a single-number summary that is
  // robust when multiple models are enabled.
  const nModels = result.models.length;
  const avgXInter = result.models.reduce((s, m) => s + m.xInterPoleCosine, 0) / nModels;
  const avgYInter = result.models.reduce((s, m) => s + m.yInterPoleCosine, 0) / nModels;
  // Pick the most-displaced concept on the X axis from the first model
  // as a headline example.
  const top = result.models[0];
  let extreme = top.points[0];
  let extremeMag = 0;
  for (const p of top.points) {
    const mag = Math.abs(p.x) + Math.abs(p.y);
    if (mag > extremeMag) { extreme = p; extremeMag = mag; }
  }
  return {
    preset: result.presetName,
    concepts: result.concepts.length,
    "avg X inter-pole cos": Number(avgXInter.toFixed(4)),
    "avg Y inter-pole cos": Number(avgYInter.toFixed(4)),
    "most-displaced concept": extreme?.concept ?? "—",
  };
}

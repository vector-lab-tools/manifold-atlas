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
}

export interface HegemonyCompassResult {
  presetName: string;
  concepts: string[];
  xAxisLabels: { negative: string; positive: string };
  yAxisLabels: { negative: string; positive: string };
  models: HegemonyCompassModelResult[];
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

    const points: HegemonyCompassPointResult[] = [];
    for (let ci = 0; ci < concepts.length; ci++) {
      const conceptVec = vectors[ci];
      if (!conceptVec) continue;
      const avgSimXNeg = xNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xNegVecs.length;
      const avgSimXPos = xPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xPosVecs.length;
      const avgSimYNeg = yNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yNegVecs.length;
      const avgSimYPos = yPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yPosVecs.length;
      points.push({
        concept: concepts[ci],
        x: avgSimXPos - avgSimXNeg,
        y: avgSimYPos - avgSimYNeg,
        simXNeg: avgSimXNeg,
        simXPos: avgSimXPos,
        simYNeg: avgSimYNeg,
        simYPos: avgSimYPos,
      });
    }

    const xNegCentroid = meanVector(xNegVecs);
    const xPosCentroid = meanVector(xPosVecs);
    const yNegCentroid = meanVector(yNegVecs);
    const yPosCentroid = meanVector(yPosVecs);

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
    });
  }

  return {
    presetName: preset.name,
    concepts,
    xAxisLabels: { negative: preset.xAxis.negative.label, positive: preset.xAxis.positive.label },
    yAxisLabels: { negative: preset.yAxis.negative.label, positive: preset.yAxis.positive.label },
    models,
  };
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

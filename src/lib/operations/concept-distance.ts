/**
 * Concept Distance — pure compute.
 *
 * Extracted from src/components/operations/ConceptDistance.tsx to make
 * the operation callable from the Protocol Runner (and, in future, from
 * a CLI or Manifoldscope). The React component is now a thin UI wrapper
 * that calls this function with vectors fetched via useEmbedAll.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export interface ConceptDistanceInputs {
  termA: string;
  termB: string;
}

export interface ConceptDistanceModelResult {
  modelId: string;
  modelName: string;
  providerId: string;
  cosineSimilarity: number;
  cosineDistance: number;
  angularDistance: number; // degrees
  euclideanDistance: number;
  normA: number;
  normB: number;
  dimensions: number;
  topDimensions: Array<{ dim: number; contribution: number }>;
}

export interface ConceptDistanceResult {
  termA: string;
  termB: string;
  models: ConceptDistanceModelResult[];
}

/** L2 norm of a vector. */
export function vectorNorm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/** Euclidean distance between two equal-length vectors. */
export function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Dimensions with the largest contribution to the dot product between
 * two vectors, sorted by absolute contribution. Used to show where
 * the geometric relationship is concentrated.
 */
export function topContributingDimensions(
  a: number[],
  b: number[],
  topN = 5
): Array<{ dim: number; contribution: number }> {
  const contributions = a.map((ai, i) => ({
    dim: i,
    contribution: ai * b[i],
  }));
  contributions.sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
  return contributions.slice(0, topN);
}

/**
 * Compute concept distance across all models that supplied vectors.
 *
 * modelVectors maps modelId to a 2-vector array: [vecA, vecB], in the
 * same order as the inputs `[termA, termB]`.
 *
 * enabledModels carries the id/name/providerId triples from the
 * settings context; it defines which models appear in the result
 * (and in what order before sorting by similarity).
 */
export function computeConceptDistance(
  inputs: ConceptDistanceInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): ConceptDistanceResult {
  const models: ConceptDistanceModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const vecA = vectors[0];
      const vecB = vectors[1];
      const sim = cosineSimilarity(vecA, vecB);
      const spec = EMBEDDING_MODELS.find(s => s.id === m.id);

      // Clamp for acos (floating point can exceed [-1, 1])
      const clampedSim = Math.max(-1, Math.min(1, sim));
      const angularDistance = (Math.acos(clampedSim) * 180) / Math.PI;

      return {
        modelId: m.id,
        modelName: spec?.name || m.name || m.id,
        providerId: m.providerId,
        cosineSimilarity: sim,
        cosineDistance: 1 - sim,
        angularDistance,
        euclideanDistance: euclideanDist(vecA, vecB),
        normA: vectorNorm(vecA),
        normB: vectorNorm(vecB),
        dimensions: vecA.length,
        topDimensions: topContributingDimensions(vecA, vecB),
      };
    })
    .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

  return { termA: inputs.termA, termB: inputs.termB, models };
}

/**
 * Headline metrics for the Protocol Runner result card.
 * Returns the highest-similarity model's numbers plus a count.
 */
export function conceptDistanceHeadline(
  result: ConceptDistanceResult
): Record<string, number | string> {
  if (result.models.length === 0) {
    return { status: "no models" };
  }
  const top = result.models[0];
  const avg =
    result.models.reduce((s, m) => s + m.cosineSimilarity, 0) / result.models.length;
  return {
    "models compared": result.models.length,
    "top model": top.modelName,
    "top cosine": Number(top.cosineSimilarity.toFixed(4)),
    "avg cosine": Number(avg.toFixed(4)),
    "avg angular (°)":
      Number(
        (
          result.models.reduce((s, m) => s + m.angularDistance, 0) /
          result.models.length
        ).toFixed(1)
      ),
  };
}

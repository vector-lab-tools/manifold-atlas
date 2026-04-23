/**
 * Distance Matrix — pure compute.
 *
 * Builds the full NxN cosine similarity matrix for a concept list
 * across every enabled model. Surfaces headline items (most similar,
 * least similar, average) per model and, when two or more models are
 * enabled, the pairs where models disagree most — the "contested
 * geometry" signal.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export interface DistanceMatrixInputs {
  /** Concepts to compare. Minimum two. */
  concepts: string[];
}

export interface DistanceMatrixModelResult {
  modelId: string;
  modelName: string;
  matrix: number[][];
  mostSimilar: { a: string; b: string; sim: number };
  leastSimilar: { a: string; b: string; sim: number };
  avgSimilarity: number;
}

export interface ContestedGeometryPair {
  a: string;
  b: string;
  /** Variance of the pair's cosine across models. */
  variance: number;
  /** Per-model cosines. */
  sims: Record<string, number>;
  /** Min and max across models, for quick diff reporting. */
  min: number;
  max: number;
  range: number;
}

export interface DistanceMatrixResult {
  concepts: string[];
  models: DistanceMatrixModelResult[];
  /** Populated when >= 2 models were enabled. Top-N sorted by variance desc. */
  contestedPairs: ContestedGeometryPair[];
}

export function distanceMatrixTextList(inputs: DistanceMatrixInputs): string[] {
  return [...inputs.concepts];
}

export function computeDistanceMatrix(
  inputs: DistanceMatrixInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): DistanceMatrixResult {
  const concepts = inputs.concepts;
  if (concepts.length < 2) {
    throw new Error("Distance Matrix requires at least two concepts.");
  }

  const models: DistanceMatrixModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const n = concepts.length;
      const matrix: number[][] = [];

      let mostSim = { a: "", b: "", sim: -Infinity };
      let leastSim = { a: "", b: "", sim: Infinity };
      let totalSim = 0;
      let pairCount = 0;

      for (let i = 0; i < n; i++) {
        matrix[i] = new Array(n);
        for (let j = 0; j < n; j++) {
          matrix[i][j] = i === j ? 1 : cosineSimilarity(vectors[i], vectors[j]);
        }
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const s = matrix[i][j];
          totalSim += s;
          pairCount += 1;
          if (s > mostSim.sim) mostSim = { a: concepts[i], b: concepts[j], sim: s };
          if (s < leastSim.sim) leastSim = { a: concepts[i], b: concepts[j], sim: s };
        }
      }

      const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
      return {
        modelId: m.id,
        modelName: spec?.name || m.name || m.id,
        matrix,
        mostSimilar: mostSim,
        leastSimilar: leastSim,
        avgSimilarity: pairCount > 0 ? totalSim / pairCount : 0,
      };
    });

  // Contested geometry: pairs where models disagree most.
  const contestedPairs: ContestedGeometryPair[] = [];
  if (models.length > 1) {
    const n = concepts.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sims: Record<string, number> = {};
        const values: number[] = [];
        for (const r of models) {
          const s = r.matrix[i][j];
          sims[r.modelName] = s;
          values.push(s);
        }
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        contestedPairs.push({
          a: concepts[i],
          b: concepts[j],
          variance,
          sims,
          min,
          max,
          range: max - min,
        });
      }
    }
    contestedPairs.sort((a, b) => b.variance - a.variance);
  }

  return {
    concepts,
    models,
    contestedPairs: contestedPairs.slice(0, 20),
  };
}

/** Headline metrics for the Protocol Runner result card. */
export function distanceMatrixHeadline(
  result: DistanceMatrixResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };
  const top = result.models[0];
  return {
    concepts: result.concepts.length,
    "pairs": (result.concepts.length * (result.concepts.length - 1)) / 2,
    "most similar": `${top.mostSimilar.a} ↔ ${top.mostSimilar.b} (${top.mostSimilar.sim.toFixed(3)})`,
    "least similar": `${top.leastSimilar.a} ↔ ${top.leastSimilar.b} (${top.leastSimilar.sim.toFixed(3)})`,
    "avg cosine": Number(top.avgSimilarity.toFixed(4)),
    ...(result.contestedPairs.length > 0
      ? { "max contested pair": `${result.contestedPairs[0].a} ↔ ${result.contestedPairs[0].b} (range ${result.contestedPairs[0].range.toFixed(3)})` }
      : {}),
  };
}

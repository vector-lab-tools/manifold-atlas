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
import type { ModelCalibration } from "@/lib/calibration/compute";
import { floorFor } from "@/lib/calibration/compute";
import { normalisedPosition } from "@/lib/calibration/baseline";
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
  /**
   * Variance across models of the quantity actually compared. When every
   * model is calibrated this is the variance of the floor-to-identity
   * positions; otherwise it is the variance of the raw cosines. See
   * `calibrated` before reading it.
   */
  variance: number;
  /** Per-model cosines, always raw. */
  sims: Record<string, number>;
  /** Per-model floor-to-identity positions. Empty when uncalibrated. */
  positions: Record<string, number>;
  /** Min and max of the compared quantity across models. */
  min: number;
  max: number;
  range: number;
  /** Range of the raw cosines, kept for reference. */
  rawRange: number;
  /**
   * True when every contributing model had a calibration, so the
   * ranking reflects disagreement about the concepts rather than
   * differences between the models' floors.
   */
  calibrated: boolean;
}

export interface DistanceMatrixResult {
  concepts: string[];
  models: DistanceMatrixModelResult[];
  /** Populated when >= 2 models were enabled. Top-N sorted by variance desc. */
  contestedPairs: ContestedGeometryPair[];
  /**
   * False when at least one model lacked a calibration, so the contested
   * ranking is computed on raw cosines and partly reflects differences
   * between the models' floors rather than between their geometries.
   */
  contestedCalibrated: boolean;
}

export function distanceMatrixTextList(inputs: DistanceMatrixInputs): string[] {
  return [...inputs.concepts];
}

export function computeDistanceMatrix(
  inputs: DistanceMatrixInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>,
  calibrations?: Map<string, ModelCalibration>
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
  //
  // This ranking is where an uncalibrated cosine does the most damage.
  // Two models whose floors differ by 0.10 will show a 0.10 spread on
  // every pair in the list, and the ranking then reports the difference
  // between the instruments as though it were a disagreement about the
  // concepts. Where every model is calibrated the comparison is made on
  // floor-to-identity positions instead, which removes that component.
  // Distance Matrix embeds bare terms, so the term floor is the one used.
  const floors = new Map<string, number>();
  for (const r of models) {
    const cal = calibrations?.get(r.modelId);
    if (cal) floors.set(r.modelId, floorFor(cal, "term").mean);
  }
  const contestedCalibrated = models.length > 0 && floors.size === models.length;

  const contestedPairs: ContestedGeometryPair[] = [];
  if (models.length > 1) {
    const n = concepts.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sims: Record<string, number> = {};
        const positions: Record<string, number> = {};
        const raw: number[] = [];
        const compared: number[] = [];

        for (const r of models) {
          const s = r.matrix[i][j];
          sims[r.modelName] = s;
          raw.push(s);
          const f = floors.get(r.modelId);
          if (f !== undefined) {
            const pos = normalisedPosition(s, f);
            positions[r.modelName] = pos;
          }
          compared.push(
            contestedCalibrated ? normalisedPosition(s, floors.get(r.modelId)!) : s
          );
        }

        const mean = compared.reduce((a, b) => a + b, 0) / compared.length;
        const variance =
          compared.reduce((a, b) => a + (b - mean) ** 2, 0) / compared.length;

        contestedPairs.push({
          a: concepts[i],
          b: concepts[j],
          variance,
          sims,
          positions,
          min: Math.min(...compared),
          max: Math.max(...compared),
          range: Math.max(...compared) - Math.min(...compared),
          rawRange: Math.max(...raw) - Math.min(...raw),
          calibrated: contestedCalibrated,
        });
      }
    }
    contestedPairs.sort((a, b) => b.variance - a.variance);
  }

  return {
    concepts,
    models,
    contestedPairs: contestedPairs.slice(0, 20),
    contestedCalibrated,
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
    "contested basis": result.contestedCalibrated
      ? "floor-to-identity position"
      : "raw cosine — uncalibrated, partly reflects differing floors",
    ...(result.contestedPairs.length > 0
      ? { "max contested pair": `${result.contestedPairs[0].a} ↔ ${result.contestedPairs[0].b} (range ${result.contestedPairs[0].range.toFixed(3)})` }
      : {}),
  };
}

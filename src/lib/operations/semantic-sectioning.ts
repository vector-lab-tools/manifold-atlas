/**
 * Semantic Sectioning — pure compute.
 *
 * Interpolates linearly between two anchor concepts in embedding space
 * in N steps, finding the nearest real concept from a reference set at
 * each step. Extracted from SemanticSectioning.tsx.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export const DEFAULT_REFERENCE_CONCEPTS: string[] = [
  "cooperation", "agreement", "conformity", "obedience", "submission",
  "resistance", "loyalty", "duty", "consent", "coercion",
  "unity", "harmony", "discipline", "deference", "acquiescence",
  "alliance", "fellowship", "community", "order", "control",
  "authority", "obligation", "commitment", "allegiance", "devotion",
  "servitude", "subordination", "dependence", "trust", "hierarchy",
];

export const DEFAULT_INTERPOLATION_STEPS = 20;

export interface SemanticSectioningInputs {
  anchorA: string;
  anchorB: string;
  /** Vocabulary of candidate concepts along the path. */
  vocabulary?: string[];
  /** Number of interpolation steps. Defaults to 20. */
  steps?: number;
}

export interface InterpolationPoint {
  position: number;   // 0..1
  nearestConcept: string;
  nearestSimilarity: number;
}

export interface SemanticSectioningModelResult {
  anchorA: string;
  anchorB: string;
  anchorSimilarity: number;
  modelId: string;
  modelName: string;
  path: InterpolationPoint[];
}

export interface SemanticSectioningResult {
  anchorA: string;
  anchorB: string;
  vocabulary: string[];
  steps: number;
  models: SemanticSectioningModelResult[];
}

/** Texts that need embedding: [anchorA, anchorB, ...vocabulary]. */
export function semanticSectioningTextList(
  inputs: SemanticSectioningInputs
): string[] {
  const vocab = inputs.vocabulary ?? DEFAULT_REFERENCE_CONCEPTS;
  return [inputs.anchorA, inputs.anchorB, ...vocab];
}

export function computeSemanticSectioning(
  inputs: SemanticSectioningInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): SemanticSectioningResult {
  const vocabulary = inputs.vocabulary ?? DEFAULT_REFERENCE_CONCEPTS;
  const steps = inputs.steps ?? DEFAULT_INTERPOLATION_STEPS;

  const models: SemanticSectioningModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const vecA = vectors[0];
      const vecB = vectors[1];
      const refVectors = vectors.slice(2);

      const anchorSimilarity = cosineSimilarity(vecA, vecB);
      const path: InterpolationPoint[] = [];

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const interpolated = vecA.map((a, d) => a * (1 - t) + vecB[d] * t);

        let bestIdx = 0;
        let bestSim = -Infinity;
        for (let r = 0; r < refVectors.length; r++) {
          const sim = cosineSimilarity(interpolated, refVectors[r]);
          if (sim > bestSim) {
            bestSim = sim;
            bestIdx = r;
          }
        }

        path.push({
          position: t,
          nearestConcept: vocabulary[bestIdx],
          nearestSimilarity: bestSim,
        });
      }

      const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
      return {
        anchorA: inputs.anchorA,
        anchorB: inputs.anchorB,
        anchorSimilarity,
        modelId: m.id,
        modelName: spec?.name || m.name || m.id,
        path,
      };
    });

  return {
    anchorA: inputs.anchorA,
    anchorB: inputs.anchorB,
    vocabulary,
    steps,
    models,
  };
}

/**
 * Compact path signature: the sequence of unique nearest concepts
 * encountered along the interpolation (deduplicated consecutively).
 * Good for comparing paths across models.
 */
export function semanticSectioningSignature(
  modelResult: SemanticSectioningModelResult
): string[] {
  const sig: string[] = [];
  for (const point of modelResult.path) {
    if (sig[sig.length - 1] !== point.nearestConcept) {
      sig.push(point.nearestConcept);
    }
  }
  return sig;
}

/** Headline metrics for the Protocol Runner result card. */
export function semanticSectioningHeadline(
  result: SemanticSectioningResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };
  const top = result.models[0];
  const signature = semanticSectioningSignature(top);
  return {
    from: result.anchorA,
    to: result.anchorB,
    "anchor cosine": Number(top.anchorSimilarity.toFixed(4)),
    "path unique concepts": signature.length,
    "path": signature.slice(0, 6).join(" → ") + (signature.length > 6 ? " → …" : ""),
  };
}

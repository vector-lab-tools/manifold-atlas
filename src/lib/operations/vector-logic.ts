/**
 * Vector Logic — pure compute.
 *
 * The A − B + C operation on embedding vectors, tested against a
 * reference vocabulary. Extracted from VectorLogic.tsx to make it
 * callable from the Protocol Runner.
 *
 * The reference vocabulary is the pool of candidate concepts the
 * computed vector is compared against via cosine similarity. When
 * used from a protocol, callers should either pass REFERENCE_VOCAB
 * explicitly (to match the component default) or supply their own.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export const REFERENCE_VOCAB: string[] = [
  "woman", "queen", "king", "man", "person", "child", "worker", "citizen", "subject",
  "freedom", "liberty", "liberation", "emancipation", "autonomy", "self-determination",
  "justice", "fairness", "equity", "rights", "law", "punishment", "mercy", "obligation",
  "democracy", "authoritarianism", "fascism", "socialism", "communism", "liberalism",
  "capitalism", "market", "profit", "exploitation", "labour", "work", "craft", "care",
  "solidarity", "compliance", "resistance", "obedience", "cooperation", "competition",
  "truth", "knowledge", "wisdom", "understanding", "belief", "opinion", "ideology",
  "art", "beauty", "aesthetics", "culture", "creativity", "expression", "imagination",
  "science", "objectivity", "subjectivity", "experience", "experiment", "measurement",
  "technology", "efficiency", "automation", "computation", "algorithm", "intelligence",
  "nature", "ecology", "environment", "sustainability", "growth", "decay", "entropy",
  "power", "authority", "sovereignty", "governance", "rule", "domination", "hegemony",
  "community", "society", "individual", "collective", "public", "private", "commons",
  "love", "friendship", "trust", "loyalty", "betrayal", "violence", "peace", "war",
  "reason", "intuition", "emotion", "passion", "desire", "will", "consciousness",
  "alienation", "reification", "commodity", "value", "exchange", "use", "production",
  "participation", "representation", "deliberation", "consensus", "dissent", "protest",
];

export interface VectorLogicInputs {
  termA: string;
  termB: string;
  termC: string;
  /** Optional override; defaults to REFERENCE_VOCAB. */
  vocabulary?: string[];
}

export interface VectorLogicModelResult {
  a: string;
  b: string;
  c: string;
  modelId: string;
  modelName: string;
  nearest: Array<{ concept: string; similarity: number }>;
}

export interface VectorLogicResult {
  a: string;
  b: string;
  c: string;
  vocabulary: string[];
  models: VectorLogicModelResult[];
}

/**
 * Build the flat list of texts needed for a Vector Logic operation:
 * [A, B, C, ...vocabulary]. This is also the order the pre-fetched
 * modelVectors are expected to be in.
 */
export function vectorLogicTextList(inputs: VectorLogicInputs): string[] {
  const vocab = inputs.vocabulary ?? REFERENCE_VOCAB;
  return [inputs.termA, inputs.termB, inputs.termC, ...vocab];
}

/**
 * Compute A − B + C and return the nearest concepts in vocabulary for
 * each enabled model.
 */
export function computeVectorLogic(
  inputs: VectorLogicInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): VectorLogicResult {
  const { termA, termB, termC } = inputs;
  const vocabulary = inputs.vocabulary ?? REFERENCE_VOCAB;

  const models: VectorLogicModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const vecA = vectors[0];
      const vecB = vectors[1];
      const vecC = vectors[2];
      const refVectors = vectors.slice(3);

      const resultVec = vecA.map((_, d) => vecA[d] - vecB[d] + vecC[d]);

      const nearest = vocabulary
        .map((concept, i) => ({
          concept,
          similarity: cosineSimilarity(resultVec, refVectors[i]),
        }))
        .filter(s => s.concept !== termA && s.concept !== termB && s.concept !== termC)
        .sort((x, y) => y.similarity - x.similarity)
        .slice(0, 8);

      const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
      return {
        a: termA,
        b: termB,
        c: termC,
        modelId: m.id,
        modelName: spec?.name || m.name || m.id,
        nearest,
      };
    });

  return { a: termA, b: termB, c: termC, vocabulary, models };
}

/** Headline metrics for the Protocol Runner result card. */
export function vectorLogicHeadline(
  result: VectorLogicResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };
  const top = result.models[0];
  const topConcept = top.nearest[0]?.concept ?? "?";
  const topSim = top.nearest[0]?.similarity ?? 0;
  return {
    "A − B + C": `${result.a} − ${result.b} + ${result.c}`,
    "nearest match": topConcept,
    "top cosine": Number(topSim.toFixed(4)),
    "models": result.models.length,
  };
}

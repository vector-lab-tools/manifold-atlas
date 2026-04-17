/**
 * Agonism Test — pure compute.
 *
 * Measures whether the manifold preserves genuine philosophical
 * opposition between paired claims, or collapses it into proximity.
 * Low cosine similarity = opposition preserved; high = geometric
 * collapse of antagonism.
 *
 * Pre-built pairs are exported as AGONISM_PAIRS so protocols can
 * reference them by preset name.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export interface AgonismPair {
  label: string;
  positionA: { thinker: string; quote: string };
  positionB: { thinker: string; quote: string };
}

export const AGONISM_PAIRS: AgonismPair[] = [
  {
    label: "Class struggle vs social order",
    positionA: { thinker: "Marx", quote: "The history of all hitherto existing society is the history of class struggles" },
    positionB: { thinker: "Burke", quote: "Society is a contract between the living, the dead, and those yet to be born, requiring preservation of established order" },
  },
  {
    label: "The system vs the individual",
    positionA: { thinker: "Hegel", quote: "The rational is actual and the actual is rational, truth is found in the whole system" },
    positionB: { thinker: "Kierkegaard", quote: "The crowd is untruth, truth can only be found by the individual standing alone before existence" },
  },
  {
    label: "Property as theft vs property as foundation",
    positionA: { thinker: "Proudhon", quote: "Property is theft, the exploitation of the weak by the strong" },
    positionB: { thinker: "Locke", quote: "Every man has a property in his own person, and the labour of his body and the work of his hands are properly his" },
  },
  {
    label: "The political as agonism vs the political as friend-enemy",
    positionA: { thinker: "Arendt", quote: "The meaning of politics is freedom, the capacity to begin something new through action in the public sphere" },
    positionB: { thinker: "Schmitt", quote: "The specific political distinction to which political actions and motives can be reduced is that between friend and enemy" },
  },
  {
    label: "Reason as emancipation vs reason as domination",
    positionA: { thinker: "Habermas", quote: "The unforced force of the better argument is the foundation of democratic discourse and rational consensus" },
    positionB: { thinker: "Adorno & Horkheimer", quote: "Enlightenment, understood in the widest sense as the advance of thought, has always aimed at liberating human beings from fear and installing them as masters, but the wholly enlightened earth is radiant with triumphant calamity" },
  },
  {
    label: "Existence precedes essence vs essence precedes existence",
    positionA: { thinker: "Sartre", quote: "Existence precedes essence, man first of all exists, encounters himself, surges up in the world, and defines himself afterwards" },
    positionB: { thinker: "Plato", quote: "The soul existed before the body, and the Forms are eternal, unchanging realities that precede and ground all particular existence" },
  },
  {
    label: "Knowledge as power vs knowledge as truth",
    positionA: { thinker: "Foucault", quote: "Knowledge is not made for understanding, it is made for cutting, power and knowledge directly imply one another" },
    positionB: { thinker: "Aristotle", quote: "All men by nature desire to know, and the pursuit of knowledge for its own sake is the highest human activity" },
  },
  {
    label: "The state as instrument of class rule vs the state as social contract",
    positionA: { thinker: "Lenin", quote: "The state is an organ of class rule, an organ for the oppression of one class by another" },
    positionB: { thinker: "Rousseau", quote: "The social contract establishes a form of association which defends and protects with the whole common force the person and goods of each associate" },
  },
];

/**
 * Below this cosine similarity, opposition is considered preserved.
 * Above, the manifold has collapsed the antagonism into proximity.
 */
export const DEFAULT_AGONISM_THRESHOLD = 0.7;

export interface AgonismTestInputs {
  /** Override the built-in pair set. */
  pairs?: AgonismPair[];
  /**
   * Preset name. Currently "all" (equivalent to the full AGONISM_PAIRS
   * set) or a comma-separated list of labels to filter. Omit to use
   * the full preset.
   */
  preset?: string;
  threshold?: number;
}

export interface AgonismModelResult {
  modelId: string;
  modelName: string;
  similarity: number;
  agonismPreserved: boolean;
}

export interface AgonismPairResult {
  pair: AgonismPair;
  models: AgonismModelResult[];
}

export interface AgonismTestResult {
  threshold: number;
  pairs: AgonismPairResult[];
  summary: {
    totalPairs: number;
    totalTests: number;
    preservedCount: number;
    preservedRate: number; // 0..1
    avgSimilarity: number;
  };
}

/**
 * Resolve the pairs for a protocol step. Returns the full AGONISM_PAIRS
 * set unless a comma-separated list of labels is supplied in `preset`,
 * in which case only matching labels are included.
 */
export function resolveAgonismPairs(
  inputs: AgonismTestInputs
): AgonismPair[] {
  if (inputs.pairs && inputs.pairs.length > 0) return inputs.pairs;
  if (!inputs.preset || inputs.preset === "all") return AGONISM_PAIRS;
  const requested = inputs.preset
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
  const matching = AGONISM_PAIRS.filter(p =>
    requested.some(r => p.label.toLowerCase().includes(r))
  );
  return matching.length > 0 ? matching : AGONISM_PAIRS;
}

/**
 * Flat text list: [A0.quote, B0.quote, A1.quote, B1.quote, ...].
 */
export function agonismTestTextList(inputs: AgonismTestInputs): string[] {
  const pairs = resolveAgonismPairs(inputs);
  const texts: string[] = [];
  for (const pair of pairs) {
    texts.push(pair.positionA.quote, pair.positionB.quote);
  }
  return texts;
}

export function computeAgonismTest(
  inputs: AgonismTestInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): AgonismTestResult {
  const pairs = resolveAgonismPairs(inputs);
  const threshold = inputs.threshold ?? DEFAULT_AGONISM_THRESHOLD;

  const pairResults: AgonismPairResult[] = pairs.map((pair, i) => {
    const models: AgonismModelResult[] = enabledModels
      .filter(m => modelVectors.has(m.id))
      .map(m => {
        const vectors = modelVectors.get(m.id)!;
        const sim = cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]);
        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          similarity: sim,
          agonismPreserved: sim < threshold,
        };
      });

    return { pair, models };
  });

  let totalTests = 0;
  let preservedCount = 0;
  let simSum = 0;
  let perPairAvgSum = 0;
  for (const row of pairResults) {
    if (row.models.length === 0) continue;
    totalTests += row.models.length;
    for (const m of row.models) {
      if (m.agonismPreserved) preservedCount += 1;
      simSum += m.similarity;
    }
    perPairAvgSum += row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
  }
  const preservedRate = totalTests > 0 ? preservedCount / totalTests : 0;
  const avgSimilarity = pairResults.length > 0 ? perPairAvgSum / pairResults.length : 0;

  return {
    threshold,
    pairs: pairResults,
    summary: {
      totalPairs: pairResults.length,
      totalTests,
      preservedCount,
      preservedRate,
      avgSimilarity,
    },
  };
}

export function agonismTestHeadline(
  result: AgonismTestResult
): Record<string, number | string> {
  return {
    pairs: result.summary.totalPairs,
    "opposition preserved": `${(result.summary.preservedRate * 100).toFixed(1)}%`,
    "avg cosine": Number(result.summary.avgSimilarity.toFixed(4)),
    "threshold": result.threshold,
    "most collapsed": mostCollapsedLabel(result),
  };
}

function mostCollapsedLabel(result: AgonismTestResult): string {
  if (result.pairs.length === 0) return "-";
  let worst = result.pairs[0];
  let worstAvg = -Infinity;
  for (const row of result.pairs) {
    if (row.models.length === 0) continue;
    const avg = row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
    if (avg > worstAvg) {
      worstAvg = avg;
      worst = row;
    }
  }
  return worst.pair.label;
}

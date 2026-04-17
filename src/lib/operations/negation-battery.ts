/**
 * Negation Battery — pure compute.
 *
 * Runs a set of negation tests in one pass. For each statement, the
 * module auto-generates the negation (or uses a caller-supplied one),
 * embeds both, and measures cosine similarity across all enabled models.
 *
 * Pre-built batteries are exported as NEGATION_BATTERIES so that both
 * the component UI and protocol definitions can reference them by name.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { generateNegation } from "@/lib/negation";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import { DEFAULT_NEGATION_THRESHOLD } from "@/lib/operations/negation-gauge";

export const NEGATION_BATTERIES: Record<string, string[]> = {
  "Political claims": [
    "Democracy is the best form of government",
    "Free speech should have limits",
    "Immigration strengthens the economy",
    "War can be justified",
    "Taxation is fair",
    "The state should provide healthcare",
    "Protest is effective",
    "Borders are necessary",
    "Nationalism is dangerous",
    "Revolution is sometimes necessary",
  ],
  "Ethical statements": [
    "Lying is wrong",
    "Killing is never justified",
    "Privacy is a right",
    "Equality matters more than freedom",
    "Animals have rights",
    "The ends justify the means",
    "Forgiveness is a virtue",
    "Punishment deters crime",
    "Charity is a moral obligation",
    "Suffering has meaning",
  ],
  "Factual assertions": [
    "The earth is round",
    "Vaccines are safe",
    "Climate change is caused by humans",
    "Evolution is a fact",
    "The universe is expanding",
    "Consciousness is produced by the brain",
    "Free will exists",
    "Mathematics is discovered not invented",
    "Time is real",
    "Language shapes thought",
  ],
  "Epistemological claims": [
    "Knowledge requires justification",
    "Objective truth exists",
    "Science is the best way to know the world",
    "Intuition is a valid source of knowledge",
    "History is written by the victors",
    "All knowledge is situated",
    "Reason is universal",
    "Experience is more important than theory",
    "Certainty is possible",
    "Perception is reliable",
  ],
};

export interface NegationBatteryInputs {
  /** Resolved list of statements to test. */
  statements: string[];
  /**
   * Optional pre-generated negations (one per statement). If omitted,
   * the rule-based generator is used for each.
   */
  negations?: string[];
  threshold?: number;
}

export interface NegationBatteryModelResult {
  modelId: string;
  modelName: string;
  similarity: number;
  collapsed: boolean;
}

export interface NegationBatteryStatementResult {
  statement: string;
  negated: string;
  models: NegationBatteryModelResult[];
}

export interface NegationBatteryResult {
  threshold: number;
  statements: NegationBatteryStatementResult[];
  summary: {
    totalStatements: number;
    totalTests: number;
    totalCollapsed: number;
    collapseRate: number;      // 0..1
    avgSimilarity: number;
  };
}

/**
 * Look up a battery preset by its canonical name (keys of
 * NEGATION_BATTERIES). Returns null for unknown names.
 */
export function resolveNegationBatteryPreset(
  name: string | undefined
): string[] | null {
  if (!name) return null;
  return NEGATION_BATTERIES[name] ?? null;
}

/**
 * Flat text list for batched embedding:
 * [s0, neg(s0), s1, neg(s1), ...].
 */
export function negationBatteryTextList(inputs: NegationBatteryInputs): string[] {
  const negations = inputs.negations ?? inputs.statements.map(generateNegation);
  const texts: string[] = [];
  for (let i = 0; i < inputs.statements.length; i++) {
    texts.push(inputs.statements[i], negations[i]);
  }
  return texts;
}

export function computeNegationBattery(
  inputs: NegationBatteryInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): NegationBatteryResult {
  const negations = inputs.negations ?? inputs.statements.map(generateNegation);
  const threshold = inputs.threshold ?? DEFAULT_NEGATION_THRESHOLD;

  const statements: NegationBatteryStatementResult[] = inputs.statements.map((statement, i) => {
    const negated = negations[i];

    const models: NegationBatteryModelResult[] = enabledModels
      .filter(m => modelVectors.has(m.id))
      .map(m => {
        const vectors = modelVectors.get(m.id)!;
        const sim = cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]);
        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          similarity: sim,
          collapsed: sim >= threshold,
        };
      });

    return { statement, negated, models };
  });

  // Summary stats
  let totalTests = 0;
  let totalCollapsed = 0;
  let simSum = 0;
  let perStatementAvgSum = 0;
  for (const row of statements) {
    if (row.models.length === 0) continue;
    totalTests += row.models.length;
    for (const m of row.models) {
      if (m.collapsed) totalCollapsed += 1;
      simSum += m.similarity;
    }
    perStatementAvgSum +=
      row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
  }
  const collapseRate = totalTests > 0 ? totalCollapsed / totalTests : 0;
  const avgSimilarity =
    statements.length > 0 ? perStatementAvgSum / statements.length : 0;

  return {
    threshold,
    statements,
    summary: {
      totalStatements: statements.length,
      totalTests,
      totalCollapsed,
      collapseRate,
      avgSimilarity,
    },
  };
}

export function negationBatteryHeadline(
  result: NegationBatteryResult
): Record<string, number | string> {
  return {
    statements: result.summary.totalStatements,
    "collapse rate": `${(result.summary.collapseRate * 100).toFixed(1)}%`,
    "avg cosine": Number(result.summary.avgSimilarity.toFixed(4)),
    "collapsed / total": `${result.summary.totalCollapsed} / ${result.summary.totalTests}`,
    "threshold": result.threshold,
  };
}

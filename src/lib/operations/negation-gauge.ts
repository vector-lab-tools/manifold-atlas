/**
 * Negation Gauge — pure compute.
 *
 * Measures cosine similarity between a statement and its auto-generated
 * negation, across all enabled models. Extracted from NegationGauge.tsx
 * to make the operation callable from the Protocol Runner.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { generateNegation } from "@/lib/negation";
import { EMBEDDING_MODELS } from "@/types/embeddings";

export const DEFAULT_NEGATION_THRESHOLD = 0.85;

export interface NegationGaugeInputs {
  /** Full statement to test, e.g. "This policy is fair". */
  statement: string;
  /**
   * Similarity threshold above which the gauge reports "collapsed".
   * Matches the settings context default (0.85) by convention.
   */
  threshold?: number;
  /**
   * Optional override for the negated form. If omitted, the built-in
   * rule-based negation generator is used.
   */
  negated?: string;
}

export interface NegationGaugeModelResult {
  modelId: string;
  modelName: string;
  providerId: string;
  cosineSimilarity: number;
  cosineDistance: number;
  angularDistance: number;
  collapsed: boolean;
  dimensions: number;
}

export interface NegationGaugeResult {
  original: string;
  negated: string;
  threshold: number;
  models: NegationGaugeModelResult[];
}

/** Texts that need embedding for a negation gauge step. */
export function negationGaugeTextList(inputs: NegationGaugeInputs): string[] {
  const negated = inputs.negated ?? generateNegation(inputs.statement);
  return [inputs.statement, negated];
}

export function computeNegationGauge(
  inputs: NegationGaugeInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): NegationGaugeResult {
  const original = inputs.statement;
  const negated = inputs.negated ?? generateNegation(original);
  const threshold = inputs.threshold ?? DEFAULT_NEGATION_THRESHOLD;

  const models: NegationGaugeModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const sim = cosineSimilarity(vectors[0], vectors[1]);
      const clampedSim = Math.max(-1, Math.min(1, sim));
      const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
      return {
        modelId: m.id,
        modelName: spec?.name || m.name || m.id,
        providerId: m.providerId,
        cosineSimilarity: sim,
        cosineDistance: 1 - sim,
        angularDistance: (Math.acos(clampedSim) * 180) / Math.PI,
        collapsed: sim >= threshold,
        dimensions: vectors[0].length,
      };
    })
    .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

  return { original, negated, threshold, models };
}

/** Headline metrics for the Protocol Runner result card. */
export function negationGaugeHeadline(
  result: NegationGaugeResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };
  const collapsedCount = result.models.filter(m => m.collapsed).length;
  const avg =
    result.models.reduce((s, m) => s + m.cosineSimilarity, 0) / result.models.length;
  return {
    statement: truncate(result.original, 60),
    negation: truncate(result.negated, 60),
    "avg cosine": Number(avg.toFixed(4)),
    "threshold": result.threshold,
    "collapsed models": `${collapsedCount} / ${result.models.length}`,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

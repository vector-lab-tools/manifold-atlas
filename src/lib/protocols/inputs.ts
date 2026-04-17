/**
 * Manifold Atlas — Protocol input collector.
 *
 * Walks a protocol's steps and returns every text that needs embedding.
 * Used by the Runner to batch-fetch embeddings once, before iterating
 * steps. Deduplication is automatic via Set semantics.
 */

import type { Protocol, ProtocolStep } from "@/types/protocols";
import { vectorLogicTextList } from "@/lib/operations/vector-logic";
import { negationGaugeTextList } from "@/lib/operations/negation-gauge";
import { semanticSectioningTextList } from "@/lib/operations/semantic-sectioning";

/**
 * Given a single step, return every text that will need embedding
 * for the operation's compute function. Dispatches by operation id.
 *
 * Unknown or not-yet-refactored operations return [] and will report
 * as "skipped" at execution time.
 */
function textsForStep(step: ProtocolStep): string[] {
  switch (step.operation) {
    case "distance": {
      const a = step.inputs.termA;
      const b = step.inputs.termB;
      return [typeof a === "string" ? a : "", typeof b === "string" ? b : ""].filter(
        (s): s is string => s.length > 0
      );
    }
    case "analogy": {
      const termA = typeof step.inputs.termA === "string" ? step.inputs.termA : "";
      const termB = typeof step.inputs.termB === "string" ? step.inputs.termB : "";
      const termC = typeof step.inputs.termC === "string" ? step.inputs.termC : "";
      if (!termA || !termB || !termC) return [];
      return vectorLogicTextList({ termA, termB, termC });
    }
    case "negation": {
      const statement = typeof step.inputs.statement === "string" ? step.inputs.statement : "";
      const negated = typeof step.inputs.negated === "string" ? step.inputs.negated : undefined;
      const threshold =
        typeof step.inputs.threshold === "number" ? step.inputs.threshold : undefined;
      if (!statement) return [];
      return negationGaugeTextList({ statement, negated, threshold });
    }
    case "sectioning": {
      const anchorA = typeof step.inputs.anchorA === "string" ? step.inputs.anchorA : "";
      const anchorB = typeof step.inputs.anchorB === "string" ? step.inputs.anchorB : "";
      if (!anchorA || !anchorB) return [];
      return semanticSectioningTextList({ anchorA, anchorB });
    }
    default:
      return [];
  }
}

/**
 * Return every text that a protocol will need embedded, deduplicated
 * and in a stable order.
 */
export function collectProtocolTexts(protocol: Protocol): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const step of protocol.steps) {
    for (const text of textsForStep(step)) {
      if (!seen.has(text)) {
        seen.add(text);
        ordered.push(text);
      }
    }
  }
  return ordered;
}

/**
 * Given a step and the full map of modelId → vectors (indexed by the
 * flat, deduplicated text array), return a slice of vectors in the
 * order the step's compute function expects them.
 *
 * Returns null if any required text is missing from the index.
 */
export function vectorsForStep(
  step: ProtocolStep,
  textIndex: Map<string, number>,
  modelVectors: Map<string, number[][]>
): Map<string, number[][]> | null {
  const texts = textsForStep(step);
  const indices: number[] = [];
  for (const text of texts) {
    const idx = textIndex.get(text);
    if (idx === undefined) return null;
    indices.push(idx);
  }
  const out = new Map<string, number[][]>();
  for (const [modelId, allVectors] of modelVectors) {
    out.set(
      modelId,
      indices.map(i => allVectors[i])
    );
  }
  return out;
}

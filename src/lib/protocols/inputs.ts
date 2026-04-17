/**
 * Manifold Atlas — Protocol input collector.
 *
 * Walks a protocol's steps and returns every text that needs embedding.
 * Used by the Runner to batch-fetch embeddings once, before iterating
 * steps. Deduplication is automatic via Set semantics.
 */

import type { Protocol, ProtocolStep } from "@/types/protocols";

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

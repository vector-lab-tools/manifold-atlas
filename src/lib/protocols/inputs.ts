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
import {
  negationBatteryTextList,
  resolveNegationBatteryPreset,
} from "@/lib/operations/negation-battery";
import {
  agonismTestTextList,
  type AgonismPair,
} from "@/lib/operations/agonism-test";
import {
  hegemonyCompassTextList,
  resolveCompassPreset,
  type HegemonyCompassInputs,
} from "@/lib/operations/hegemony-compass";
import { distanceMatrixTextList } from "@/lib/operations/distance-matrix";

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
    case "battery": {
      const statements = resolveBatteryStatements(step.inputs);
      if (statements.length === 0) return [];
      return negationBatteryTextList({ statements });
    }
    case "agonism": {
      const pairs = resolveAgonismPairsFromStep(step.inputs);
      const preset = typeof step.inputs.preset === "string" ? step.inputs.preset : undefined;
      return agonismTestTextList({ pairs, preset });
    }
    case "compass": {
      const inputs = resolveCompassInputsFromStep(step.inputs);
      return hegemonyCompassTextList(inputs);
    }
    case "matrix": {
      const concepts = resolveConceptsFromStep(step.inputs);
      if (concepts.length < 2) return [];
      return distanceMatrixTextList({ concepts });
    }
    default:
      return [];
  }
}

/**
 * Resolve battery statements from a step's inputs. Accepts either a
 * `preset` name (matching NEGATION_BATTERIES keys) or an inline
 * `statements` list.
 */
function resolveBatteryStatements(inputs: Record<string, unknown>): string[] {
  if (Array.isArray(inputs.statements)) {
    return (inputs.statements as unknown[]).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    );
  }
  const preset = typeof inputs.preset === "string" ? inputs.preset : undefined;
  const resolved = resolveNegationBatteryPreset(preset);
  return resolved ?? [];
}

/**
 * Resolve Hegemony Compass inputs from a step's inputs. Accepts a
 * preset name and/or inline xAxis/yAxis definitions; the pure function
 * then resolves the concrete axes. Concepts can be passed as either
 * a comma-separated string or an array; falls back to preset defaults.
 */
function resolveCompassInputsFromStep(
  inputs: Record<string, unknown>
): HegemonyCompassInputs {
  const preset = typeof inputs.preset === "string" ? inputs.preset : undefined;
  const concepts = resolveConceptsFromStep(inputs);
  const out: HegemonyCompassInputs = { preset, concepts: concepts.length > 0 ? concepts : undefined };
  if (typeof inputs.xAxis === "object" && inputs.xAxis !== null) {
    out.xAxis = inputs.xAxis as HegemonyCompassInputs["xAxis"];
  }
  if (typeof inputs.yAxis === "object" && inputs.yAxis !== null) {
    out.yAxis = inputs.yAxis as HegemonyCompassInputs["yAxis"];
  }
  return out;
}

/**
 * Pull a concept list from a step's inputs. Accepts either an array
 * under `concepts` or a comma-separated string, and filters empties.
 */
function resolveConceptsFromStep(inputs: Record<string, unknown>): string[] {
  if (Array.isArray(inputs.concepts)) {
    return (inputs.concepts as unknown[]).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    );
  }
  if (typeof inputs.concepts === "string") {
    return (inputs.concepts as string)
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return [];
}

/**
 * Resolve Agonism Test pairs from a step's inputs. Accepts an inline
 * `pairs` array; otherwise the caller can pass a `preset` to the
 * pure function which handles the default set.
 */
function resolveAgonismPairsFromStep(
  inputs: Record<string, unknown>
): AgonismPair[] | undefined {
  if (!Array.isArray(inputs.pairs)) return undefined;
  const out: AgonismPair[] = [];
  for (const raw of inputs.pairs as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const p = raw as Record<string, unknown>;
    const label = typeof p.label === "string" ? p.label : "Custom pair";
    const a = p.positionA as Record<string, unknown> | undefined;
    const b = p.positionB as Record<string, unknown> | undefined;
    if (!a || !b) continue;
    const quoteA = typeof a.quote === "string" ? a.quote : "";
    const quoteB = typeof b.quote === "string" ? b.quote : "";
    if (!quoteA || !quoteB) continue;
    out.push({
      label,
      positionA: { thinker: typeof a.thinker === "string" ? a.thinker : "", quote: quoteA },
      positionB: { thinker: typeof b.thinker === "string" ? b.thinker : "", quote: quoteB },
    });
  }
  return out.length > 0 ? out : undefined;
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

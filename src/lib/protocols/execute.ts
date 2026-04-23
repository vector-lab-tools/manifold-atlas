/**
 * Manifold Atlas — Protocol step executor.
 *
 * Dispatches a ProtocolStep to the correct pure compute function,
 * wraps the result in a ProtocolStepResult with headline metrics and
 * timing. Adding a new operation to the Runner is a one-case addition
 * here plus a corresponding textsForStep() case in inputs.ts.
 */

import type {
  ProtocolStep,
  ProtocolStepResult,
  StepHeadlineMetrics,
} from "@/types/protocols";
import {
  computeConceptDistance,
  conceptDistanceHeadline,
} from "@/lib/operations/concept-distance";
import {
  computeVectorLogic,
  vectorLogicHeadline,
} from "@/lib/operations/vector-logic";
import {
  computeNegationGauge,
  negationGaugeHeadline,
} from "@/lib/operations/negation-gauge";
import {
  computeSemanticSectioning,
  semanticSectioningHeadline,
} from "@/lib/operations/semantic-sectioning";
import {
  computeNegationBattery,
  negationBatteryHeadline,
  resolveNegationBatteryPreset,
} from "@/lib/operations/negation-battery";
import {
  computeAgonismTest,
  agonismTestHeadline,
  type AgonismPair,
} from "@/lib/operations/agonism-test";
import {
  computeHegemonyCompass,
  hegemonyCompassHeadline,
  type HegemonyCompassInputs,
} from "@/lib/operations/hegemony-compass";
import {
  computeDistanceMatrix,
  distanceMatrixHeadline,
} from "@/lib/operations/distance-matrix";

export interface ExecuteStepContext {
  stepIndex: number;
  stepVectors: Map<string, number[][]>;
  enabledModels: Array<{ id: string; name: string; providerId: string }>;
}

/**
 * Resolve battery statements from a step's inputs, mirroring the
 * collector in inputs.ts so executor and collector stay in sync.
 */
function resolveBatteryStatementsForExec(inputs: Record<string, unknown>): string[] {
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
 * Resolve Hegemony Compass inputs for execution, mirroring the input
 * collector in inputs.ts. The compute function will validate that the
 * inputs resolve to a known preset or explicit axes.
 */
function resolveCompassInputsForExec(
  inputs: Record<string, unknown>
): HegemonyCompassInputs {
  const preset = typeof inputs.preset === "string" ? inputs.preset : undefined;
  const concepts = resolveConceptsForExec(inputs);
  const out: HegemonyCompassInputs = { preset, concepts: concepts.length > 0 ? concepts : undefined };
  if (typeof inputs.xAxis === "object" && inputs.xAxis !== null) {
    out.xAxis = inputs.xAxis as HegemonyCompassInputs["xAxis"];
  }
  if (typeof inputs.yAxis === "object" && inputs.yAxis !== null) {
    out.yAxis = inputs.yAxis as HegemonyCompassInputs["yAxis"];
  }
  return out;
}

/** Concepts list collector: array or comma-separated string. */
function resolveConceptsForExec(inputs: Record<string, unknown>): string[] {
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
 * Resolve agonism pairs from a step's inputs. Returns undefined so the
 * pure function falls back to its preset logic.
 */
function resolveAgonismPairsForExec(
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
 * Execute one step synchronously (all vectors are pre-fetched).
 */
export function executeStep(
  step: ProtocolStep,
  ctx: ExecuteStepContext
): ProtocolStepResult {
  const started = performance.now();
  const startedAt = new Date().toISOString();

  try {
    switch (step.operation) {
      case "distance": {
        const termA = typeof step.inputs.termA === "string" ? step.inputs.termA : "";
        const termB = typeof step.inputs.termB === "string" ? step.inputs.termB : "";
        if (!termA || !termB) {
          throw new Error(`distance step requires "termA" and "termB" inputs`);
        }
        const result = computeConceptDistance(
          { termA, termB },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: conceptDistanceHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "analogy": {
        const termA = typeof step.inputs.termA === "string" ? step.inputs.termA : "";
        const termB = typeof step.inputs.termB === "string" ? step.inputs.termB : "";
        const termC = typeof step.inputs.termC === "string" ? step.inputs.termC : "";
        if (!termA || !termB || !termC) {
          throw new Error(`analogy (Vector Logic) step requires "termA", "termB", "termC"`);
        }
        const result = computeVectorLogic(
          { termA, termB, termC },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: vectorLogicHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "negation": {
        const statement = typeof step.inputs.statement === "string" ? step.inputs.statement : "";
        if (!statement) {
          throw new Error(`negation step requires a "statement" input`);
        }
        const negated = typeof step.inputs.negated === "string" ? step.inputs.negated : undefined;
        const threshold =
          typeof step.inputs.threshold === "number" ? step.inputs.threshold : undefined;
        const result = computeNegationGauge(
          { statement, negated, threshold },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: negationGaugeHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "sectioning": {
        const anchorA = typeof step.inputs.anchorA === "string" ? step.inputs.anchorA : "";
        const anchorB = typeof step.inputs.anchorB === "string" ? step.inputs.anchorB : "";
        if (!anchorA || !anchorB) {
          throw new Error(`sectioning step requires "anchorA" and "anchorB"`);
        }
        const result = computeSemanticSectioning(
          { anchorA, anchorB },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: semanticSectioningHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "battery": {
        const statements = resolveBatteryStatementsForExec(step.inputs);
        if (statements.length === 0) {
          throw new Error(
            `battery step requires either "preset" (one of the NEGATION_BATTERIES keys) or an inline "statements" list`
          );
        }
        const threshold =
          typeof step.inputs.threshold === "number" ? step.inputs.threshold : undefined;
        const result = computeNegationBattery(
          { statements, threshold },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        const uniqueModelIds = new Set<string>();
        for (const row of result.statements) {
          for (const m of row.models) uniqueModelIds.add(m.modelId);
        }
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: Array.from(uniqueModelIds),
          headline: negationBatteryHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "compass": {
        const inputs = resolveCompassInputsForExec(step.inputs);
        const result = computeHegemonyCompass(inputs, ctx.stepVectors, ctx.enabledModels);
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: hegemonyCompassHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "matrix": {
        const concepts = resolveConceptsForExec(step.inputs);
        if (concepts.length < 2) {
          throw new Error(`matrix step requires at least two concepts (under "concepts").`);
        }
        const result = computeDistanceMatrix({ concepts }, ctx.stepVectors, ctx.enabledModels);
        const elapsedMs = performance.now() - started;
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: result.models.map(m => m.modelId),
          headline: distanceMatrixHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      case "agonism": {
        const pairs = resolveAgonismPairsForExec(step.inputs);
        const preset = typeof step.inputs.preset === "string" ? step.inputs.preset : undefined;
        const threshold =
          typeof step.inputs.threshold === "number" ? step.inputs.threshold : undefined;
        const result = computeAgonismTest(
          { pairs, preset, threshold },
          ctx.stepVectors,
          ctx.enabledModels
        );
        const elapsedMs = performance.now() - started;
        const uniqueModelIds = new Set<string>();
        for (const row of result.pairs) {
          for (const m of row.models) uniqueModelIds.add(m.modelId);
        }
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "done",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs,
          models: Array.from(uniqueModelIds),
          headline: agonismTestHeadline(result) as StepHeadlineMetrics,
          details: result,
        };
      }

      default: {
        return {
          stepIndex: ctx.stepIndex,
          step,
          status: "skipped",
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: 0,
          models: [],
          error: `Operation "${step.operation}" is not yet wired to the Protocol Runner. (Scheduled for the progressive refactor.)`,
        };
      }
    }
  } catch (err) {
    const elapsedMs = performance.now() - started;
    return {
      stepIndex: ctx.stepIndex,
      step,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      elapsedMs,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

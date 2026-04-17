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

export interface ExecuteStepContext {
  stepIndex: number;
  stepVectors: Map<string, number[][]>;
  enabledModels: Array<{ id: string; name: string; providerId: string }>;
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

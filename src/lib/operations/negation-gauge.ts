/**
 * Negation Gauge — pure compute.
 *
 * Measures a statement against its negation and against a family of
 * controls, across all enabled models. The controls are what make the
 * result readable: a cosine between a claim and its negation, on its
 * own, cannot tell you whether the model is reporting shared vocabulary
 * or failing on the negation operator. See negation-controls.ts.
 *
 * Where a calibration exists for a model, every cosine is also reported
 * as a position on that model's own floor-to-identity scale, which is
 * the only form in which two models can be compared.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { generateNegation } from "@/lib/negation";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import {
  buildProbeFamily,
  probeFamilyTextList,
  type Control,
  type ProbeFamily,
} from "@/lib/operations/negation-controls";
import type { ModelCalibration } from "@/lib/calibration/compute";
import { floorFor } from "@/lib/calibration/compute";
import {
  normalisedPosition,
  floorZ,
  angularFraction,
  angleDegrees,
} from "@/lib/calibration/baseline";
import {
  resolveThreshold,
  structuralControls,
  DEFAULT_THRESHOLD_MODE,
  LEGACY_FIXED_THRESHOLD,
  type ThresholdMode,
  type ResolvedThreshold,
} from "@/lib/calibration/threshold";

/**
 * Retained for callers that still pass a fixed cutoff. This is a
 * stipulated constant and is no longer the default path: see
 * calibration/threshold.ts.
 */
export const DEFAULT_NEGATION_THRESHOLD = LEGACY_FIXED_THRESHOLD;

export interface NegationGaugeInputs {
  /** Full statement to test, e.g. "This policy is fair". */
  statement: string;
  /** Fixed cutoff, used only when thresholdMode is "fixed". */
  threshold?: number;
  /** Override for the negated form. Defaults to the rule-based generator. */
  negated?: string;
  /** Generate and measure the control family. Defaults to true. */
  withControls?: boolean;
  /** How the collapse cutoff is derived. Defaults to control-derived. */
  thresholdMode?: ThresholdMode;
}

/** One measured text against the original, in one model. */
export interface MeasuredControl {
  control: Control;
  cosine: number;
  /** Position on the floor-to-identity scale. Null when uncalibrated. */
  normalised: number | null;
  /** Standard deviations above the floor. Null when uncalibrated. */
  z: number | null;
}

export interface NegationGaugeModelResult {
  modelId: string;
  modelName: string;
  providerId: string;
  dimensions: number;

  cosineSimilarity: number;
  cosineDistance: number;
  /** Raw arc in degrees. Read it against angularRangeDeg, not against 180. */
  angularDistance: number;

  /** Null when the model has no calibration. */
  normalised: number | null;
  z: number | null;
  /** Fraction of the model's reachable angular range that the negation covers. */
  angularCoverage: number | null;
  floorMean: number | null;
  floorSd: number | null;
  topicalCeiling: number | null;
  coneHalfAngleDeg: number | null;
  usableRange: number | null;
  calibrated: boolean;

  controls: MeasuredControl[];
  threshold: ResolvedThreshold;
  collapsed: boolean;
  /**
   * True when the negation is at least as close to the original as every
   * same-size, non-reversing edit. The finding token overlap cannot
   * explain. Null when no structural controls were measured.
   */
  exceedsControls: boolean | null;
}

export interface NegationGaugeResult {
  original: string;
  negated: string;
  family: ProbeFamily | null;
  /** The fixed cutoff, kept so old result cards still render. */
  threshold: number;
  thresholdMode: ThresholdMode;
  models: NegationGaugeModelResult[];
}

function resolveFamily(inputs: NegationGaugeInputs): ProbeFamily {
  return buildProbeFamily(inputs.statement, { negation: inputs.negated });
}

/** Texts that need embedding for a negation gauge step. */
export function negationGaugeTextList(inputs: NegationGaugeInputs): string[] {
  const family = resolveFamily(inputs);
  if (inputs.withControls === false) {
    return [family.statement, family.negation.text];
  }
  return probeFamilyTextList(family);
}

export function computeNegationGauge(
  inputs: NegationGaugeInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>,
  calibrations?: Map<string, ModelCalibration>
): NegationGaugeResult {
  const family = resolveFamily(inputs);
  const withControls = inputs.withControls !== false;
  const activeControls = withControls ? family.controls : [];
  const fixedThreshold = inputs.threshold ?? DEFAULT_NEGATION_THRESHOLD;
  const mode = inputs.thresholdMode ?? DEFAULT_THRESHOLD_MODE;

  const models: NegationGaugeModelResult[] = enabledModels
    .filter(m => modelVectors.has(m.id))
    .map(m => {
      const vectors = modelVectors.get(m.id)!;
      const cal = calibrations?.get(m.id) ?? null;
      const floor = cal ? floorFor(cal, "short") : null;

      const sim = cosineSimilarity(vectors[0], vectors[1]);

      // Controls occupy positions 2..n, in the order buildProbeFamily
      // produced them. A short vector array means the caller embedded
      // without controls, so the family is measured only as far as the
      // vectors go.
      const measured: MeasuredControl[] = activeControls
        .map((control, i) => {
          const vec = vectors[i + 2];
          if (!vec) return null;
          const cosine = cosineSimilarity(vectors[0], vec);
          return {
            control,
            cosine,
            normalised: floor ? normalisedPosition(cosine, floor.mean) : null,
            z: floor ? floorZ(cosine, floor.mean, floor.sd) : null,
          } satisfies MeasuredControl;
        })
        .filter((c): c is MeasuredControl => c !== null);

      const threshold = resolveThreshold({
        mode,
        fixedValue: fixedThreshold,
        calibration: cal,
        register: "short",
        controls: measured,
      });

      const structural = structuralControls(measured);
      const exceedsControls =
        structural.length > 0 ? structural.every(c => sim >= c.cosine) : null;

      return {
        modelId: m.id,
        modelName: EMBEDDING_MODELS.find(s => s.id === m.id)?.name || m.name || m.id,
        providerId: m.providerId,
        dimensions: vectors[0].length,

        cosineSimilarity: sim,
        cosineDistance: 1 - sim,
        angularDistance: angleDegrees(sim),

        normalised: floor ? normalisedPosition(sim, floor.mean) : null,
        z: floor ? floorZ(sim, floor.mean, floor.sd) : null,
        angularCoverage: floor ? 1 - angularFraction(sim, floor.mean) : null,
        floorMean: floor ? floor.mean : null,
        floorSd: floor ? floor.sd : null,
        topicalCeiling: cal ? cal.topicalCeiling.mean : null,
        coneHalfAngleDeg: cal ? cal.radius.coneHalfAngleDeg : null,
        usableRange: cal ? cal.radius.usableRange : null,
        calibrated: cal !== null,

        controls: measured,
        threshold,
        collapsed: sim >= threshold.value,
        exceedsControls,
      };
    })
    .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

  return {
    original: family.statement,
    negated: family.negation.text,
    family,
    threshold: fixedThreshold,
    thresholdMode: mode,
    models,
  };
}

/** Headline metrics for the Protocol Runner result card. */
export function negationGaugeHeadline(
  result: NegationGaugeResult
): Record<string, number | string> {
  if (result.models.length === 0) return { status: "no models" };

  const collapsedCount = result.models.filter(m => m.collapsed).length;
  const avg =
    result.models.reduce((s, m) => s + m.cosineSimilarity, 0) / result.models.length;
  const calibrated = result.models.filter(m => m.calibrated);
  const exceeding = result.models.filter(m => m.exceedsControls === true).length;
  const withControls = result.models.filter(m => m.exceedsControls !== null).length;

  const out: Record<string, number | string> = {
    statement: truncate(result.original, 60),
    negation: truncate(result.negated, 60),
    "avg cosine": Number(avg.toFixed(4)),
    "collapsed models": `${collapsedCount} / ${result.models.length}`,
    "threshold mode": result.thresholdMode,
  };

  if (calibrated.length > 0) {
    const avgNorm =
      calibrated.reduce((s, m) => s + (m.normalised ?? 0), 0) / calibrated.length;
    out["avg position floor→identity"] = Number(avgNorm.toFixed(4));
  } else {
    out["calibration"] = "none — cosines have no measured scale";
  }

  if (withControls > 0) {
    out["exceeds same-size controls"] = `${exceeding} / ${withControls}`;
  }

  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

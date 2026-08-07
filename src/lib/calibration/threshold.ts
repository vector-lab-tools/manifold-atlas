/**
 * Where the collapse cutoff comes from.
 *
 * The original instrument reported collapse above a stipulated 0.92 (or
 * 0.85, depending which constant was reached first). Both are choices
 * dressed as measurements, and the objection that lands on the number
 * lands equally on the bands underneath it.
 *
 * Three modes, in increasing order of defensibility:
 *
 *   fixed           the stipulated constant. Retained only so earlier
 *                   runs can be reproduced.
 *
 *   floor-relative  a fixed proportion of the floor-to-identity range.
 *                   Adapts to the model, so it is at least measuring on
 *                   the right scale, but the proportion is still chosen.
 *
 *   control-derived the matched-edit controls for this specific probe.
 *                   Collapse means the negation is at least as close to
 *                   the original as an edit of the same size that does
 *                   not reverse the truth conditions. Nothing is
 *                   stipulated.
 *
 * Note on what does NOT work: setting the cutoff at two standard
 * deviations above the random-pair floor. With a floor near 0.15 and a
 * spread near 0.06 that puts the cutoff around 0.27, and every sentence
 * pair sharing a determiner clears it. The random-pair distribution is
 * the wrong null for negation. The right null is an edit of the same
 * size without the reversal, which is the control-derived mode.
 */

import type { ModelCalibration } from "./compute";
import { floorFor, type Register } from "./compute";
import type { Control } from "@/lib/operations/negation-controls";

export type ThresholdMode = "fixed" | "floor-relative" | "control-derived";

export const DEFAULT_THRESHOLD_MODE: ThresholdMode = "control-derived";
/** Proportion of the floor-to-identity range used by floor-relative mode. */
export const DEFAULT_FLOOR_RELATIVE_K = 0.85;
/** The historical stipulated constant, kept for reproducing old runs. */
export const LEGACY_FIXED_THRESHOLD = 0.92;

export interface ResolvedThreshold {
  value: number;
  /** Which mode actually produced the value, after any fallback. */
  mode: ThresholdMode;
  /** True when the requested mode could not be used. */
  fellBack: boolean;
  /** One line naming what the cutoff was derived from. */
  basis: string;
}

export interface ThresholdRequest {
  mode: ThresholdMode;
  fixedValue?: number;
  floorRelativeK?: number;
  calibration?: ModelCalibration | null;
  register?: Register;
  /**
   * Cosines of the structural controls for this probe, paired with the
   * control that produced each. Only insertedModifier and matchedEdit
   * count: the antonym carries real opposition and the unrelated
   * predicate changes the subject matter, so neither is a null for an
   * edit of the same size.
   */
  controls?: Array<{ control: Control; cosine: number }>;
}

/** Controls that count as a null for a same-size, non-reversing edit. */
export function structuralControls(
  controls: Array<{ control: Control; cosine: number }>
): Array<{ control: Control; cosine: number }> {
  return controls.filter(
    c => c.control.kind === "insertedModifier" || c.control.kind === "matchedEdit"
  );
}

export function resolveThreshold(req: ThresholdRequest): ResolvedThreshold {
  const fixedValue = req.fixedValue ?? LEGACY_FIXED_THRESHOLD;

  if (req.mode === "control-derived") {
    const structural = structuralControls(req.controls ?? []);
    if (structural.length > 0) {
      // The highest control, so collapse is only reported when the
      // negation is closer than every same-size edit. The conservative
      // choice, because this is the claim that has to survive scrutiny.
      let top = structural[0];
      for (const c of structural) if (c.cosine > top.cosine) top = c;
      return {
        value: top.cosine,
        mode: "control-derived",
        fellBack: false,
        basis: `highest same-size non-reversing edit: "${top.control.text}" at ${top.cosine.toFixed(4)}`,
      };
    }
    // No usable controls, so fall through to the floor.
    const floor = req.calibration ? floorFor(req.calibration, req.register).mean : null;
    if (floor !== null) {
      const k = req.floorRelativeK ?? DEFAULT_FLOOR_RELATIVE_K;
      return {
        value: floor + k * (1 - floor),
        mode: "floor-relative",
        fellBack: true,
        basis: `no controls available; ${(k * 100).toFixed(0)}% of the floor-to-identity range above a floor of ${floor.toFixed(4)}`,
      };
    }
    return {
      value: fixedValue,
      mode: "fixed",
      fellBack: true,
      basis: `no controls and no calibration; stipulated constant ${fixedValue}`,
    };
  }

  if (req.mode === "floor-relative") {
    const floor = req.calibration ? floorFor(req.calibration, req.register).mean : null;
    if (floor !== null) {
      const k = req.floorRelativeK ?? DEFAULT_FLOOR_RELATIVE_K;
      return {
        value: floor + k * (1 - floor),
        mode: "floor-relative",
        fellBack: false,
        basis: `${(k * 100).toFixed(0)}% of the floor-to-identity range above a measured floor of ${floor.toFixed(4)}`,
      };
    }
    return {
      value: fixedValue,
      mode: "fixed",
      fellBack: true,
      basis: `model not calibrated; stipulated constant ${fixedValue}`,
    };
  }

  return {
    value: fixedValue,
    mode: "fixed",
    fellBack: false,
    basis: `stipulated constant ${fixedValue}`,
  };
}

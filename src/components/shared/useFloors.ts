"use client";

/**
 * Per-model floor lookup for one register.
 *
 * Every operation that reports a cosine needs the same three things:
 * the floor for the kind of text it embeds, whether the model has been
 * calibrated at all, and the usable range for turning a difference of
 * cosines into a comparable quantity. Doing that lookup in each
 * component invites each one to pick a slightly different register, so
 * it lives here and the component declares its register once.
 *
 *   const floors = useFloors("term");
 *   const floor = floors.floor(modelId);        // number | null
 *   const low = floors.floorLow(modelId);       // number | null
 *   floors.calibrated(modelId)                  // boolean
 *   floors.usableRange(modelId)                 // number | null
 *
 * The floor is the mean cosine of unrelated pairs, a baseline rather
 * than a lower bound: about half of all unrelated pairs fall below it.
 * floorLow is the genuine lower edge, the value only 5 per cent of
 * unrelated pairs fall below, and is what a scale should start from.
 *
 * A null floor means the model has no calibration. Components render
 * the uncalibrated variant in that case rather than substituting a
 * constant, so the interface never implies a scale it does not have.
 */

import { useCallback, useMemo } from "react";
import { useCalibration } from "@/context/CalibrationContext";
import { floorFor, coneFor, usableRangeFor, type Register } from "@/lib/calibration/compute";

export interface FloorLookup {
  register: Register;
  floor: (modelId: string) => number | null;
  /** 5th percentile of unrelated-pair cosines: the scale's lower edge. */
  floorLow: (modelId: string) => number | null;
  floorSd: (modelId: string) => number | null;
  cone: (modelId: string) => number | null;
  usableRange: (modelId: string) => number | null;
  topicalCeiling: (modelId: string) => number | null;
  calibrated: (modelId: string) => boolean;
  /** Enabled models with no calibration record. */
  missing: Array<{ id: string; name: string; providerId: string }>;
  /** True when at least one enabled model is uncalibrated. */
  anyMissing: boolean;
}

export function useFloors(register: Register): FloorLookup {
  const { calibrations, uncalibratedModels } = useCalibration();

  const floor = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      return cal ? floorFor(cal, register).mean : null;
    },
    [calibrations, register]
  );

  const floorLow = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      if (!cal) return null;
      const d = floorFor(cal, register);
      // Calibrations saved before the percentiles were kept fall back to the mean.
      return typeof d.p05 === "number" && d.n > 0 ? d.p05 : d.mean;
    },
    [calibrations, register]
  );

  const floorSd = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      return cal ? floorFor(cal, register).sd : null;
    },
    [calibrations, register]
  );

  const cone = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      return cal ? coneFor(cal, register) : null;
    },
    [calibrations, register]
  );

  const usableRange = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      return cal ? usableRangeFor(cal, register) : null;
    },
    [calibrations, register]
  );

  const topicalCeiling = useCallback(
    (modelId: string) => {
      const cal = calibrations.get(modelId);
      return cal ? cal.topicalCeiling.mean : null;
    },
    [calibrations]
  );

  const calibrated = useCallback(
    (modelId: string) => calibrations.has(modelId),
    [calibrations]
  );

  return useMemo(
    () => ({
      register,
      floor,
      floorLow,
      floorSd,
      cone,
      usableRange,
      topicalCeiling,
      calibrated,
      missing: uncalibratedModels,
      anyMissing: uncalibratedModels.length > 0,
    }),
    [register, floor, floorLow, floorSd, cone, usableRange, topicalCeiling, calibrated, uncalibratedModels]
  );
}

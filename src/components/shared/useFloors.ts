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
 *   floors.calibrated(modelId)                  // boolean
 *   floors.usableRange(modelId)                 // number | null
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
      floorSd,
      cone,
      usableRange,
      topicalCeiling,
      calibrated,
      missing: uncalibratedModels,
      anyMissing: uncalibratedModels.length > 0,
    }),
    [register, floor, floorSd, cone, usableRange, topicalCeiling, calibrated, uncalibratedModels]
  );
}

"use client";

/**
 * Banner shown when an operation is about to report cosines for models
 * that have no measured floor.
 *
 * The point is not to block the run. Results are still computed and
 * shown; what the banner says is that the numbers have no origin, so a
 * reader does not take an uncalibrated 0.84 for the same statement as a
 * calibrated one. It offers the calibration inline so that fixing it
 * does not mean leaving the operation.
 */

import { AlertTriangle } from "lucide-react";
import { useCalibration } from "@/context/CalibrationContext";
import { MetricTerm } from "@/components/shared/MetricTerm";
import { REGISTER_LABELS, type Register } from "@/lib/calibration/compute";

interface CalibrationNoticeProps {
  /** The kind of text this operation embeds. */
  register: Register;
  /** Models this operation will use that have no calibration. */
  missing: Array<{ id: string; name: string; providerId: string }>;
}

export function CalibrationNotice({ register, missing }: CalibrationNoticeProps) {
  const { calibrate, running } = useCalibration();
  if (missing.length === 0) return null;

  return (
    <div className="card-editorial p-3 flex gap-2 items-start border-l-2 border-warning-500">
      <AlertTriangle size={14} className="text-warning-500 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-sans text-caption">
          {missing.length === 1
            ? `${missing[0].name} has no baseline.`
            : `${missing.length} enabled models have no baseline.`}{" "}
          Cosines below are shown against stipulated bands rather than against a measured{" "}
          <MetricTerm termKey="floor">floor</MetricTerm> for {REGISTER_LABELS[register]}, so
          they have no origin to be read from and cannot be compared across models.
        </p>
        <button
          onClick={() => calibrate(missing.map(m => m.id))}
          disabled={running}
          className="btn-editorial-secondary text-[11px] px-2 py-1 disabled:opacity-50"
        >
          {running ? "Calibrating…" : "Calibrate now"}
        </button>
      </div>
    </div>
  );
}

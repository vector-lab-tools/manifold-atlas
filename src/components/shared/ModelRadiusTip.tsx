"use client";

/**
 * Hover card giving a model's radius.
 *
 * This exists to answer a specific objection: a cosine on its own says
 * nothing when two models are being compared, because each model uses a
 * different amount of the sphere. Wherever a model is named, hovering
 * gives the radius of that model's space and the two anchors a reading
 * has to sit between, so the number beside the name can be interpreted
 * without leaving the view.
 *
 * The wording keeps the term "radius" rather than only the derived
 * quantities, because that is the term the objection was put in and the
 * card is the answer to it.
 */

import { useState, useRef, type ReactNode } from "react";
import { Cone } from "lucide-react";
import { useCalibration } from "@/context/CalibrationContext";
import { RadiusModal } from "@/components/shared/RadiusModal";
import { ConeDiagram } from "@/components/viz/ConeDiagram";
import {
  floorFor,
  coneFor,
  usableRangeFor,
  REGISTER_LABELS,
  type Register,
  type ModelCalibration,
} from "@/lib/calibration/compute";
import { angleDegrees } from "@/lib/calibration/baseline";
import { cn } from "@/lib/utils";

interface ModelRadiusTipProps {
  modelId: string;
  /** The register the surrounding operation works in. */
  register?: Register;
  children: ReactNode;
  className?: string;
  /**
   * A measurement from the calling operation. Drawn inside the cone in
   * the full view, so the figure on screen can be seen against the space
   * it was taken in rather than only against a number.
   */
  value?: { cosine: number; label: string } | null;
}

export function ModelRadiusTip({
  modelId,
  register = "short",
  children,
  className,
  value = null,
}: ModelRadiusTipProps) {
  const { calibrations } = useCalibration();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  const cal = calibrations.get(modelId);

  const summary = cal
    ? `Radius ${coneFor(cal, register).toFixed(1)}°. Floor ${floorFor(cal, register).mean.toFixed(4)} for ${REGISTER_LABELS[register]}.`
    : "No radius measured for this model. Cosines beside this name have no scale.";

  return (
    <span
      className={cn("relative inline-block", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        tabIndex={0}
        role="button"
        title={summary}
        className={cn(
          "cursor-help underline decoration-dotted underline-offset-2 outline-none rounded-sm",
          "focus-visible:ring-1 focus-visible:ring-burgundy",
          cal ? "decoration-muted-foreground/50" : "decoration-warning-500/70"
        )}
      >
        {children}
      </span>

      {cal && (
        <button
          onClick={() => setModal(true)}
          className="ml-1 align-middle text-muted-foreground hover:text-burgundy transition-colors"
          title={`Draw ${cal.modelName}'s cone, and compare it with the other calibrated models`}
          aria-label="Show the model's cone diagram"
        >
          <Cone size={12} />
        </button>
      )}

      {modal && cal && (
        <RadiusModal
          modelId={modelId}
          register={register}
          value={value}
          onClose={() => setModal(false)}
        />
      )}

      {open && (
        <span
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute z-50 left-0 top-full mt-1.5 w-[26rem] max-w-[88vw] p-3 rounded-sm shadow-lg bg-background border border-parchment-dark text-left normal-case tracking-normal"
        >
          {cal ? <Measured cal={cal} register={register} /> : <Unmeasured />}
        </span>
      )}
    </span>
  );
}

function Measured({ cal, register }: { cal: ModelCalibration; register: Register }) {
  const d = floorFor(cal, register);
  const cone = coneFor(cal, register);
  const range = usableRangeFor(cal, register);
  const r = cal.radius;

  // Where the two anchors sit as a proportion of the bar, so the reader
  // can see at a glance how little of the nominal scale is in play.
  const floorPct = d.mean * 100;
  const ceilingPct = cal.topicalCeiling.mean * 100;

  return (
    <>
      <span className="block font-display text-body-sm font-bold">
        {cal.modelName} — radius {cone.toFixed(1)}°
      </span>
      <span className="block mt-1.5">
        <ConeDiagram cal={cal} register={register} compact />
      </span>
      <span className="block font-sans text-[11px] leading-relaxed mt-1 text-foreground/90">
        This model uses a cone of about {cone.toFixed(1)}° for {REGISTER_LABELS[register]}, not
        the whole sphere. Two unrelated texts already sit at {d.mean.toFixed(4)}, so only{" "}
        {range.toFixed(4)} of the cosine scale is in play and the largest angle any two texts
        can show is {angleDegrees(d.mean).toFixed(1)}°, not 180°.
      </span>

      {/* The reachable band, drawn against the full 0–1 cosine scale. */}
      <span className="block mt-2">
        <span className="block relative h-2 rounded-full bg-parchment overflow-hidden">
          <span
            className="absolute inset-y-0 left-0 bg-foreground/10"
            style={{ width: `${floorPct}%` }}
          />
          <span
            className="absolute inset-y-0 bg-burgundy/30"
            style={{ left: `${floorPct}%`, right: 0 }}
          />
          <span
            className="absolute inset-y-0 w-px bg-cyan-600"
            style={{ left: `${ceilingPct}%` }}
          />
        </span>
        <span className="flex justify-between font-sans text-[9px] text-muted-foreground mt-0.5 tabular-nums">
          <span>0</span>
          <span>floor {d.mean.toFixed(3)}</span>
          <span>ceiling {cal.topicalCeiling.mean.toFixed(3)}</span>
          <span>1</span>
        </span>
      </span>

      <span className="block font-sans text-[10px] leading-relaxed mt-2 text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-[9px]">Reading a cosine here </span>
        Below {d.mean.toFixed(2)} is indistinguishable from unrelated text. Around{" "}
        {cal.topicalCeiling.mean.toFixed(2)} is where two texts merely on the same subject land.
        A figure only counts as close if it clears that.
      </span>

      <span className="block font-sans text-[10px] leading-relaxed mt-2 text-muted-foreground">
        Radius by register: terms {cal.coneByRegister.term.toFixed(1)}°, declaratives{" "}
        {cal.coneByRegister.short.toFixed(1)}°, prose {cal.coneByRegister.prose.toFixed(1)}°.
        Effective dimension {r.effectiveDim.toFixed(0)} of {r.effectiveDimCeiling.toFixed(0)}{" "}
        reachable; top coordinate carries {(r.topDimShare * 100).toFixed(1)}%.
      </span>

      <span className="block font-sans text-[10px] leading-relaxed mt-2 text-muted-foreground/80 border-t border-parchment pt-1.5">
        The radius is a first-order figure. It describes the space as a cap around a single mean
        direction, which real embedding spaces only approximate: the effective dimension and the
        top-coordinate share beside it are what show how far off that description is.
      </span>
    </>
  );
}

function Unmeasured() {
  const { calibrate, running } = useCalibration();
  return (
    <>
      <span className="block font-display text-body-sm font-bold text-warning-600">
        Radius not measured
      </span>
      <span className="block font-sans text-[11px] leading-relaxed mt-1 text-foreground/90">
        Every model uses a different amount of the sphere, and this one has not been measured.
        A cosine shown beside this name has no origin: it cannot be said to be high or low, and
        it cannot be compared with the same figure from another model.
      </span>
      <button
        onClick={() => calibrate()}
        disabled={running}
        className="btn-editorial-secondary text-[11px] px-2 py-1 mt-2 disabled:opacity-50"
      >
        {running ? "Measuring…" : "Measure the radius"}
      </button>
    </>
  );
}

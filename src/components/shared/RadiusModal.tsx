"use client";

/**
 * Full-size view of a model's radius, with a side-by-side comparison of
 * every calibrated model.
 *
 * The hover card answers "what scale is this number on" in passing. This
 * answers the comparison question, which is the one the objection was
 * really about: two models reporting the same cosine are not reporting
 * the same thing, and the fastest way to see that is to put their cones
 * next to each other at the same scale.
 */

import { useState } from "react";
import { X, Columns2, Circle } from "lucide-react";
import { useCalibration } from "@/context/CalibrationContext";
import { ConeDiagram } from "@/components/viz/ConeDiagram";
import { MetricTerm } from "@/components/shared/MetricTerm";
import { CopyableCommand } from "@/components/shared/CopyableCommand";
import { radiusLine } from "@/lib/calibration/report";
import {
  coneFor,
  floorFor,
  usableRangeFor,
  REGISTER_LABELS,
  type Register,
  type ModelCalibration,
} from "@/lib/calibration/compute";
import { normalisedPosition } from "@/lib/calibration/baseline";
import { cn } from "@/lib/utils";

interface RadiusModalProps {
  modelId: string;
  register: Register;
  onClose: () => void;
}

/**
 * Deliberately takes no measurement from the calling operation. The
 * radius is a property of the space, and a single query's cosine laid
 * over it reads as though the two were the same kind of fact. In
 * comparison mode it was worse: the value could only be drawn for the
 * one model it came from, so five cones carried no line and one did,
 * which looks like a finding about that model.
 */
export function RadiusModal({ modelId, register, onClose }: RadiusModalProps) {
  const { calibrations } = useCalibration();
  const [mode, setMode] = useState<"single" | "compare">("single");
  // The cone is not the same width for a term as for a paragraph in the
  // same model, so the register is a first-class control here rather
  // than something inherited from whichever panel opened the modal.
  const [reg, setReg] = useState<Register | "all">(register);

  const cal = calibrations.get(modelId);
  const all = [...calibrations.values()];
  if (!cal) return null;

  const shown: ModelCalibration[] = mode === "compare" ? all : [cal];
  const REGISTERS: Register[] = ["term", "short", "prose"];
  const regsShown: Register[] = reg === "all" ? REGISTERS : [reg];

  // One panel per model per register.
  const panels = shown.flatMap(c => regsShown.map(r => ({ c, r })));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[min(860px,94vw)] max-h-[88vh] overflow-y-auto overflow-x-hidden card-editorial shadow-editorial-lg animate-fade-in">
        <div className="px-6 pt-6 pb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-display-md font-bold">
              {mode === "single" ? cal.modelName : "Radius comparison"}
            </h2>
            <p className="font-sans text-caption text-muted-foreground mt-1 max-w-xl">
              Every vector is unit length, so they all land on the dashed sphere. The shaded cap
              is the part of that surface the model actually reaches; the cone is the solid it
              sweeps. The two dark lines are where a pair of unrelated texts really sits, which
              is the widest separation any real pair will show, and it is wider than the
              half-angle rather than equal to it.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex rounded-sm border border-parchment-dark overflow-hidden mr-1">
              {(["term", "short", "prose", "all"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setReg(r)}
                  className={cn(
                    "px-2 py-1 font-sans text-[10px] transition-colors",
                    reg === r
                      ? "bg-burgundy text-white"
                      : "hover:bg-cream/60 text-muted-foreground"
                  )}
                  title={
                    r === "all"
                      ? "Show all three registers side by side"
                      : `Show the cone for ${REGISTER_LABELS[r]}`
                  }
                >
                  {r === "all" ? "all 3" : r === "short" ? "declar." : r}
                </button>
              ))}
            </div>
            {all.length > 1 && (
              <button
                onClick={() => setMode(mode === "single" ? "compare" : "single")}
                className="btn-editorial-ghost px-2 py-1 inline-flex items-center gap-1 text-caption"
                title={mode === "single" ? "Compare all calibrated models" : "Show this model alone"}
              >
                {mode === "single" ? <Columns2 size={14} /> : <Circle size={14} />}
                {mode === "single" ? "Compare" : "Single"}
              </button>
            )}
            <button onClick={onClose} className="btn-editorial-ghost px-2 py-1">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="thin-rule mx-6" />

        {/* Grouped by model, with the registers as a row beneath each
            name. A flat grid of eighteen panels reads as a wall; the
            comparison people actually want is one model across its
            registers, or one register down the models, and both are
            easier to find when the model owns the row. */}
        <div className="px-6 py-5 space-y-5">
          {shown.map(c => (
            <section key={c.modelId} className="space-y-2">
              {shown.length > 1 && (
                <div className="flex items-baseline gap-2 border-b border-parchment pb-1">
                  <h3 className="font-display text-body-lg font-bold truncate" title={c.modelName}>
                    {c.modelName}
                  </h3>
                  <span className="font-sans text-[10px] text-muted-foreground shrink-0">
                    {c.providerId} · {c.radius.nominalDim}d
                  </span>
                  <span className="ml-auto font-sans text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {regsShown.length > 1
                      ? regsShown.map(r => `${coneFor(c, r).toFixed(0)}°`).join(" / ")
                      : `${coneFor(c, regsShown[0]).toFixed(1)}°`}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "grid gap-x-5 gap-y-3",
                  regsShown.length === 1
                    ? "grid-cols-1 max-w-sm"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {regsShown.map(r => (
                  <div key={`${c.modelId}-${r}`} className="space-y-0.5 min-w-0">
                    {regsShown.length > 1 && (
                      <div className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
                        {REGISTER_LABELS[r]}
                      </div>
                    )}
                    <ConeDiagram
                      cal={c}
                      register={r}
                      compact={panels.length > 3}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {mode === "compare" && all.length > 1 && (
          <>
            <div className="thin-rule mx-6" />
            <div className="px-6 py-4 space-y-2">
              <h3 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                Side by side, {reg === "all" ? REGISTER_LABELS[register] : REGISTER_LABELS[reg]}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-caption tabular-nums">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-parchment">
                      <th className="py-1 pr-3 font-medium">Model</th>
                      <th className="py-1 pr-3 font-medium text-right">
                        <MetricTerm termKey="coneHalfAngle">radius</MetricTerm>
                      </th>
                      <th className="py-1 pr-3 font-medium text-right">
                        <MetricTerm termKey="floor">floor</MetricTerm>
                      </th>
                      <th className="py-1 pr-3 font-medium text-right">
                        <MetricTerm termKey="topicalCeiling">ceiling</MetricTerm>
                      </th>
                      <th className="py-1 pr-3 font-medium text-right">
                        <MetricTerm termKey="usableRange">range</MetricTerm>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment">
                    {all.map(c => (
                      <tr key={c.modelId}>
                        <td className="py-1 pr-3 font-medium">{c.modelName}</td>
                        <td className="py-1 pr-3 text-right">{coneFor(c, reg === "all" ? register : reg).toFixed(1)}°</td>
                        <td className="py-1 pr-3 text-right">
                          {floorFor(c, reg === "all" ? register : reg).mean.toFixed(4)}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {c.topicalCeiling.mean.toFixed(4)}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {usableRangeFor(c, reg === "all" ? register : reg).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="font-sans text-[10px] text-muted-foreground">
                A wider cone is not a better model. It means unrelated texts sit further apart,
                so the scale has more room in it and a given cosine difference is a smaller
                proportion of what the space can express.
              </p>
            </div>
          </>
        )}

        <div className="thin-rule mx-6" />
        <div className="px-6 py-4 space-y-1.5 min-w-0">
          {shown.map(c => (
            <CopyableCommand key={c.modelId} command={radiusLine(c, reg === "all" ? register : reg)} />
          ))}
        </div>
      </div>
    </>
  );
}

"use client";

/**
 * Calibration panel.
 *
 * Measures each model's baseline and radius, and shows what was
 * measured. This is the panel that answers the question a bare cosine
 * cannot: what kind of space was this measurement taken in, and how
 * much room does that space have.
 */

import { useState } from "react";
import { Loader2, RotateCw, Trash2, Play, AlertTriangle, Check } from "lucide-react";
import { useCalibration } from "@/context/CalibrationContext";
import { useSettings } from "@/context/SettingsContext";
import { MetricTerm, MetricStat } from "@/components/shared/MetricTerm";
import { ModelRadiusTip } from "@/components/shared/ModelRadiusTip";
import { DeepDivePanel, DeepDiveSection } from "@/components/shared/DeepDivePanel";
import { CopyableCommand } from "@/components/shared/CopyableCommand";
import {
  CALIBRATION_TEXT_COUNT,
  radiusLine,
  rawCosineComparable,
  type ModelCalibration,
} from "@/lib/calibration";
import { cn } from "@/lib/utils";

interface CalibrationProps {
  onQueryTime: (time: number) => void;
}

export function Calibration({ onQueryTime }: CalibrationProps) {
  const { calibrations, running, progress, calibrate, recalibrate, forget, forgetAll } =
    useCalibration();
  const { getEnabledModels } = useSettings();
  const enabled = getEnabledModels();
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCalibrateAll = async () => {
    const start = performance.now();
    await calibrate();
    onQueryTime((performance.now() - start) / 1000);
  };

  const records = enabled
    .map(m => calibrations.get(m.id))
    .filter((c): c is ModelCalibration => Boolean(c));

  // Raw cosines from models with materially different floors are not
  // the same measurement, and any chart that puts them on one axis is
  // misleading. Worth saying once, at the top, rather than per row.
  const floors = records.map(c => c.shortFloor.mean);
  const comparable =
    floors.length < 2 ||
    floors.every(a => floors.every(b => rawCosineComparable(a, b)));

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-h3 font-bold">Calibration</h2>
        <p className="font-sans text-body-sm text-muted-foreground max-w-2xl">
          A cosine has no meaning without the scale it sits on. Embedding vectors occupy a
          narrow cone rather than the whole sphere, so unrelated texts already sit at a high
          similarity, and where that floor falls differs from model to model. Calibration
          measures the floor, the topical ceiling and the radius of each model, so that every
          result elsewhere in the application can be reported against something measured
          rather than against a stipulated constant.
        </p>
        <p className="font-sans text-body-sm text-muted-foreground max-w-2xl">
          The floor is measured separately for three registers, because a bare term, a short
          claim and a paragraph do not sit at the same place in the cone. Concept Distance,
          Distance Matrix, Hegemony Compass, Silence Detector, Semantic Sectioning and Vector
          Logic read against the term floor; Negation Gauge, Negation Battery, Vector Drift and
          Agonism Test read against the declarative floor. Each operation names its register in
          its own Deep Dive.
        </p>
      </header>

      <div className="card-editorial p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCalibrateAll}
            disabled={running || enabled.length === 0}
            className="btn-editorial-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? "Calibrating" : "Calibrate all enabled models"}
          </button>
          {calibrations.size > 0 && (
            <button
              onClick={forgetAll}
              disabled={running}
              className="btn-editorial-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Clear all
            </button>
          )}
          <span className="font-sans text-caption text-muted-foreground">
            {CALIBRATION_TEXT_COUNT} texts per model, embedded once and cached.
          </span>
        </div>

        {enabled.length === 0 && (
          <p className="font-sans text-body-sm text-warning-600">
            No models enabled. Open Settings and enable at least one provider.
          </p>
        )}

        {progress.length > 0 && (
          <div className="space-y-1.5">
            {progress.map(p => (
              <div key={p.modelId} className="flex items-center gap-2">
                <span className="font-sans text-caption w-48 truncate"><ModelRadiusTip modelId={p.modelId} register="short">{p.modelName}</ModelRadiusTip></span>
                <div className="flex-1 h-1.5 bg-parchment rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      p.status === "error" ? "bg-error-500" : "bg-burgundy"
                    )}
                    style={{ width: `${(p.completed / Math.max(1, p.total)) * 100}%` }}
                  />
                </div>
                <span className="font-sans text-caption text-muted-foreground w-24 text-right tabular-nums">
                  {p.status === "error" ? "failed" : `${p.completed}/${p.total}`}
                </span>
              </div>
            ))}
            {progress
              .filter(p => p.status === "error")
              .map(p => (
                <p key={`err-${p.modelId}`} className="font-sans text-caption text-error-600">
                  {p.modelName}: {p.error}
                </p>
              ))}
          </div>
        )}
      </div>

      {!comparable && records.length > 1 && (
        <div className="card-editorial p-3 flex gap-2 items-start border-l-2 border-warning-500">
          <AlertTriangle size={14} className="text-warning-500 mt-0.5 shrink-0" />
          <p className="font-sans text-caption">
            These models have materially different floors, so their raw cosines are not the
            same measurement and should not be plotted on a shared axis. Compare the{" "}
            <MetricTerm termKey="normalisedPosition">normalised position</MetricTerm> instead.
          </p>
        </div>
      )}

      {records.map(cal => (
        <RadiusCard
          key={cal.modelId}
          cal={cal}
          open={expanded === cal.modelId}
          onToggle={() => setExpanded(expanded === cal.modelId ? null : cal.modelId)}
          onRecalibrate={() => recalibrate(cal.modelId)}
          onForget={() => forget(cal.modelId)}
          busy={running}
        />
      ))}

      {records.length > 0 && (
        <DeepDivePanel tagline="Distributions and reporting lines">
          <DeepDiveSection
            title="Reporting lines"
            tip="Paste these alongside any figure taken from this model."
          >
            <div className="space-y-1.5">
              {records.map(cal => (
                <CopyableCommand key={cal.modelId} command={radiusLine(cal)} />
              ))}
            </div>
          </DeepDiveSection>

          <DeepDiveSection
            title="Floor distributions"
            tip="Bare terms are the register for Concept Distance, Distance Matrix, Hegemony Compass, Silence Detector, Semantic Sectioning and Vector Logic. Short declaratives are the register for Negation Gauge, Negation Battery, Vector Drift and Agonism Test. Prose is for Text Vectorisation."
          >
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-caption tabular-nums">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Model</th>
                    <th className="py-1 pr-3 font-medium">Stratum</th>
                    <th className="py-1 pr-3 font-medium">n</th>
                    <th className="py-1 pr-3 font-medium">mean</th>
                    <th className="py-1 pr-3 font-medium">sd</th>
                    <th className="py-1 pr-3 font-medium">p05</th>
                    <th className="py-1 pr-3 font-medium">p50</th>
                    <th className="py-1 pr-3 font-medium">p95</th>
                  </tr>
                </thead>
                <tbody>
                  {records.flatMap(cal =>
                    (
                      [
                        ["bare terms", cal.termFloor],
                        ["short declarative", cal.shortFloor],
                        ["prose", cal.proseFloor],
                        ["topical ceiling", cal.topicalCeiling],
                      ] as const
                    ).map(([name, d], i) => (
                      <tr key={`${cal.modelId}-${name}`} className="border-t border-parchment">
                        <td className="py-1 pr-3">{i === 0 ? cal.modelName : ""}</td>
                        <td className="py-1 pr-3 text-muted-foreground">{name}</td>
                        <td className="py-1 pr-3">{d.n}</td>
                        <td className="py-1 pr-3">{d.mean.toFixed(4)}</td>
                        <td className="py-1 pr-3">{d.sd.toFixed(4)}</td>
                        <td className="py-1 pr-3">{d.p05.toFixed(4)}</td>
                        <td className="py-1 pr-3">{d.p50.toFixed(4)}</td>
                        <td className="py-1 pr-3">{d.p95.toFixed(4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DeepDiveSection>
        </DeepDivePanel>
      )}
    </div>
  );
}

function RadiusCard({
  cal,
  open,
  onToggle,
  onRecalibrate,
  onForget,
  busy,
}: {
  cal: ModelCalibration;
  open: boolean;
  onToggle: () => void;
  onRecalibrate: () => void;
  onForget: () => void;
  busy: boolean;
}) {
  const r = cal.radius;

  // The cone half-angle implies a floor; the measured floor should
  // agree. A wide gap means the corpus strata are not as homogeneous as
  // the derivation assumes, and the reader should know that rather than
  // find a clean number hiding it.
  const floorGap = Math.abs(r.impliedFloor - cal.shortFloor.mean);
  const consistent = floorGap < 0.05;

  return (
    <div className="card-editorial p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-body font-bold truncate"><ModelRadiusTip modelId={cal.modelId} register="short">{cal.modelName}</ModelRadiusTip></h3>
          <p className="font-sans text-caption text-muted-foreground">
            {cal.providerId} · {r.nominalDim} dimensions · calibrated{" "}
            {new Date(cal.computedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRecalibrate}
            disabled={busy}
            title="Recalibrate this model"
            className="p-1.5 rounded-sm hover:bg-cream disabled:opacity-40"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={onForget}
            disabled={busy}
            title="Forget this calibration"
            className="p-1.5 rounded-sm hover:bg-cream disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricStat
          termKey="coneHalfAngle"
          label="Radius (cone)"
          value={`${r.coneHalfAngleDeg.toFixed(1)}°`}
          hint={r.coneHalfAngleDeg < 45 ? "narrow: cosines compressed" : "of a possible 90°"}
          tone={r.coneHalfAngleDeg < 45 ? "warning" : "neutral"}
        />
        <MetricStat
          termKey="floor"
          label="Floor (declaratives)"
          value={cal.shortFloor.mean.toFixed(4)}
          hint={`terms ${cal.termFloor.mean.toFixed(4)} · prose ${cal.proseFloor.mean.toFixed(4)}`}
        />
        <MetricStat
          termKey="usableRange"
          label="Usable range"
          value={r.usableRange.toFixed(4)}
          hint={`of the nominal 2.0`}
          tone={r.usableRange < 0.4 ? "warning" : "neutral"}
        />
        <MetricStat
          termKey="topicalCeiling"
          label="Topical ceiling"
          value={cal.topicalCeiling.mean.toFixed(4)}
          hint="where mere aboutness lands"
        />
      </div>

      <button
        onClick={onToggle}
        className="font-sans text-caption text-burgundy hover:underline"
      >
        {open ? "Hide" : "Show"} the rest of the radius profile
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricStat
              termKey="effectiveDim"
              label="Effective dim"
              value={r.effectiveDim.toFixed(0)}
              hint={`ceiling ${r.effectiveDimCeiling.toFixed(0)} at n=${r.spectrumSampleSize}`}
              tone={r.dimensionEfficiency < 0.3 ? "warning" : "neutral"}
            />
            <MetricStat
              termKey="dimensionEfficiency"
              label="Dim efficiency"
              value={`${(r.dimensionEfficiency * 100).toFixed(1)}%`}
              hint={`of what ${r.spectrumSampleSize} texts can show`}
              tone={r.dimensionEfficiency < 0.3 ? "warning" : "neutral"}
            />
            <MetricStat
              termKey="topDimShare"
              label="Top coordinate"
              value={`${(r.topDimShare * 100).toFixed(1)}%`}
              hint={`top five ${(r.top5DimShare * 100).toFixed(1)}%`}
              tone={r.topDimShare > 0.2 ? "error" : r.topDimShare > 0.05 ? "warning" : "neutral"}
            />
            <MetricStat
              termKey="angularRange"
              label="Angular range"
              value={`${r.angularRangeDeg.toFixed(1)}°`}
              hint="largest separation available"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricStat
              termKey="meanDirectionNorm"
              label="Mean direction"
              value={r.meanDirectionNorm.toFixed(4)}
              hint={`implies floor ${r.impliedFloor.toFixed(4)} · raw ${r.meanDirectionNormRaw.toFixed(4)}`}
              tone={consistent ? "neutral" : "warning"}
            />
            <MetricStat
              termKey="norms"
              label="Vector norm"
              value={r.meanNorm.toFixed(4)}
              hint={r.apiNormalised ? "provider normalises" : `cv ${r.normCv.toFixed(4)}`}
              tone={r.apiNormalised ? "neutral" : "warning"}
            />
            <MetricStat
              termKey="floorSd"
              label="Floor spread"
              value={cal.shortFloor.sd.toFixed(4)}
              hint={`p05 ${cal.shortFloor.p05.toFixed(3)} · p95 ${cal.shortFloor.p95.toFixed(3)}`}
            />
            <MetricStat
              termKey="coneHalfAngle"
              label="Cone by register"
              value={`${cal.coneByRegister.term.toFixed(0)}° / ${cal.coneByRegister.short.toFixed(0)}° / ${cal.coneByRegister.prose.toFixed(0)}°`}
              hint="terms / declaratives / prose"
            />
          </div>

          <p
            className={cn(
              "font-sans text-caption flex items-start gap-1.5",
              consistent ? "text-muted-foreground" : "text-warning-600"
            )}
          >
            {consistent ? (
              <Check size={12} className="mt-0.5 shrink-0 text-success-600" />
            ) : (
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            )}
            {consistent
              ? `Cone geometry and measured floor agree to within ${floorGap.toFixed(4)}.`
              : `Cone geometry implies a floor of ${r.impliedFloor.toFixed(4)} but the measured floor is ${cal.shortFloor.mean.toFixed(4)}, a gap of ${floorGap.toFixed(4)}. The calibration corpus is less homogeneous than the single-cone model assumes, so read the measured floor rather than the derived one.`}
          </p>

          {!r.apiNormalised && (
            <p className="font-sans text-caption text-warning-600">
              This provider does not return unit vectors. Cosine discards the magnitude
              differences, which carry information the model produced.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

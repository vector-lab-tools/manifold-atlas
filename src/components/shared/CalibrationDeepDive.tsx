"use client";

/**
 * The full calibration record for the models an operation just used,
 * rendered inside that operation's Deep Dive.
 *
 * The headline views show one derived figure each: a position, a band,
 * a colour. This is where the numbers behind those figures live, so a
 * reader can check the derivation rather than take it. Everything the
 * calibration measured is here: the floor for every register with its
 * dispersion, the topical ceiling, the cone per register, the usable
 * range, the dimension statistics against their sample ceiling, and the
 * norm behaviour. Each column header carries its own definition.
 *
 * Two optional extras let an operation add its own calibrated
 * quantities without needing its own version of this table:
 * `measurements` for per-model values that should be shown against the
 * floor, and `notes` for anything the operation wants to say about how
 * calibration entered its particular computation.
 */

import { useCalibration } from "@/context/CalibrationContext";
import { DeepDiveSection } from "@/components/shared/DeepDivePanel";
import { MetricTerm } from "@/components/shared/MetricTerm";
import { CopyableCommand } from "@/components/shared/CopyableCommand";
import {
  floorFor,
  coneFor,
  usableRangeFor,
  REGISTER_LABELS,
  type Register,
  type ModelCalibration,
} from "@/lib/calibration/compute";
import { normalisedPosition, angleDegrees } from "@/lib/calibration/baseline";
import { radiusLine } from "@/lib/calibration/report";
import { rawCosineComparable } from "@/lib/calibration/radius";

export interface CalibratedMeasurement {
  modelId: string;
  label: string;
  cosine: number;
}

interface CalibrationDeepDiveProps {
  /** The kind of text this operation embeds. */
  register: Register;
  /** Models the operation reported on, in display order. */
  modelIds: string[];
  /**
   * Optional per-model cosines from this operation, shown against the
   * floor so the reader can see the rescaling applied to real values
   * rather than only to the corpus.
   */
  measurements?: CalibratedMeasurement[];
  /** Optional lines about how calibration entered this operation. */
  notes?: string[];
}

export function CalibrationDeepDive({
  register,
  modelIds,
  measurements,
  notes,
}: CalibrationDeepDiveProps) {
  const { calibrations } = useCalibration();

  const records = modelIds
    .map(id => calibrations.get(id))
    .filter((c): c is ModelCalibration => Boolean(c));

  const uncalibrated = modelIds.filter(id => !calibrations.has(id));

  if (records.length === 0) {
    return (
      <DeepDiveSection
        title="Calibration"
        tip="No model in this run has a measured baseline, so every cosine above is on the stipulated scale."
      >
        <p className="font-sans text-caption text-warning-600">
          None of the {modelIds.length} model{modelIds.length !== 1 ? "s" : ""} in this run has
          a calibration. Every figure above sits on stipulated bands with no measured origin,
          and figures from different models are not comparable. Run a calibration to replace
          the constants with measurements.
        </p>
      </DeepDiveSection>
    );
  }

  const floors = records.map(c => floorFor(c, register).mean);
  const comparable =
    floors.length < 2 || floors.every(a => floors.every(b => rawCosineComparable(a, b)));

  return (
    <>
      <DeepDiveSection
        title={`Calibration — ${REGISTER_LABELS[register]}`}
        tip={`This operation embeds ${REGISTER_LABELS[register]}, so it is read against that register's floor rather than against the headline figure on the Calibration tab.`}
      >
        {uncalibrated.length > 0 && (
          <p className="font-sans text-caption text-warning-600 mb-2">
            {uncalibrated.length} model{uncalibrated.length !== 1 ? "s" : ""} in this run
            {uncalibrated.length !== 1 ? " have" : " has"} no calibration and
            {uncalibrated.length !== 1 ? " are" : " is"} omitted from this table. Their figures
            above are on the stipulated scale.
          </p>
        )}
        {!comparable && (
          <p className="font-sans text-caption text-warning-600 mb-2">
            These models&apos; floors differ by more than 0.05, so their raw cosines are not the
            same measurement. Compare the{" "}
            <MetricTerm termKey="normalisedPosition">positions</MetricTerm>, not the cosines.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-parchment">
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="floor">floor</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="floorSd">sd</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">p05</th>
                <th className="py-1 pr-3 font-medium text-right">p50</th>
                <th className="py-1 pr-3 font-medium text-right">p95</th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="topicalCeiling">ceiling</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="coneHalfAngle">radius</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="usableRange">range</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="angularRange">arc</MetricTerm>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {records.map(cal => {
                const d = floorFor(cal, register);
                return (
                  <tr key={cal.modelId}>
                    <td className="py-1 pr-3 font-medium">{cal.modelName}</td>
                    <td className="py-1 pr-3 text-right">{d.mean.toFixed(4)}</td>
                    <td className="py-1 pr-3 text-right">{d.sd.toFixed(4)}</td>
                    <td className="py-1 pr-3 text-right">{d.p05.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right">{d.p50.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right">{d.p95.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right">{cal.topicalCeiling.mean.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right">{coneFor(cal, register).toFixed(1)}°</td>
                    <td className="py-1 pr-3 text-right">
                      {usableRangeFor(cal, register).toFixed(4)}
                    </td>
                    <td className="py-1 pr-3 text-right">
                      {angleDegrees(d.mean).toFixed(1)}°
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-[10px] text-muted-foreground mt-1.5">
          n = {floorFor(records[0], register).n} pairs per model. Radius is the half-angle of the
          cone the model actually uses for this register, and arc is the largest angular
          separation two texts of this register can show in it. The arc, not 180°, is the
          denominator any angle above should be read against.
        </p>
      </DeepDiveSection>

      <DeepDiveSection
        title="Radius profile — the shape of the space these numbers were measured in"
        tip="The radius is not one number. These are the properties of the model's output rather than of a register: how many dimensions the variance really uses, whether a single coordinate dominates, and whether the provider returns unit vectors. Read them beside the cone angle, which describes the space as a cap around one mean direction and is only a first-order description."
      >
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-parchment">
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium text-right">dims</th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="effectiveDim">effective</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="effectiveDimCeiling">ceiling</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="dimensionEfficiency">efficiency</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="topDimShare">top dim</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">top 5</th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="norms">norm</MetricTerm>
                </th>
                <th className="py-1 pr-3 font-medium text-right">
                  <MetricTerm termKey="meanDirectionNorm">mean dir</MetricTerm>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {records.map(cal => {
                const r = cal.radius;
                return (
                  <tr key={cal.modelId}>
                    <td className="py-1 pr-3 font-medium">{cal.modelName}</td>
                    <td className="py-1 pr-3 text-right">{r.nominalDim}</td>
                    <td className="py-1 pr-3 text-right">{r.effectiveDim.toFixed(0)}</td>
                    <td className="py-1 pr-3 text-right text-muted-foreground">
                      {r.effectiveDimCeiling.toFixed(0)}
                    </td>
                    <td
                      className={
                        "py-1 pr-3 text-right " +
                        (r.dimensionEfficiency < 0.3 ? "text-warning-600" : "")
                      }
                    >
                      {(r.dimensionEfficiency * 100).toFixed(1)}%
                    </td>
                    <td
                      className={
                        "py-1 pr-3 text-right " + (r.topDimShare > 0.2 ? "text-error-600" : "")
                      }
                    >
                      {(r.topDimShare * 100).toFixed(1)}%
                    </td>
                    <td className="py-1 pr-3 text-right">{(r.top5DimShare * 100).toFixed(1)}%</td>
                    <td
                      className={
                        "py-1 pr-3 text-right " + (r.apiNormalised ? "" : "text-warning-600")
                      }
                    >
                      {r.apiNormalised ? "unit" : r.meanNorm.toFixed(3)}
                    </td>
                    <td className="py-1 pr-3 text-right">{r.meanDirectionNorm.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-[10px] text-muted-foreground mt-1.5">
          Effective dimension is the participation ratio (Σλ)²/Σλ², estimated over the full
          calibration corpus (n = {records[0].radius.spectrumSampleSize}). Read it against the
          ceiling next to it, not against the nominal dimension: a few hundred texts cannot show
          more spread than the ceiling allows however isotropic the model is.
        </p>
      </DeepDiveSection>

      <DeepDiveSection
        title="Floors by register"
        tip="The same models measured on bare terms, short declaratives and prose. The three differ, which is why each operation declares the register it works in."
      >
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-parchment">
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium text-right">terms</th>
                <th className="py-1 pr-3 font-medium text-right">cone</th>
                <th className="py-1 pr-3 font-medium text-right">declaratives</th>
                <th className="py-1 pr-3 font-medium text-right">cone</th>
                <th className="py-1 pr-3 font-medium text-right">prose</th>
                <th className="py-1 pr-3 font-medium text-right">cone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {records.map(cal => (
                <tr key={cal.modelId}>
                  <td className="py-1 pr-3 font-medium">{cal.modelName}</td>
                  <td
                    className={
                      "py-1 pr-3 text-right " + (register === "term" ? "font-bold" : "")
                    }
                  >
                    {cal.termFloor.mean.toFixed(4)}
                  </td>
                  <td className="py-1 pr-3 text-right text-muted-foreground">
                    {coneFor(cal, "term").toFixed(1)}°
                  </td>
                  <td
                    className={
                      "py-1 pr-3 text-right " + (register === "short" ? "font-bold" : "")
                    }
                  >
                    {cal.shortFloor.mean.toFixed(4)}
                  </td>
                  <td className="py-1 pr-3 text-right text-muted-foreground">
                    {coneFor(cal, "short").toFixed(1)}°
                  </td>
                  <td
                    className={
                      "py-1 pr-3 text-right " + (register === "prose" ? "font-bold" : "")
                    }
                  >
                    {cal.proseFloor.mean.toFixed(4)}
                  </td>
                  <td className="py-1 pr-3 text-right text-muted-foreground">
                    {coneFor(cal, "prose").toFixed(1)}°
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-[10px] text-muted-foreground mt-1.5">
          The column this operation uses is in bold. The radius differs by register in the same
          model, which is why a figure taken on bare terms cannot be quoted against a floor
          measured on sentences.
        </p>
      </DeepDiveSection>

      {measurements && measurements.length > 0 && (
        <DeepDiveSection
          title="This run, rescaled"
          tip="The operation's own cosines converted to floor-to-identity positions and to standard deviations above the floor, so the rescaling can be checked against real values."
        >
          <div className="overflow-x-auto">
            <table className="w-full font-sans text-caption tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-parchment">
                  <th className="py-1 pr-3 font-medium">Measurement</th>
                  <th className="py-1 pr-3 font-medium">Model</th>
                  <th className="py-1 pr-3 font-medium text-right">cosine</th>
                  <th className="py-1 pr-3 font-medium text-right">
                    <MetricTerm termKey="normalisedPosition">position</MetricTerm>
                  </th>
                  <th className="py-1 pr-3 font-medium text-right">
                    <MetricTerm termKey="floorZ">z</MetricTerm>
                  </th>
                  <th className="py-1 pr-3 font-medium text-right">arc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment">
                {measurements.map((mm, i) => {
                  const cal = calibrations.get(mm.modelId);
                  const d = cal ? floorFor(cal, register) : null;
                  return (
                    <tr key={`${mm.modelId}-${i}`}>
                      <td className="py-1 pr-3">{mm.label}</td>
                      <td className="py-1 pr-3 text-muted-foreground">
                        {cal?.modelName ?? mm.modelId}
                      </td>
                      <td className="py-1 pr-3 text-right">{mm.cosine.toFixed(4)}</td>
                      <td className="py-1 pr-3 text-right">
                        {d ? `${(normalisedPosition(mm.cosine, d.mean) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {d && d.sd > 1e-9 ? ((mm.cosine - d.mean) / d.sd).toFixed(1) : "—"}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {angleDegrees(mm.cosine).toFixed(1)}°
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DeepDiveSection>
      )}

      {notes && notes.length > 0 && (
        <DeepDiveSection
          title="How calibration enters this operation"
          tip="What the rescaling does and does not change for this particular computation."
        >
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="font-sans text-caption text-slate">
                {n}
              </li>
            ))}
          </ul>
        </DeepDiveSection>
      )}

      <DeepDiveSection
        title="Reporting lines"
        tip="Paste alongside any figure taken from this run. The line names the radius, the floor and the ceiling, so a cosine quoted from here arrives with the scale it was measured on rather than as a bare number."
      >
        <div className="space-y-1">
          {records.map(cal => (
            <CopyableCommand key={cal.modelId} command={radiusLine(cal, register)} />
          ))}
        </div>
      </DeepDiveSection>
    </>
  );
}

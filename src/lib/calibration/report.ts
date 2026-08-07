/**
 * Reporting lines for calibrated results.
 *
 * A cosine quoted on a slide needs the scale it was measured on, or the
 * first question from the floor is where the number sits relative to
 * anything else. These functions produce the accompanying sentence from
 * the measurement rather than leaving it to be written by hand.
 */

import type { ModelCalibration } from "./compute";
import { describeRadius } from "./radius";
import type { NegationGaugeModelResult } from "@/lib/operations/negation-gauge";
import { CONTROL_LABELS } from "@/lib/operations/negation-controls";

/** The radius line: what kind of space this measurement was taken in. */
export function radiusLine(cal: ModelCalibration): string {
  return `${cal.modelName} (${cal.providerId}): ${describeRadius(cal.radius, cal.shortFloor.mean)}`;
}

/**
 * The result line. One sentence carrying the measurement, the floor it
 * sits above, the control it is being compared against, and the verdict.
 */
export function negationReportLine(m: NegationGaugeModelResult): string {
  const parts: string[] = [];
  parts.push(`${m.modelName}: cosine ${m.cosineSimilarity.toFixed(4)}.`);

  if (m.calibrated && m.floorMean !== null && m.normalised !== null) {
    parts.push(
      `Random-pair floor for this model, ${m.floorMean.toFixed(4)}` +
        (m.floorSd !== null ? ` (sd ${m.floorSd.toFixed(4)})` : "") + `.`
    );
    if (m.topicalCeiling !== null) {
      parts.push(`Topical ceiling, ${m.topicalCeiling.toFixed(4)}.`);
    }
    parts.push(
      `The negation sits ${(m.normalised * 100).toFixed(1)}% of the way from floor to identity.`
    );
    if (m.coneHalfAngleDeg !== null) {
      parts.push(`Cone half-angle ${m.coneHalfAngleDeg.toFixed(1)}°.`);
    }
  } else {
    parts.push(`No calibration for this model, so the cosine has no measured scale.`);
  }

  const structural = m.controls.filter(
    c => c.control.kind === "insertedModifier" || c.control.kind === "matchedEdit"
  );
  if (structural.length > 0) {
    let top = structural[0];
    for (const c of structural) if (c.cosine > top.cosine) top = c;
    parts.push(
      `Highest same-size non-reversing edit, "${top.control.text}", ${top.cosine.toFixed(4)}.`
    );
    parts.push(
      m.exceedsControls
        ? `The negation is closer than every edit of the same size that does not reverse the claim.`
        : `The negation is not closer than the matched controls, so the result is within what token overlap explains.`
    );
  }

  const antonym = m.controls.find(c => c.control.kind === "antonym");
  if (antonym) {
    parts.push(
      `Lexical antonym, "${antonym.control.text}", ${antonym.cosine.toFixed(4)}.`
    );
  }

  return parts.join(" ");
}

/** Full plain-text block for one model, suitable for pasting into notes. */
export function negationReportBlock(
  m: NegationGaugeModelResult,
  statement: string,
  negated: string
): string {
  const lines: string[] = [];
  lines.push(`"${statement}"  ·  ${m.modelName} (${m.dimensions}d)`);
  lines.push("");

  if (m.calibrated && m.floorMean !== null) {
    lines.push(
      `  floor    ${fmt(m.floorMean)}` +
        (m.floorSd !== null ? `  sd ${fmt(m.floorSd)}` : "")
    );
    if (m.topicalCeiling !== null) lines.push(`  ceiling  ${fmt(m.topicalCeiling)}`);
    if (m.coneHalfAngleDeg !== null && m.usableRange !== null) {
      lines.push(
        `  radius   cone ${m.coneHalfAngleDeg.toFixed(1)}°, usable range ${fmt(m.usableRange)}`
      );
    }
    lines.push("");
  } else {
    lines.push(`  uncalibrated — cosines below have no measured scale`);
    lines.push("");
  }

  const rows: Array<[string, string, number, number | null]> = [
    ["Negation", truncate(negated, 34), m.cosineSimilarity, m.normalised],
    ...m.controls.map(
      c =>
        [
          CONTROL_LABELS[c.control.kind],
          truncate(c.control.text, 34),
          c.cosine,
          c.normalised,
        ] as [string, string, number, number | null]
    ),
  ];

  for (const [label, text, cos, norm] of rows) {
    lines.push(
      `  ${label.padEnd(19)}${text.padEnd(36)}${fmt(cos)}` +
        (norm !== null ? `   ${(norm * 100).toFixed(0)}%` : "")
    );
  }

  lines.push("");
  lines.push(`  threshold: ${m.threshold.basis}`);
  if (m.exceedsControls !== null) {
    lines.push(
      m.exceedsControls
        ? `  Negation exceeds every non-negating control of equal edit size.`
        : `  Negation does not exceed the matched controls.`
    );
  }
  return lines.join("\n");
}

function fmt(v: number): string {
  return v.toFixed(4);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

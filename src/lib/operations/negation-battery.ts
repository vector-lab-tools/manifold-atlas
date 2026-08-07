/**
 * Negation Battery — pure compute.
 *
 * Runs a set of negation tests in one pass. For each statement, the
 * module auto-generates the negation (or uses a caller-supplied one),
 * embeds both, and measures cosine similarity across all enabled models.
 *
 * Pre-built batteries are exported as NEGATION_BATTERIES so that both
 * the component UI and protocol definitions can reference them by name.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import { DEFAULT_NEGATION_THRESHOLD } from "@/lib/operations/negation-gauge";
import { resolveUserBattery } from "@/lib/operations/user-batteries";
import {
  buildProbeFamily,
  probeFamilyTextList,
  type ProbeFamily,
} from "@/lib/operations/negation-controls";
import type { ModelCalibration } from "@/lib/calibration/compute";
import { floorFor } from "@/lib/calibration/compute";
import { normalisedPosition } from "@/lib/calibration/baseline";
import {
  resolveThreshold,
  structuralControls,
  DEFAULT_THRESHOLD_MODE,
  type ThresholdMode,
} from "@/lib/calibration/threshold";

export const NEGATION_BATTERIES: Record<string, string[]> = {
  "Political claims": [
    "Democracy is the best form of government",
    "Free speech should have limits",
    "Immigration strengthens the economy",
    "War can be justified",
    "Taxation is fair",
    "The state should provide healthcare",
    "Protest is effective",
    "Borders are necessary",
    "Nationalism is dangerous",
    "Revolution is sometimes necessary",
  ],
  "Ethical statements": [
    "Lying is wrong",
    "Killing is never justified",
    "Privacy is a right",
    "Equality matters more than freedom",
    "Animals have rights",
    "The ends justify the means",
    "Forgiveness is a virtue",
    "Punishment deters crime",
    "Charity is a moral obligation",
    "Suffering has meaning",
  ],
  "Factual assertions": [
    "The earth is round",
    "Vaccines are safe",
    "Climate change is caused by humans",
    "Evolution is a fact",
    "The universe is expanding",
    "Consciousness is produced by the brain",
    "Free will exists",
    "Mathematics is discovered not invented",
    "Time is real",
    "Language shapes thought",
  ],
  "Epistemological claims": [
    "Knowledge requires justification",
    "Objective truth exists",
    "Science is the best way to know the world",
    "Intuition is a valid source of knowledge",
    "History is written by the victors",
    "All knowledge is situated",
    "Reason is universal",
    "Experience is more important than theory",
    "Certainty is possible",
    "Perception is reliable",
  ],
  "Economic claims": [
    "Free markets efficiently allocate resources",
    "Minimum wage laws reduce employment",
    "Economic growth requires inequality",
    "Inflation is caused by expanding the money supply",
    "Capitalism has lifted billions out of poverty",
    "Private property is the foundation of prosperity",
    "Public spending crowds out private investment",
    "Trade deficits weaken an economy",
    "Globalisation benefits everyone",
    "Central bank independence is essential",
  ],
  "Aesthetic claims": [
    "Beauty is in the eye of the beholder",
    "Great art is universal",
    "Aesthetic value is objective",
    "Popular art is inferior to high art",
    "Technique matters more than expression",
    "All representation is political",
    "Form follows function",
    "Originality is the mark of genuine art",
    "Art should be useful",
    "The artist's intention determines meaning",
  ],
  "Technology claims": [
    "Artificial intelligence is a form of reasoning",
    "Algorithms are neutral",
    "Technology makes society more democratic",
    "Social media connects people",
    "Data speaks for itself",
    "Automation creates more jobs than it destroys",
    "The internet is decentralised",
    "Machines can be creative",
    "Code is law",
    "Surveillance keeps us safe",
  ],
};

export interface NegationBatteryInputs {
  /** Resolved list of statements to test. */
  statements: string[];
  /**
   * Optional pre-generated negations (one per statement). If omitted,
   * the rule-based generator is used for each.
   */
  negations?: string[];
  threshold?: number;
  /**
   * Measure the control family alongside each negation. Adds roughly
   * six texts per statement to the embedding cost, and is what makes
   * the collapse rate mean anything: without controls the rate is a
   * count of how many pairs cleared a stipulated constant.
   */
  withControls?: boolean;
  thresholdMode?: ThresholdMode;
}

export interface NegationBatteryModelResult {
  modelId: string;
  modelName: string;
  similarity: number;
  collapsed: boolean;
  /** Position on this model's floor-to-identity range. Null when uncalibrated. */
  normalised: number | null;
  /** Highest same-size non-reversing edit for this statement. Null without controls. */
  controlCeiling: number | null;
  /** Negation at least as close as every same-size control. Null without controls. */
  exceedsControls: boolean | null;
  /** The cutoff actually applied, after any fallback. */
  thresholdValue: number;
  /** How that cutoff was derived. */
  thresholdBasis: string;
}

export interface NegationBatteryStatementResult {
  statement: string;
  negated: string;
  models: NegationBatteryModelResult[];
}

export interface NegationBatteryResult {
  threshold: number;
  thresholdMode: ThresholdMode;
  withControls: boolean;
  statements: NegationBatteryStatementResult[];
  summary: {
    totalStatements: number;
    totalTests: number;
    totalCollapsed: number;
    collapseRate: number;      // 0..1
    avgSimilarity: number;
    /** Mean floor-to-identity position, over calibrated models only. */
    avgNormalised: number | null;
    /** Tests where the negation beat every same-size control. */
    exceedingControls: number;
    /** Tests where that comparison was available at all. */
    controlledTests: number;
  };
}

/**
 * Look up a battery preset by its canonical name. Checks the built-in
 * NEGATION_BATTERIES first, then falls through to user-defined
 * batteries stored in localStorage. Returns null if not found.
 */
export function resolveNegationBatteryPreset(
  name: string | undefined
): string[] | null {
  if (!name) return null;
  if (name in NEGATION_BATTERIES) return NEGATION_BATTERIES[name];
  return resolveUserBattery(name);
}

/**
 * Probe families for a battery, with the offset of each family in the
 * flat text list. Both the collector and the executor derive their
 * layout from this, so the two cannot drift apart.
 *
 * Families are variable length: a statement with no locatable copula
 * yields fewer controls than one in subject-copula-predicate form, so
 * the offsets cannot be computed from a fixed stride.
 */
interface BatteryLayout {
  families: ProbeFamily[];
  offsets: number[];
  texts: string[];
}

function batteryLayout(inputs: NegationBatteryInputs): BatteryLayout {
  const withControls = inputs.withControls !== false;
  const families: ProbeFamily[] = inputs.statements.map((s, i) =>
    buildProbeFamily(s, { negation: inputs.negations?.[i] })
  );

  const offsets: number[] = [];
  const texts: string[] = [];
  for (const family of families) {
    offsets.push(texts.length);
    const slice = withControls
      ? probeFamilyTextList(family)
      : [family.statement, family.negation.text];
    texts.push(...slice);
  }
  return { families, offsets, texts };
}

/** Flat text list for batched embedding. */
export function negationBatteryTextList(inputs: NegationBatteryInputs): string[] {
  return batteryLayout(inputs).texts;
}

export function computeNegationBattery(
  inputs: NegationBatteryInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>,
  calibrations?: Map<string, ModelCalibration>
): NegationBatteryResult {
  const fixedThreshold = inputs.threshold ?? DEFAULT_NEGATION_THRESHOLD;
  const mode = inputs.thresholdMode ?? DEFAULT_THRESHOLD_MODE;
  const withControls = inputs.withControls !== false;
  const { families, offsets } = batteryLayout(inputs);

  const statements: NegationBatteryStatementResult[] = families.map((family, i) => {
    const base = offsets[i];
    const activeControls = withControls ? family.controls : [];

    const models: NegationBatteryModelResult[] = enabledModels
      .filter(m => modelVectors.has(m.id))
      .map(m => {
        const vectors = modelVectors.get(m.id)!;
        const cal = calibrations?.get(m.id) ?? null;
        const floor = cal ? floorFor(cal, "short") : null;

        const sim = cosineSimilarity(vectors[base], vectors[base + 1]);

        const measured = activeControls
          .map((control, k) => {
            const vec = vectors[base + 2 + k];
            if (!vec) return null;
            const cosine = cosineSimilarity(vectors[base], vec);
            return {
              control,
              cosine,
              normalised: floor ? normalisedPosition(cosine, floor.mean) : null,
              z: null,
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        const threshold = resolveThreshold({
          mode,
          fixedValue: fixedThreshold,
          calibration: cal,
          register: "short",
          controls: measured,
        });

        const structural = structuralControls(measured);
        const controlCeiling =
          structural.length > 0 ? Math.max(...structural.map(c => c.cosine)) : null;

        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          similarity: sim,
          collapsed: sim >= threshold.value,
          normalised: floor ? normalisedPosition(sim, floor.mean) : null,
          controlCeiling,
          exceedsControls: controlCeiling !== null ? sim >= controlCeiling : null,
          thresholdValue: threshold.value,
          thresholdBasis: threshold.basis,
        };
      });

    return { statement: family.statement, negated: family.negation.text, models };
  });

  // Summary stats
  let totalTests = 0;
  let totalCollapsed = 0;
  let perStatementAvgSum = 0;
  let normSum = 0;
  let normCount = 0;
  let exceedingControls = 0;
  let controlledTests = 0;

  for (const row of statements) {
    if (row.models.length === 0) continue;
    totalTests += row.models.length;
    for (const m of row.models) {
      if (m.collapsed) totalCollapsed += 1;
      if (m.normalised !== null) {
        normSum += m.normalised;
        normCount += 1;
      }
      if (m.exceedsControls !== null) {
        controlledTests += 1;
        if (m.exceedsControls) exceedingControls += 1;
      }
    }
    perStatementAvgSum +=
      row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
  }

  const collapseRate = totalTests > 0 ? totalCollapsed / totalTests : 0;
  const avgSimilarity =
    statements.length > 0 ? perStatementAvgSum / statements.length : 0;

  return {
    threshold: fixedThreshold,
    thresholdMode: mode,
    withControls,
    statements,
    summary: {
      totalStatements: statements.length,
      totalTests,
      totalCollapsed,
      collapseRate,
      avgSimilarity,
      avgNormalised: normCount > 0 ? normSum / normCount : null,
      exceedingControls,
      controlledTests,
    },
  };
}

export function negationBatteryHeadline(
  result: NegationBatteryResult
): Record<string, number | string> {
  const s = result.summary;
  const out: Record<string, number | string> = {
    statements: s.totalStatements,
    "collapse rate": `${(s.collapseRate * 100).toFixed(1)}%`,
    "avg cosine": Number(s.avgSimilarity.toFixed(4)),
    "collapsed / total": `${s.totalCollapsed} / ${s.totalTests}`,
    "threshold mode": result.thresholdMode,
  };

  if (s.avgNormalised !== null) {
    out["avg position floor→identity"] = Number(s.avgNormalised.toFixed(4));
  } else {
    out["calibration"] = "none — cosines have no measured scale";
  }

  if (s.controlledTests > 0) {
    out["exceeds same-size controls"] = `${s.exceedingControls} / ${s.controlledTests}`;
  }

  return out;
}

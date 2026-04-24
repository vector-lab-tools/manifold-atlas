/**
 * Grammar Probe Bundle — v1 importer.
 *
 * Parses, validates, and converts LLMbench Grammar Probe bundles
 * (`application/vnd.vector-lab.grammar-probe+json`, extension
 * `.grammar.json`) into Grammar-of-Vectors instances so Atlas can embed
 * the X fragment and every top-K Y token against a common X and report
 * cosine similarity per model.
 *
 * The headline research finding this module exists to compute is the
 * Spearman rank correlation between **logprob rank** (as reported by
 * the producing LLM) and **cosine-to-X rank** (as computed by the
 * embedding model Atlas is using). A high positive correlation means
 * the grammatical construction has collapsed into a geometric reflex:
 * the LLM reaches for Ys that are close to X in embedding space. A low
 * or negative correlation means the construction is doing rhetorical
 * work beyond nearest-neighbour retrieval.
 *
 * Spec: `GRAMMAR-PROBE-BUNDLE.md` in vector-lab-design.
 */

import type { GrammarInstance, GrammarPairResult } from "./grammar-of-vectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrammarProbeBundle {
  format: string;
  createdAt: string;
  source: {
    tool: string;
    version: string;
    phase?: string;
  };
  pattern: {
    id: string;
    label: string;
    category?: string;
    note?: string;
  };
  model: {
    provider: string;
    name: string;
    displayName?: string;
  };
  parameters: {
    temperature: number;
    topK: number;
    maxTokens: number;
    noMarkdown?: boolean;
  };
  probes: BundleProbe[];
}

export interface BundleProbe {
  scaffoldId: string;
  scaffold: string;
  x: string;
  xCategory?: string;
  chosen: { token: string; logprob: number } | null;
  ys: Array<{ token: string; logprob: number; rank: number }>;
  provenance?: Record<string, unknown>;
}

export interface BundleParseSuccess {
  ok: true;
  bundle: GrammarProbeBundle;
  warnings: string[];
}

export interface BundleParseFailure {
  ok: false;
  error: string;
}

export type BundleParseResult = BundleParseSuccess | BundleParseFailure;

// ---------------------------------------------------------------------------
// Validation / parsing
// ---------------------------------------------------------------------------

const FORMAT_PREFIX = "vector-lab.grammar-probe.";
const SUPPORTED_MAJOR = "v1";

/**
 * Parse a text blob (JSON) into a bundle. Performs shape validation and
 * version negotiation. Returns `{ ok: false, error }` on anything that
 * would make downstream Atlas code blow up.
 */
export function parseBundle(text: string): BundleParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `File is not valid JSON: ${(e as Error).message}` };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: "Bundle root must be a JSON object." };
  }
  const warnings: string[] = [];

  const format = raw.format;
  if (typeof format !== "string") {
    return { ok: false, error: "Missing required field: format." };
  }
  if (!format.startsWith(FORMAT_PREFIX)) {
    return {
      ok: false,
      error: `Unrecognised bundle format "${format}". Expected one starting with "${FORMAT_PREFIX}".`,
    };
  }
  const majorSuffix = format.slice(FORMAT_PREFIX.length);
  if (majorSuffix !== SUPPORTED_MAJOR) {
    // Different major — refuse per spec.
    return {
      ok: false,
      error: `Unsupported bundle major version "${majorSuffix}". This build supports "${SUPPORTED_MAJOR}" only.`,
    };
  }

  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
  if (!createdAt) warnings.push("createdAt is missing; provenance will be incomplete.");

  const source = isRecord(raw.source) ? raw.source : null;
  if (!source || typeof source.tool !== "string" || typeof source.version !== "string") {
    return { ok: false, error: "source.tool and source.version are required strings." };
  }

  const pattern = isRecord(raw.pattern) ? raw.pattern : null;
  if (!pattern || typeof pattern.id !== "string" || typeof pattern.label !== "string") {
    return { ok: false, error: "pattern.id and pattern.label are required strings." };
  }

  const model = isRecord(raw.model) ? raw.model : null;
  if (!model || typeof model.provider !== "string" || typeof model.name !== "string") {
    return { ok: false, error: "model.provider and model.name are required strings." };
  }

  const parameters = isRecord(raw.parameters) ? raw.parameters : null;
  if (!parameters) {
    return { ok: false, error: "parameters object is required." };
  }

  const probesRaw = raw.probes;
  if (!Array.isArray(probesRaw) || probesRaw.length === 0) {
    return { ok: false, error: "probes must be a non-empty array." };
  }

  const probes: BundleProbe[] = [];
  let skippedEmpty = 0;
  let skippedMalformed = 0;
  // Collect unique per-probe `error` strings. Phase B bundles and
  // provider-failure retries put the actual cause of an empty ys here,
  // which is far more useful than "empty ys" on its own.
  const probeErrors = new Map<string, number>();
  for (let i = 0; i < probesRaw.length; i++) {
    const p = probesRaw[i];
    if (!isRecord(p)) {
      skippedMalformed++;
      continue;
    }
    if (typeof p.scaffoldId !== "string" || typeof p.scaffold !== "string" || typeof p.x !== "string") {
      skippedMalformed++;
      continue;
    }
    const chosen =
      isRecord(p.chosen) && typeof p.chosen.token === "string" && typeof p.chosen.logprob === "number"
        ? { token: p.chosen.token, logprob: p.chosen.logprob }
        : null;
    // Some producers (OpenAI when logprobs are suppressed for safety,
    // rate-limit retries, partial runs) yield probes with no ys. Treat
    // these as best-effort — keep them out of the run and warn, but
    // don't fail the whole import.
    if (!Array.isArray(p.ys) || p.ys.length === 0) {
      skippedEmpty++;
      if (typeof p.error === "string" && p.error.trim()) {
        const msg = p.error.trim();
        probeErrors.set(msg, (probeErrors.get(msg) ?? 0) + 1);
      }
      continue;
    }
    const ys: BundleProbe["ys"] = [];
    let yMalformed = false;
    for (let j = 0; j < p.ys.length; j++) {
      const y = p.ys[j];
      if (!isRecord(y) || typeof y.token !== "string" || typeof y.logprob !== "number") {
        yMalformed = true;
        break;
      }
      // Rank is per-spec required but infer from position as a
      // resilience measure — producers occasionally forget to set it.
      const rank = typeof y.rank === "number" ? y.rank : j + 1;
      ys.push({ token: y.token, logprob: y.logprob, rank });
    }
    if (yMalformed || ys.length === 0) {
      skippedMalformed++;
      continue;
    }
    probes.push({
      scaffoldId: p.scaffoldId,
      scaffold: p.scaffold,
      x: p.x,
      xCategory: typeof p.xCategory === "string" ? p.xCategory : undefined,
      chosen,
      ys,
      provenance: isRecord(p.provenance) ? (p.provenance as Record<string, unknown>) : undefined,
    });
  }

  const errorDigest = summariseProbeErrors(probeErrors);
  if (probes.length === 0) {
    const parts = [
      `No usable probes in bundle.`,
      `${skippedEmpty} probe${skippedEmpty === 1 ? "" : "s"} had empty ys arrays; ${skippedMalformed} were malformed.`,
    ];
    if (errorDigest) parts.push(`Producer reported: ${errorDigest}`);
    // Hint at the most common cause: a provider that doesn't expose
    // logprobs (OpenRouter, Anthropic) was used on the LLMbench side.
    parts.push(
      `Re-run the probe on LLMbench with a provider that returns logprobs (OpenAI, OpenAI-compatible, or Google Gemini).`
    );
    return { ok: false, error: parts.join(" ") };
  }
  if (skippedEmpty > 0) {
    const base = `Skipped ${skippedEmpty} probe${skippedEmpty === 1 ? "" : "s"} with empty ys arrays (no logprob distribution returned by the producing API)`;
    warnings.push(errorDigest ? `${base} — ${errorDigest}` : `${base}.`);
  }
  if (skippedMalformed > 0) {
    warnings.push(
      `Skipped ${skippedMalformed} malformed probe${skippedMalformed === 1 ? "" : "s"} (missing scaffoldId / scaffold / x, or malformed ys entries).`
    );
  }

  const bundle: GrammarProbeBundle = {
    format,
    createdAt,
    source: {
      tool: source.tool,
      version: source.version,
      phase: typeof source.phase === "string" ? source.phase : undefined,
    },
    pattern: {
      id: pattern.id,
      label: pattern.label,
      category: typeof pattern.category === "string" ? pattern.category : undefined,
      note: typeof pattern.note === "string" ? pattern.note : undefined,
    },
    model: {
      provider: model.provider,
      name: model.name,
      displayName: typeof model.displayName === "string" ? model.displayName : undefined,
    },
    parameters: {
      temperature: typeof parameters.temperature === "number" ? parameters.temperature : 0,
      topK: typeof parameters.topK === "number" ? parameters.topK : ys0(probes),
      maxTokens: typeof parameters.maxTokens === "number" ? parameters.maxTokens : 1,
      noMarkdown: typeof parameters.noMarkdown === "boolean" ? parameters.noMarkdown : undefined,
    },
    probes,
  };

  return { ok: true, bundle, warnings };
}

function ys0(probes: BundleProbe[]): number {
  return probes[0]?.ys.length ?? 0;
}

/**
 * Produce a short human-readable digest of per-probe producer errors.
 * Groups repeated messages ("5× error message") so a 20-probe bundle
 * with one recurring producer failure doesn't swamp the UI.
 */
function summariseProbeErrors(errs: Map<string, number>): string {
  if (errs.size === 0) return "";
  const parts: string[] = [];
  for (const [msg, count] of errs) {
    parts.push(count > 1 ? `${count}× "${msg}"` : `"${msg}"`);
  }
  return parts.join("; ");
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

// ---------------------------------------------------------------------------
// Instance conversion
// ---------------------------------------------------------------------------

/**
 * Flatten a bundle into one GrammarInstance per (probe × y-token). The
 * scaffoldId and logprob rank are preserved on `probeMeta` so Spearman
 * correlation can be computed after the embeddings come back.
 *
 * Raw form shown in the preview is `"x | y"` because the pipe form maps
 * cleanly onto the generic grammar parser and makes the X/Y structure
 * visible in tooltips and CSV output.
 */
export function bundleToInstances(bundle: GrammarProbeBundle): GrammarInstance[] {
  const out: GrammarInstance[] = [];
  for (const probe of bundle.probes) {
    for (const y of probe.ys) {
      const yToken = y.token.trim();
      if (!yToken) continue;
      out.push({
        raw: `${probe.x} | ${yToken}`,
        parts: [probe.x, yToken],
        source: `${bundle.source.tool} ${bundle.pattern.id} / ${probe.scaffoldId}`,
        probeMeta: {
          scaffoldId: probe.scaffoldId,
          scaffold: probe.scaffold,
          logprobRank: y.rank,
          logprob: y.logprob,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spearman correlation & bundle findings
// ---------------------------------------------------------------------------

/**
 * Compute Spearman's rho for two equal-length rank vectors. Handles
 * ties by the mid-rank (average-rank) convention. Returns 0 when n < 2
 * or when either vector has zero variance.
 */
export function spearmanCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n !== ys.length || n < 2) return 0;
  const rx = rankWithTies(xs);
  const ry = rankWithTies(ys);
  return pearson(rx, ry);
}

function rankWithTies(xs: number[]): number[] {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    // Average rank across tie band (1-based).
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return num / denom;
}

export interface BundleProbeFinding {
  scaffoldId: string;
  scaffold: string;
  x: string;
  n: number;
  /**
   * Spearman correlation between logprob rank (ascending: rank 1 = most
   * probable) and cosine-to-X rank (ascending: rank 1 = closest). A
   * large positive correlation means the LLM's top choices are also
   * the embedding model's nearest neighbours of X — the construction
   * is collapsing into a geometric reflex.
   */
  spearmanPerModel: Array<{ modelId: string; modelName: string; rho: number }>;
  /** Mean rho across enabled models. */
  meanRho: number;
}

export interface BundleFindings {
  perProbe: BundleProbeFinding[];
  /** Mean of per-probe meanRho values. */
  overallMeanRho: number;
  /** Count of probes with rho >= 0.5 (clear geometric reflex). */
  reflexCount: number;
  /** Count of probes with rho between -0.2 and 0.2 (rhetoric outruns geometry). */
  rhetoricalCount: number;
  /** Count of probes with rho <= -0.5 (construction actively inverts). */
  invertedCount: number;
  /** Total probes considered. */
  totalProbes: number;
}

/**
 * Group pair results back into probes via `probeMeta.scaffoldId`, then
 * compute Spearman rho per probe per model between logprob rank and
 * cosine-to-X rank. Pairs without probeMeta are ignored.
 */
export function computeBundleFindings(
  pairs: GrammarPairResult[]
): BundleFindings {
  // Group by scaffold id.
  const groups = new Map<string, GrammarPairResult[]>();
  for (const p of pairs) {
    const meta = p.instance.probeMeta;
    if (!meta) continue;
    const arr = groups.get(meta.scaffoldId) ?? [];
    arr.push(p);
    groups.set(meta.scaffoldId, arr);
  }

  const perProbe: BundleProbeFinding[] = [];
  for (const [scaffoldId, probePairs] of groups) {
    if (probePairs.length < 2) {
      // Spearman undefined with one point; skip.
      continue;
    }
    const sample = probePairs[0].instance;
    const modelIds = probePairs[0].models.map(m => ({ id: m.modelId, name: m.modelName }));

    const logprobRanks = probePairs.map(p => p.instance.probeMeta!.logprobRank);

    const spearmanPerModel = modelIds.map(({ id, name }) => {
      const cosines = probePairs.map(p => {
        const mm = p.models.find(m => m.modelId === id);
        return mm ? mm.cosineSimilarity : 0;
      });
      // Convert cosines → rank where rank 1 = closest (highest cosine).
      // rankWithTies returns ascending rank; invert via (n + 1 - rank) so
      // higher cosine ⇒ lower rank number, matching logprob convention.
      const ascending = rankWithTies(cosines);
      const n = cosines.length;
      const cosineRanks = ascending.map(r => n + 1 - r);
      const rho = spearmanCorrelation(logprobRanks, cosineRanks);
      return { modelId: id, modelName: name, rho };
    });

    const meanRho =
      spearmanPerModel.reduce((s, m) => s + m.rho, 0) /
      Math.max(1, spearmanPerModel.length);

    perProbe.push({
      scaffoldId,
      scaffold: sample.probeMeta?.scaffold ?? "",
      x: sample.parts[0],
      n: probePairs.length,
      spearmanPerModel,
      meanRho,
    });
  }

  const overallMeanRho =
    perProbe.length === 0
      ? 0
      : perProbe.reduce((s, p) => s + p.meanRho, 0) / perProbe.length;

  let reflex = 0;
  let rhetorical = 0;
  let inverted = 0;
  for (const p of perProbe) {
    if (p.meanRho >= 0.5) reflex++;
    else if (p.meanRho <= -0.5) inverted++;
    else if (Math.abs(p.meanRho) < 0.2) rhetorical++;
  }

  return {
    perProbe,
    overallMeanRho,
    reflexCount: reflex,
    rhetoricalCount: rhetorical,
    invertedCount: inverted,
    totalProbes: perProbe.length,
  };
}

/**
 * Grammar of Vectors — pure compute.
 *
 * Maps discursive quirks of LLM text generation by embedding the
 * rhetorically-opposed fragments of a construction (e.g. "not X but Y")
 * and measuring cosine(X, Y). When the rhetoric of opposition is
 * performed over a geometry of proximity, the cosine sits at or above
 * the threshold — pseudo-dialectic.
 *
 * Architecture: grammars are declarative data. Each GRAMMAR has an id,
 * a human label, a short description, a parser for extracting the
 * X and Y fragments from pasted text, and a library of register
 * batteries (curated instances of the pattern in different prose
 * registers). Adding a new grammar is a data edit — no engineering
 * beyond the parser and a handful of sentences.
 *
 * Launch set (v1.2.0):
 *   - not-x-but-y              "not a problem, but an opportunity"
 *   - not-just-x-but-y         "not just helpful, but empowering"
 *
 * Subsequent patches will add: it's not X it's Y, while X Y,
 * X — Y em-dash, not A not B but C tricolon (different math, 3-part).
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrammarInstance {
  /** The full construction as written, for display and export. */
  raw: string;
  /** Extracted fragments: [X, Y] for 2-part constructions. */
  parts: [string, string];
  /** Optional label for the source or author. */
  source?: string;
}

export interface Grammar {
  id: string;
  name: string;
  /** One-line description of what the construction performs. */
  description: string;
  /** Canonical example for the UI. */
  example: string;
  /**
   * Parser that takes a free-form pasted line and tries to extract the
   * X and Y fragments. Returns null if the line doesn't match.
   */
  parse(line: string): GrammarInstance | null;
  /** Register → instances. Register names are display strings. */
  registers: Record<string, GrammarInstance[]>;
}

export interface GrammarOfVectorsInputs {
  /** Which grammar (construction) is being tested. */
  grammarId: string;
  /** Which preset register to use, or undefined when using `instances`. */
  register?: string;
  /**
   * Explicit list of instances to test. Overrides register lookup when
   * present. Used for custom user input and for URL-parameter deep
   * links from LLMbench Grammar Probe.
   */
  instances?: GrammarInstance[];
  /**
   * Threshold above which a pair counts as pseudo-dialectic. Below =
   * genuine opposition preserved in the geometry.
   */
  threshold?: number;
}

export interface GrammarPairModelResult {
  modelId: string;
  modelName: string;
  cosineSimilarity: number;
  /** True if cosine < threshold — opposition is preserved. */
  oppositionPreserved: boolean;
}

export interface GrammarPairResult {
  instance: GrammarInstance;
  models: GrammarPairModelResult[];
}

export interface GrammarOfVectorsResult {
  grammarId: string;
  grammarName: string;
  register?: string;
  threshold: number;
  pairs: GrammarPairResult[];
  summary: {
    totalPairs: number;
    totalTests: number;
    preservedCount: number;
    preservedRate: number;
    avgSimilarity: number;
    /** The pair with the highest (most geometrically deceptive) cosine. */
    mostDeceptive: {
      raw: string;
      cosine: number;
      modelName: string;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Normalise whitespace and strip surrounding quotes/punctuation while
 * preserving intent. Keeps the fragments clean for embedding.
 */
function cleanFragment(s: string): string {
  return s
    .trim()
    .replace(/^[\s"'`]+|[\s"'`.,;:!?]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Accept either `X | Y` pipe-delimited pairs or prose constructions
 * matching the grammar's regex. Returns null on no match.
 */
function parsePipeOrRegex(line: string, regex: RegExp): GrammarInstance | null {
  // Pipe form: "X | Y"
  const pipeIdx = line.indexOf("|");
  if (pipeIdx > 0) {
    const x = cleanFragment(line.slice(0, pipeIdx));
    const y = cleanFragment(line.slice(pipeIdx + 1));
    if (x && y) return { raw: line.trim(), parts: [x, y] };
  }

  // Regex form: the grammar's own pattern.
  const m = regex.exec(line);
  if (m) {
    const x = cleanFragment(m[1] ?? "");
    const y = cleanFragment(m[2] ?? "");
    if (x && y) return { raw: line.trim(), parts: [x, y] };
  }

  return null;
}

// Regex anchored loosely so we tolerate surrounding prose.
// (?:just\s+|merely\s+|only\s+)? — optional intensifier handled
// separately by the not-just-x-but-y grammar, so this one *excludes*
// those to avoid double-claiming a construction.
const NOT_X_BUT_Y_RE =
  /\bnot\s+(?!just\b|merely\b|only\b)(.+?)(?:,?\s+)but\s+(?:rather\s+|instead\s+)?(.+?)(?:[.!?]|$)/i;

const NOT_JUST_X_BUT_Y_RE =
  /\bnot\s+(?:just|merely|only)\s+(.+?)(?:,?\s+)but\s+(?:rather\s+|also\s+|instead\s+)?(.+?)(?:[.!?]|$)/i;

// ---------------------------------------------------------------------------
// Register batteries — curated instances per grammar × register
// ---------------------------------------------------------------------------

const NOT_X_BUT_Y_REGISTERS: Record<string, GrammarInstance[]> = {
  "Marketing": [
    { raw: "not a tool, but a partner", parts: ["a tool", "a partner"] },
    { raw: "not software, but a movement", parts: ["software", "a movement"] },
    { raw: "not the end, but the beginning", parts: ["the end", "the beginning"] },
    { raw: "not about features, but about experience", parts: ["about features", "about experience"] },
    { raw: "not a product, but a platform", parts: ["a product", "a platform"] },
    { raw: "not a purchase, but an investment", parts: ["a purchase", "an investment"] },
    { raw: "not an app, but a companion", parts: ["an app", "a companion"] },
    { raw: "not disruption, but evolution", parts: ["disruption", "evolution"] },
    { raw: "not competition, but community", parts: ["competition", "community"] },
    { raw: "not a brand, but a belief", parts: ["a brand", "a belief"] },
    { raw: "not a service, but a relationship", parts: ["a service", "a relationship"] },
    { raw: "not a solution, but a transformation", parts: ["a solution", "a transformation"] },
  ],
  "AI pedagogical": [
    { raw: "not a problem, but an opportunity", parts: ["a problem", "an opportunity"] },
    { raw: "not a contradiction, but a tension", parts: ["a contradiction", "a tension"] },
    { raw: "not a weakness, but a strength", parts: ["a weakness", "a strength"] },
    { raw: "not a failure, but a learning experience", parts: ["a failure", "a learning experience"] },
    { raw: "not a simple question, but a nuanced one", parts: ["a simple question", "a nuanced one"] },
    { raw: "not the wrong answer, but a different perspective", parts: ["the wrong answer", "a different perspective"] },
    { raw: "not an endpoint, but a starting point", parts: ["an endpoint", "a starting point"] },
    { raw: "not a limitation, but a consideration", parts: ["a limitation", "a consideration"] },
    { raw: "not a mistake, but an iteration", parts: ["a mistake", "an iteration"] },
    { raw: "not a bug, but a feature", parts: ["a bug", "a feature"] },
    { raw: "not a dichotomy, but a spectrum", parts: ["a dichotomy", "a spectrum"] },
    { raw: "not a binary, but a continuum", parts: ["a binary", "a continuum"] },
  ],
  "Political op-ed": [
    { raw: "not isolation, but engagement", parts: ["isolation", "engagement"] },
    { raw: "not a wall, but a bridge", parts: ["a wall", "a bridge"] },
    { raw: "not the cause, but a symptom", parts: ["the cause", "a symptom"] },
    { raw: "not tolerance, but understanding", parts: ["tolerance", "understanding"] },
    { raw: "not charity, but justice", parts: ["charity", "justice"] },
    { raw: "not retreat, but renewal", parts: ["retreat", "renewal"] },
    { raw: "not division, but dialogue", parts: ["division", "dialogue"] },
    { raw: "not the problem, but the proof", parts: ["the problem", "the proof"] },
    { raw: "not an ending, but a beginning", parts: ["an ending", "a beginning"] },
    { raw: "not weakness, but wisdom", parts: ["weakness", "wisdom"] },
    { raw: "not compromise, but common ground", parts: ["compromise", "common ground"] },
    { raw: "not silence, but solidarity", parts: ["silence", "solidarity"] },
  ],
  "Technology discourse": [
    { raw: "not replacement, but augmentation", parts: ["replacement", "augmentation"] },
    { raw: "not automation, but collaboration", parts: ["automation", "collaboration"] },
    { raw: "not a threat, but a tool", parts: ["a threat", "a tool"] },
    { raw: "not artificial, but assistive", parts: ["artificial", "assistive"] },
    { raw: "not surveillance, but stewardship", parts: ["surveillance", "stewardship"] },
    { raw: "not data extraction, but data partnership", parts: ["data extraction", "data partnership"] },
    { raw: "not a black box, but a glass box", parts: ["a black box", "a glass box"] },
    { raw: "not code, but craft", parts: ["code", "craft"] },
    { raw: "not disruption, but empowerment", parts: ["disruption", "empowerment"] },
    { raw: "not hype, but progress", parts: ["hype", "progress"] },
    { raw: "not the end of work, but the evolution of work", parts: ["the end of work", "the evolution of work"] },
    { raw: "not a bubble, but a paradigm shift", parts: ["a bubble", "a paradigm shift"] },
  ],
};

const NOT_JUST_X_BUT_Y_REGISTERS: Record<string, GrammarInstance[]> = {
  "Marketing": [
    { raw: "not just software, but a lifestyle", parts: ["software", "a lifestyle"] },
    { raw: "not just a purchase, but a commitment", parts: ["a purchase", "a commitment"] },
    { raw: "not merely a product, but a philosophy", parts: ["a product", "a philosophy"] },
    { raw: "not just a brand, but a movement", parts: ["a brand", "a movement"] },
    { raw: "not only efficient, but elegant", parts: ["efficient", "elegant"] },
    { raw: "not just convenient, but transformative", parts: ["convenient", "transformative"] },
    { raw: "not just fast, but seamless", parts: ["fast", "seamless"] },
    { raw: "not merely good, but exceptional", parts: ["good", "exceptional"] },
    { raw: "not just an upgrade, but a reinvention", parts: ["an upgrade", "a reinvention"] },
    { raw: "not just about now, but about the future", parts: ["about now", "about the future"] },
    { raw: "not only powerful, but intuitive", parts: ["powerful", "intuitive"] },
    { raw: "not just functional, but beautiful", parts: ["functional", "beautiful"] },
  ],
  "AI pedagogical": [
    { raw: "not just helpful, but empowering", parts: ["helpful", "empowering"] },
    { raw: "not merely correct, but insightful", parts: ["correct", "insightful"] },
    { raw: "not just efficient, but meaningful", parts: ["efficient", "meaningful"] },
    { raw: "not only accurate, but nuanced", parts: ["accurate", "nuanced"] },
    { raw: "not merely factual, but contextual", parts: ["factual", "contextual"] },
    { raw: "not just informative, but transformative", parts: ["informative", "transformative"] },
    { raw: "not only logical, but intuitive", parts: ["logical", "intuitive"] },
    { raw: "not just a response, but a dialogue", parts: ["a response", "a dialogue"] },
    { raw: "not merely an answer, but a perspective", parts: ["an answer", "a perspective"] },
    { raw: "not just a chatbot, but a thinking partner", parts: ["a chatbot", "a thinking partner"] },
    { raw: "not only capable, but collaborative", parts: ["capable", "collaborative"] },
    { raw: "not just assistance, but augmentation", parts: ["assistance", "augmentation"] },
  ],
  "Political op-ed": [
    { raw: "not just a policy, but a principle", parts: ["a policy", "a principle"] },
    { raw: "not merely a question of law, but of justice", parts: ["a question of law", "a question of justice"] },
    { raw: "not just about economics, but about dignity", parts: ["about economics", "about dignity"] },
    { raw: "not only a right, but a responsibility", parts: ["a right", "a responsibility"] },
    { raw: "not just a moment, but a movement", parts: ["a moment", "a movement"] },
    { raw: "not merely symbolic, but substantive", parts: ["symbolic", "substantive"] },
    { raw: "not just a change, but a reckoning", parts: ["a change", "a reckoning"] },
    { raw: "not only legal, but moral", parts: ["legal", "moral"] },
    { raw: "not just individuals, but institutions", parts: ["individuals", "institutions"] },
    { raw: "not only a vote, but a voice", parts: ["a vote", "a voice"] },
    { raw: "not merely tolerance, but acceptance", parts: ["tolerance", "acceptance"] },
    { raw: "not just reform, but transformation", parts: ["reform", "transformation"] },
  ],
  "Technology discourse": [
    { raw: "not just faster, but fundamentally different", parts: ["faster", "fundamentally different"] },
    { raw: "not merely automation, but augmentation", parts: ["automation", "augmentation"] },
    { raw: "not only powerful, but responsible", parts: ["powerful", "responsible"] },
    { raw: "not just innovation, but transformation", parts: ["innovation", "transformation"] },
    { raw: "not merely technical, but ethical", parts: ["technical", "ethical"] },
    { raw: "not just scalable, but sustainable", parts: ["scalable", "sustainable"] },
    { raw: "not only efficient, but equitable", parts: ["efficient", "equitable"] },
    { raw: "not just a tool, but a teammate", parts: ["a tool", "a teammate"] },
    { raw: "not merely intelligent, but wise", parts: ["intelligent", "wise"] },
    { raw: "not just accessible, but inclusive", parts: ["accessible", "inclusive"] },
    { raw: "not only open source, but open community", parts: ["open source", "open community"] },
    { raw: "not just AI, but augmented intelligence", parts: ["AI", "augmented intelligence"] },
  ],
};

// ---------------------------------------------------------------------------
// Grammar definitions
// ---------------------------------------------------------------------------

export const GRAMMARS: Record<string, Grammar> = {
  "not-x-but-y": {
    id: "not-x-but-y",
    name: "Not X but Y",
    description:
      "The core pseudo-dialectic. Performs antithesis by rotating slightly " +
      "to a geometric near-neighbour and naming the rotation as opposition.",
    example: "not a problem, but an opportunity",
    parse: line => parsePipeOrRegex(line, NOT_X_BUT_Y_RE),
    registers: NOT_X_BUT_Y_REGISTERS,
  },
  "not-just-x-but-y": {
    id: "not-just-x-but-y",
    name: "Not just X but Y",
    description:
      "The intensified antithesis, characteristically RLHF-flavoured. " +
      "Concedes X to then gesture toward a more refined Y; the opposition " +
      "is softer than 'not X but Y' but the grammar is the same.",
    example: "not just helpful, but empowering",
    parse: line => parsePipeOrRegex(line, NOT_JUST_X_BUT_Y_RE),
    registers: NOT_JUST_X_BUT_Y_REGISTERS,
  },
};

export const DEFAULT_GRAMMAR_ID = "not-x-but-y";
export const DEFAULT_GRAMMAR_THRESHOLD = 0.55;

// ---------------------------------------------------------------------------
// Resolver / helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the grammar and instance list for a given set of inputs.
 * Returns null when the grammar id is unknown or no instances resolve.
 */
export function resolveGrammarInstances(inputs: GrammarOfVectorsInputs): {
  grammar: Grammar;
  instances: GrammarInstance[];
  register?: string;
} | null {
  const grammar = GRAMMARS[inputs.grammarId];
  if (!grammar) return null;

  if (inputs.instances && inputs.instances.length > 0) {
    return { grammar, instances: inputs.instances, register: inputs.register };
  }

  const register = inputs.register ?? Object.keys(grammar.registers)[0];
  const instances = grammar.registers[register];
  if (!instances || instances.length === 0) return null;
  return { grammar, instances, register };
}

/**
 * Parse a free-form textarea into instances, using the given grammar's
 * parser. Lines that don't match either the pipe form or the grammar's
 * regex are skipped.
 */
export function parseInstances(grammarId: string, text: string): GrammarInstance[] {
  const grammar = GRAMMARS[grammarId];
  if (!grammar) return [];
  const out: GrammarInstance[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const parsed = grammar.parse(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Flat text list for batched embedding. Returns [x0, y0, x1, y1, ...]
 * so `computeGrammarOfVectors` can slice cleanly.
 */
export function grammarOfVectorsTextList(inputs: GrammarOfVectorsInputs): string[] {
  const resolved = resolveGrammarInstances(inputs);
  if (!resolved) return [];
  const texts: string[] = [];
  for (const instance of resolved.instances) {
    texts.push(instance.parts[0], instance.parts[1]);
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeGrammarOfVectors(
  inputs: GrammarOfVectorsInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): GrammarOfVectorsResult {
  const resolved = resolveGrammarInstances(inputs);
  if (!resolved) {
    throw new Error(
      `grammar-of-vectors requires a valid grammarId. Known grammars: ${Object.keys(GRAMMARS).join(", ")}. ` +
        `Also requires either a register preset or an explicit instances list.`
    );
  }
  const { grammar, instances, register } = resolved;
  const threshold = inputs.threshold ?? DEFAULT_GRAMMAR_THRESHOLD;

  const pairs: GrammarPairResult[] = instances.map((instance, i) => {
    const models: GrammarPairModelResult[] = enabledModels
      .filter(m => modelVectors.has(m.id))
      .map(m => {
        const vectors = modelVectors.get(m.id)!;
        const xVec = vectors[i * 2];
        const yVec = vectors[i * 2 + 1];
        const sim = cosineSimilarity(xVec, yVec);
        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          cosineSimilarity: sim,
          oppositionPreserved: sim < threshold,
        };
      });
    return { instance, models };
  });

  // Summary stats.
  let totalTests = 0;
  let preservedCount = 0;
  let simSum = 0;
  let mostDeceptive: GrammarOfVectorsResult["summary"]["mostDeceptive"] = null;
  for (const row of pairs) {
    for (const m of row.models) {
      totalTests += 1;
      if (m.oppositionPreserved) preservedCount += 1;
      simSum += m.cosineSimilarity;
      if (!mostDeceptive || m.cosineSimilarity > mostDeceptive.cosine) {
        mostDeceptive = {
          raw: row.instance.raw,
          cosine: m.cosineSimilarity,
          modelName: m.modelName,
        };
      }
    }
  }
  const preservedRate = totalTests > 0 ? preservedCount / totalTests : 0;
  const avgSimilarity = totalTests > 0 ? simSum / totalTests : 0;

  return {
    grammarId: grammar.id,
    grammarName: grammar.name,
    register,
    threshold,
    pairs,
    summary: {
      totalPairs: pairs.length,
      totalTests,
      preservedCount,
      preservedRate,
      avgSimilarity,
      mostDeceptive,
    },
  };
}

export function grammarOfVectorsHeadline(
  result: GrammarOfVectorsResult
): Record<string, number | string> {
  return {
    grammar: result.grammarName,
    register: result.register ?? "custom",
    pairs: result.summary.totalPairs,
    "opposition preserved": `${(result.summary.preservedRate * 100).toFixed(1)}%`,
    "avg cosine": Number(result.summary.avgSimilarity.toFixed(4)),
    "most deceptive": result.summary.mostDeceptive
      ? `"${truncate(result.summary.mostDeceptive.raw, 36)}" (${result.summary.mostDeceptive.cosine.toFixed(3)})`
      : "-",
    "threshold": result.threshold,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

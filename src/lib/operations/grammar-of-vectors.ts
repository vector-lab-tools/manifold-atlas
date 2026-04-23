/**
 * Grammar of Vectors — pure compute.
 *
 * Maps discursive quirks of LLM text generation by embedding the
 * rhetorically-opposed fragments of a construction (e.g. "not X but Y")
 * and measuring cosine(X, Y). When the rhetoric of opposition is
 * performed over a geometry of proximity, the cosine sits at or above
 * the threshold — synthetic dialectic (syn-dialectic for short).
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

// Geometric helpers kept local so the module has no React deps.

function vectorNorm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / xs.length);
}

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
   * Threshold above which a pair counts as synthetic dialectic. Below =
   * genuine opposition preserved in the geometry.
   */
  threshold?: number;
}

export interface GrammarPairModelResult {
  modelId: string;
  modelName: string;
  cosineSimilarity: number;
  /** 1 − cosine similarity. */
  cosineDistance: number;
  /** Angular distance in degrees (0° = identical, 90° = orthogonal, 180° = opposite). */
  angularDistance: number;
  /** L2 norm of (x − y). */
  euclideanDistance: number;
  /** L2 norm of the X vector. */
  normX: number;
  /** L2 norm of the Y vector. */
  normY: number;
  /** Embedding dimensions this model uses. */
  dimensions: number;
  /** True if cosine < threshold — opposition is preserved. */
  oppositionPreserved: boolean;
}

export interface GrammarPairResult {
  instance: GrammarInstance;
  models: GrammarPairModelResult[];
  /** Mean cosine across models for this pair. */
  meanCosine: number;
  /**
   * Cross-model range (max cosine − min cosine) for this construction.
   * High range = models disagree about whether the antithesis survives.
   */
  crossModelRange: number;
}

export interface GrammarModelAggregate {
  modelId: string;
  modelName: string;
  pairCount: number;
  meanCosine: number;
  stdDevCosine: number;
  minCosine: number;
  maxCosine: number;
  preservedCount: number;
  preservedRate: number;
  /** Construction this model rates as most geometrically deceptive. */
  mostDeceptive: { raw: string; cosine: number } | null;
  /** Construction this model rates as most-preserved antithesis. */
  mostPreserved: { raw: string; cosine: number } | null;
}

export interface GrammarThresholdSweepRow {
  threshold: number;
  preservedCount: number;
  totalTests: number;
  preservedRate: number;
}

export interface GrammarDistributionBucket {
  /** Lower bound of the bucket, inclusive. */
  lower: number;
  /** Upper bound of the bucket, exclusive (except the last bucket). */
  upper: number;
  count: number;
}

export interface GrammarOfVectorsResult {
  grammarId: string;
  grammarName: string;
  register?: string;
  threshold: number;
  pairs: GrammarPairResult[];
  modelAggregates: GrammarModelAggregate[];
  thresholdSweep: GrammarThresholdSweepRow[];
  /** Ten 0.1-wide buckets over all cosine values across all models. */
  cosineDistribution: GrammarDistributionBucket[];
  summary: {
    totalPairs: number;
    totalTests: number;
    preservedCount: number;
    preservedRate: number;
    avgSimilarity: number;
    /** Standard deviation of cosine values across all tests. */
    stdDevSimilarity: number;
    /** The pair with the highest (most geometrically deceptive) cosine. */
    mostDeceptive: {
      raw: string;
      cosine: number;
      modelName: string;
    } | null;
    /** The pair with the lowest (most-preserved) cosine. */
    mostPreserved: {
      raw: string;
      cosine: number;
      modelName: string;
    } | null;
    /**
     * Construction with the widest cross-model range — the point where
     * models disagree most about whether opposition is preserved.
     */
    mostContested: {
      raw: string;
      range: number;
      minCosine: number;
      maxCosine: number;
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

// "It's not X, it's Y" — false-correction form. Accepts "it's", "it is",
// "this isn't", and common punctuation between clauses.
const IT_IS_NOT_X_IT_IS_Y_RE =
  /\b(?:it['\u2019]s|it\s+is|this\s+isn['\u2019]t|this\s+is\s+not)\s+(?:that\s+)?(.+?)[,;:\s—-]+(?:it['\u2019]s|it\s+is|it['\u2019]s\s+that)\s+(?:that\s+)?(.+?)(?:[.!?]|$)/i;

// "While X, Y" — conciliation pivot. Also matches "although X, Y" and
// "though X, Y". The comma is required to separate the clauses.
const WHILE_X_Y_RE =
  /\b(?:while|although|though)\s+(.+?),\s+(.+?)(?:[.!?]|$)/i;

// "What matters / What's important / What counts is not X but Y" —
// cleft emphasis variant of "not X but Y". Preserves the same X/Y
// extraction slots.
const WHAT_MATTERS_IS_NOT_X_BUT_Y_RE =
  /\b(?:what\s+(?:matters|counts|is\s+(?:important|really\s+at\s+stake)))\s+(?:is\s+)?not\s+(.+?)(?:,?\s+)but\s+(?:rather\s+|instead\s+)?(.+?)(?:[.!?]|$)/i;

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

const IT_IS_NOT_X_IT_IS_Y_REGISTERS: Record<string, GrammarInstance[]> = {
  "Marketing": [
    { raw: "it's not about the product, it's about the experience", parts: ["the product", "the experience"] },
    { raw: "it's not a sale, it's a conversation", parts: ["a sale", "a conversation"] },
    { raw: "it's not about features, it's about feelings", parts: ["features", "feelings"] },
    { raw: "it's not what we sell, it's what we stand for", parts: ["what we sell", "what we stand for"] },
    { raw: "it's not a transaction, it's a relationship", parts: ["a transaction", "a relationship"] },
    { raw: "it's not the price, it's the value", parts: ["the price", "the value"] },
    { raw: "it's not a campaign, it's a movement", parts: ["a campaign", "a movement"] },
    { raw: "it's not a purchase, it's a membership", parts: ["a purchase", "a membership"] },
    { raw: "it's not just what we make, it's who we make it for", parts: ["what we make", "who we make it for"] },
    { raw: "it's not about being the biggest, it's about being the best", parts: ["being the biggest", "being the best"] },
    { raw: "it's not the destination, it's the journey", parts: ["the destination", "the journey"] },
    { raw: "it's not a service, it's a promise", parts: ["a service", "a promise"] },
  ],
  "AI pedagogical": [
    { raw: "it's not that the model is wrong, it's that the framing matters", parts: ["the model is wrong", "the framing matters"] },
    { raw: "it's not about getting the right answer, it's about asking the right question", parts: ["getting the right answer", "asking the right question"] },
    { raw: "it's not a limitation, it's a design choice", parts: ["a limitation", "a design choice"] },
    { raw: "it's not about replacing humans, it's about augmenting them", parts: ["replacing humans", "augmenting them"] },
    { raw: "it's not a simple yes or no, it's a matter of context", parts: ["a simple yes or no", "a matter of context"] },
    { raw: "it's not a mistake, it's an opportunity to learn", parts: ["a mistake", "an opportunity to learn"] },
    { raw: "it's not about what the AI can do, it's about what we should do with it", parts: ["what the AI can do", "what we should do with it"] },
    { raw: "it's not a bug in the system, it's a feature of the approach", parts: ["a bug in the system", "a feature of the approach"] },
    { raw: "it's not that there's one answer, it's that there are many valid perspectives", parts: ["there's one answer", "there are many valid perspectives"] },
    { raw: "it's not a straightforward problem, it's a nuanced challenge", parts: ["a straightforward problem", "a nuanced challenge"] },
    { raw: "it's not about certainty, it's about understanding", parts: ["certainty", "understanding"] },
    { raw: "it's not a binary choice, it's a spectrum of possibilities", parts: ["a binary choice", "a spectrum of possibilities"] },
  ],
  "Political op-ed": [
    { raw: "it's not a matter of politics, it's a matter of principle", parts: ["a matter of politics", "a matter of principle"] },
    { raw: "it's not the government's role, it's the community's responsibility", parts: ["the government's role", "the community's responsibility"] },
    { raw: "it's not about the law, it's about justice", parts: ["the law", "justice"] },
    { raw: "it's not what they say, it's what they do", parts: ["what they say", "what they do"] },
    { raw: "it's not a right-wing issue, it's a human issue", parts: ["a right-wing issue", "a human issue"] },
    { raw: "it's not about us versus them, it's about all of us together", parts: ["us versus them", "all of us together"] },
    { raw: "it's not a policy question, it's a values question", parts: ["a policy question", "a values question"] },
    { raw: "it's not the cost that matters, it's the consequences", parts: ["the cost", "the consequences"] },
    { raw: "it's not about winning, it's about what's right", parts: ["winning", "what's right"] },
    { raw: "it's not a budget issue, it's a moral issue", parts: ["a budget issue", "a moral issue"] },
    { raw: "it's not about tolerance, it's about respect", parts: ["tolerance", "respect"] },
    { raw: "it's not the system that's broken, it's the incentives", parts: ["the system", "the incentives"] },
  ],
  "Technology discourse": [
    { raw: "it's not about the technology, it's about what it enables", parts: ["the technology", "what it enables"] },
    { raw: "it's not a tool problem, it's a design problem", parts: ["a tool problem", "a design problem"] },
    { raw: "it's not the code, it's the architecture", parts: ["the code", "the architecture"] },
    { raw: "it's not about scale, it's about sustainability", parts: ["scale", "sustainability"] },
    { raw: "it's not a hardware limitation, it's a software opportunity", parts: ["a hardware limitation", "a software opportunity"] },
    { raw: "it's not about data collection, it's about data stewardship", parts: ["data collection", "data stewardship"] },
    { raw: "it's not the algorithm, it's the training data", parts: ["the algorithm", "the training data"] },
    { raw: "it's not about automation, it's about augmentation", parts: ["automation", "augmentation"] },
    { raw: "it's not a feature request, it's a paradigm shift", parts: ["a feature request", "a paradigm shift"] },
    { raw: "it's not a programming problem, it's a people problem", parts: ["a programming problem", "a people problem"] },
    { raw: "it's not what we build, it's how we build it", parts: ["what we build", "how we build it"] },
    { raw: "it's not a UX issue, it's a trust issue", parts: ["a UX issue", "a trust issue"] },
  ],
};

const WHILE_X_Y_REGISTERS: Record<string, GrammarInstance[]> = {
  "Marketing": [
    { raw: "while tradition has value, innovation drives progress", parts: ["tradition has value", "innovation drives progress"] },
    { raw: "while competitors focus on features, we focus on outcomes", parts: ["competitors focus on features", "we focus on outcomes"] },
    { raw: "while others chase trends, we set them", parts: ["others chase trends", "we set them"] },
    { raw: "while quality matters, speed matters more", parts: ["quality matters", "speed matters more"] },
    { raw: "while the market changes, our values remain", parts: ["the market changes", "our values remain"] },
    { raw: "while price is important, value is essential", parts: ["price is important", "value is essential"] },
    { raw: "while technology evolves, human needs stay the same", parts: ["technology evolves", "human needs stay the same"] },
    { raw: "while others promise, we deliver", parts: ["others promise", "we deliver"] },
    { raw: "while scale is impressive, craftsmanship is timeless", parts: ["scale is impressive", "craftsmanship is timeless"] },
    { raw: "while features sell, stories endure", parts: ["features sell", "stories endure"] },
    { raw: "while data informs, intuition inspires", parts: ["data informs", "intuition inspires"] },
    { raw: "while efficiency is necessary, excellence is extraordinary", parts: ["efficiency is necessary", "excellence is extraordinary"] },
  ],
  "AI pedagogical": [
    { raw: "while AI can process information quickly, it can't replace human judgement", parts: ["AI can process information quickly", "it can't replace human judgement"] },
    { raw: "while algorithms identify patterns, humans create meaning", parts: ["algorithms identify patterns", "humans create meaning"] },
    { raw: "while the technology is powerful, the responsibility is ours", parts: ["the technology is powerful", "the responsibility is ours"] },
    { raw: "while AI can solve problems, it can't identify which problems to solve", parts: ["AI can solve problems", "it can't identify which problems to solve"] },
    { raw: "while machines process facts, humans interpret meaning", parts: ["machines process facts", "humans interpret meaning"] },
    { raw: "while the capabilities are impressive, the implications are sobering", parts: ["the capabilities are impressive", "the implications are sobering"] },
    { raw: "while AI assists with answers, humans ask the questions", parts: ["AI assists with answers", "humans ask the questions"] },
    { raw: "while models can be trained, wisdom cannot", parts: ["models can be trained", "wisdom cannot"] },
    { raw: "while AI expands possibilities, ethics constrain them", parts: ["AI expands possibilities", "ethics constrain them"] },
    { raw: "while automation increases efficiency, it also raises accountability questions", parts: ["automation increases efficiency", "it also raises accountability questions"] },
    { raw: "while performance matters, alignment matters more", parts: ["performance matters", "alignment matters more"] },
    { raw: "while AI can generate, only humans can originate", parts: ["AI can generate", "only humans can originate"] },
  ],
  "Political op-ed": [
    { raw: "while we must protect our borders, we must also welcome those in need", parts: ["we must protect our borders", "we must also welcome those in need"] },
    { raw: "while security is vital, liberty is fundamental", parts: ["security is vital", "liberty is fundamental"] },
    { raw: "while economic growth matters, equity matters more", parts: ["economic growth matters", "equity matters more"] },
    { raw: "while the market has its place, it cannot solve every problem", parts: ["the market has its place", "it cannot solve every problem"] },
    { raw: "while change is necessary, it must be thoughtful", parts: ["change is necessary", "it must be thoughtful"] },
    { raw: "while we respect traditions, we must not be bound by them", parts: ["we respect traditions", "we must not be bound by them"] },
    { raw: "while the individual matters, the collective matters too", parts: ["the individual matters", "the collective matters too"] },
    { raw: "while compromise has value, principle has greater value", parts: ["compromise has value", "principle has greater value"] },
    { raw: "while efficiency is desirable, fairness is essential", parts: ["efficiency is desirable", "fairness is essential"] },
    { raw: "while we celebrate progress, we must acknowledge remaining challenges", parts: ["we celebrate progress", "we must acknowledge remaining challenges"] },
    { raw: "while freedom is paramount, it comes with responsibility", parts: ["freedom is paramount", "it comes with responsibility"] },
    { raw: "while the right has merit, the left has urgency", parts: ["the right has merit", "the left has urgency"] },
  ],
  "Technology discourse": [
    { raw: "while open source democratises, commercial software sustains", parts: ["open source democratises", "commercial software sustains"] },
    { raw: "while move-fast-and-break-things had its moment, intentional design is the future", parts: ["move-fast-and-break-things had its moment", "intentional design is the future"] },
    { raw: "while cloud scales, edge localises", parts: ["cloud scales", "edge localises"] },
    { raw: "while blockchain decentralises, it also fragments", parts: ["blockchain decentralises", "it also fragments"] },
    { raw: "while APIs enable, they also constrain", parts: ["APIs enable", "they also constrain"] },
    { raw: "while data is valuable, context is essential", parts: ["data is valuable", "context is essential"] },
    { raw: "while speed is a feature, reliability is a requirement", parts: ["speed is a feature", "reliability is a requirement"] },
    { raw: "while AI automates tasks, humans automate intent", parts: ["AI automates tasks", "humans automate intent"] },
    { raw: "while the platform is the product, the community is the value", parts: ["the platform is the product", "the community is the value"] },
    { raw: "while scalability matters technically, sustainability matters socially", parts: ["scalability matters technically", "sustainability matters socially"] },
    { raw: "while new frameworks emerge weekly, fundamentals remain", parts: ["new frameworks emerge weekly", "fundamentals remain"] },
    { raw: "while we build for scale, we must design for trust", parts: ["we build for scale", "we must design for trust"] },
  ],
};

const WHAT_MATTERS_IS_NOT_X_BUT_Y_REGISTERS: Record<string, GrammarInstance[]> = {
  "Marketing": [
    { raw: "what matters is not the price, but the value", parts: ["the price", "the value"] },
    { raw: "what matters is not what we sell, but what we stand for", parts: ["what we sell", "what we stand for"] },
    { raw: "what matters is not the product, but the outcome", parts: ["the product", "the outcome"] },
    { raw: "what matters is not features, but benefits", parts: ["features", "benefits"] },
    { raw: "what counts is not how many, but how well", parts: ["how many", "how well"] },
    { raw: "what matters is not the first mover, but the best mover", parts: ["the first mover", "the best mover"] },
    { raw: "what counts is not the launch, but the follow-through", parts: ["the launch", "the follow-through"] },
    { raw: "what matters is not what we build, but who we build it for", parts: ["what we build", "who we build it for"] },
    { raw: "what matters is not the technology, but the transformation", parts: ["the technology", "the transformation"] },
    { raw: "what counts is not the metrics, but the meaning behind them", parts: ["the metrics", "the meaning behind them"] },
    { raw: "what's really at stake is not market share, but customer trust", parts: ["market share", "customer trust"] },
    { raw: "what matters is not disruption for its own sake, but positive change", parts: ["disruption for its own sake", "positive change"] },
  ],
  "AI pedagogical": [
    { raw: "what matters is not whether the AI is right, but whether we ask the right questions", parts: ["whether the AI is right", "whether we ask the right questions"] },
    { raw: "what's important is not the answer, but the process", parts: ["the answer", "the process"] },
    { raw: "what counts is not the output, but the underlying reasoning", parts: ["the output", "the underlying reasoning"] },
    { raw: "what matters is not what AI can do, but what we should do with it", parts: ["what AI can do", "what we should do with it"] },
    { raw: "what's really at stake is not efficiency, but equity", parts: ["efficiency", "equity"] },
    { raw: "what matters is not the technology itself, but the values embedded in it", parts: ["the technology itself", "the values embedded in it"] },
    { raw: "what counts is not whether we can automate, but whether we should", parts: ["whether we can automate", "whether we should"] },
    { raw: "what matters is not the capability, but the application", parts: ["the capability", "the application"] },
    { raw: "what's important is not how fast AI learns, but what it learns", parts: ["how fast AI learns", "what it learns"] },
    { raw: "what matters is not the sophistication of the model, but the wisdom of its use", parts: ["the sophistication of the model", "the wisdom of its use"] },
    { raw: "what counts is not the accuracy alone, but the fairness of the outcome", parts: ["the accuracy alone", "the fairness of the outcome"] },
    { raw: "what matters is not replacing human judgement, but informing it", parts: ["replacing human judgement", "informing it"] },
  ],
  "Political op-ed": [
    { raw: "what matters is not who wins, but what we stand for", parts: ["who wins", "what we stand for"] },
    { raw: "what counts is not the rhetoric, but the reality", parts: ["the rhetoric", "the reality"] },
    { raw: "what matters is not the policy, but its implementation", parts: ["the policy", "its implementation"] },
    { raw: "what's important is not intent, but impact", parts: ["intent", "impact"] },
    { raw: "what counts is not who we say we are, but what we actually do", parts: ["who we say we are", "what we actually do"] },
    { raw: "what matters is not the short-term gain, but the long-term cost", parts: ["the short-term gain", "the long-term cost"] },
    { raw: "what's really at stake is not tradition, but justice", parts: ["tradition", "justice"] },
    { raw: "what counts is not symbolic gestures, but substantive change", parts: ["symbolic gestures", "substantive change"] },
    { raw: "what matters is not the majority's comfort, but the minority's rights", parts: ["the majority's comfort", "the minority's rights"] },
    { raw: "what's important is not where we start, but where we end up", parts: ["where we start", "where we end up"] },
    { raw: "what counts is not the law on the books, but the law in practice", parts: ["the law on the books", "the law in practice"] },
    { raw: "what matters is not the noise, but the signal", parts: ["the noise", "the signal"] },
  ],
  "Technology discourse": [
    { raw: "what matters is not the technology, but the problem it solves", parts: ["the technology", "the problem it solves"] },
    { raw: "what counts is not the innovation, but the adoption", parts: ["the innovation", "the adoption"] },
    { raw: "what's important is not how it works, but why it matters", parts: ["how it works", "why it matters"] },
    { raw: "what matters is not the scale, but the sustainability", parts: ["the scale", "the sustainability"] },
    { raw: "what counts is not the code, but the design", parts: ["the code", "the design"] },
    { raw: "what matters is not the raw capability, but the thoughtful application", parts: ["the raw capability", "the thoughtful application"] },
    { raw: "what's really at stake is not efficiency, but humanity", parts: ["efficiency", "humanity"] },
    { raw: "what counts is not the algorithm, but the accountability", parts: ["the algorithm", "the accountability"] },
    { raw: "what matters is not the platform's reach, but its ethics", parts: ["the platform's reach", "its ethics"] },
    { raw: "what's important is not the tool, but the purpose", parts: ["the tool", "the purpose"] },
    { raw: "what counts is not the benchmarks, but the real-world impact", parts: ["the benchmarks", "the real-world impact"] },
    { raw: "what matters is not what we can do with technology, but what we should", parts: ["what we can do with technology", "what we should"] },
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
      "The core synthetic dialectic. Performs antithesis by rotating slightly " +
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
  "it-is-not-x-it-is-y": {
    id: "it-is-not-x-it-is-y",
    name: "It's not X, it's Y",
    description:
      "The false-correction: a pivot framed as self-correction where nothing " +
      "was actually wrong. Simulates the move of revision without revising. " +
      "Characteristic of AI explainer prose.",
    example: "it's not a problem, it's an opportunity",
    parse: line => parsePipeOrRegex(line, IT_IS_NOT_X_IT_IS_Y_RE),
    registers: IT_IS_NOT_X_IT_IS_Y_REGISTERS,
  },
  "while-x-y": {
    id: "while-x-y",
    name: "While X, Y",
    description:
      "The conciliation pivot: both-sides framing that gestures at balance " +
      "while its weight sits firmly on Y. Also matches 'although X, Y' and " +
      "'though X, Y'. Beloved of the op-ed register.",
    example: "while tradition has value, innovation drives progress",
    parse: line => parsePipeOrRegex(line, WHILE_X_Y_RE),
    registers: WHILE_X_Y_REGISTERS,
  },
  "what-matters-is-not-x-but-y": {
    id: "what-matters-is-not-x-but-y",
    name: "What matters is not X but Y",
    description:
      "The cleft-emphasis variant of 'not X but Y'. Adds rhetorical weight " +
      "by framing the pair as a matter of stakes. Also matches 'what counts', " +
      "'what's important', and 'what's really at stake'.",
    example: "what matters is not the price, but the value",
    parse: line => parsePipeOrRegex(line, WHAT_MATTERS_IS_NOT_X_BUT_Y_RE),
    registers: WHAT_MATTERS_IS_NOT_X_BUT_Y_REGISTERS,
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
        const clamped = Math.max(-1, Math.min(1, sim));
        const angular = (Math.acos(clamped) * 180) / Math.PI;
        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          cosineSimilarity: sim,
          cosineDistance: 1 - sim,
          angularDistance: angular,
          euclideanDistance: euclidean(xVec, yVec),
          normX: vectorNorm(xVec),
          normY: vectorNorm(yVec),
          dimensions: xVec.length,
          oppositionPreserved: sim < threshold,
        };
      });

    const sims = models.map(m => m.cosineSimilarity);
    const meanCosine = mean(sims);
    const crossModelRange = sims.length > 1 ? Math.max(...sims) - Math.min(...sims) : 0;
    return { instance, models, meanCosine, crossModelRange };
  });

  // Summary stats + most-deceptive / most-preserved / most-contested.
  let totalTests = 0;
  let preservedCount = 0;
  const allCosines: number[] = [];
  let mostDeceptive: GrammarOfVectorsResult["summary"]["mostDeceptive"] = null;
  let mostPreserved: GrammarOfVectorsResult["summary"]["mostPreserved"] = null;
  let mostContested: GrammarOfVectorsResult["summary"]["mostContested"] = null;
  for (const row of pairs) {
    for (const m of row.models) {
      totalTests += 1;
      if (m.oppositionPreserved) preservedCount += 1;
      allCosines.push(m.cosineSimilarity);
      if (!mostDeceptive || m.cosineSimilarity > mostDeceptive.cosine) {
        mostDeceptive = { raw: row.instance.raw, cosine: m.cosineSimilarity, modelName: m.modelName };
      }
      if (!mostPreserved || m.cosineSimilarity < mostPreserved.cosine) {
        mostPreserved = { raw: row.instance.raw, cosine: m.cosineSimilarity, modelName: m.modelName };
      }
    }
    if (row.models.length > 1) {
      if (!mostContested || row.crossModelRange > mostContested.range) {
        const sims = row.models.map(m => m.cosineSimilarity);
        mostContested = {
          raw: row.instance.raw,
          range: row.crossModelRange,
          minCosine: Math.min(...sims),
          maxCosine: Math.max(...sims),
        };
      }
    }
  }
  const preservedRate = totalTests > 0 ? preservedCount / totalTests : 0;
  const avgSimilarity = mean(allCosines);
  const stdDevSimilarity = stdDev(allCosines);

  // Per-model aggregates.
  const modelAggregates: GrammarModelAggregate[] = [];
  const modelSet = new Set<string>();
  for (const row of pairs) for (const m of row.models) modelSet.add(m.modelId);
  for (const modelId of modelSet) {
    const rows = pairs
      .map(p => {
        const mm = p.models.find(m => m.modelId === modelId);
        return mm ? { raw: p.instance.raw, cos: mm.cosineSimilarity, preserved: mm.oppositionPreserved, name: mm.modelName } : null;
      })
      .filter((x): x is { raw: string; cos: number; preserved: boolean; name: string } => x !== null);
    if (rows.length === 0) continue;
    const cosines = rows.map(r => r.cos);
    const preservedRows = rows.filter(r => r.preserved);
    const mostDec = rows.reduce((a, b) => (b.cos > a.cos ? b : a));
    const mostPres = rows.reduce((a, b) => (b.cos < a.cos ? b : a));
    modelAggregates.push({
      modelId,
      modelName: rows[0].name,
      pairCount: rows.length,
      meanCosine: mean(cosines),
      stdDevCosine: stdDev(cosines),
      minCosine: Math.min(...cosines),
      maxCosine: Math.max(...cosines),
      preservedCount: preservedRows.length,
      preservedRate: rows.length > 0 ? preservedRows.length / rows.length : 0,
      mostDeceptive: { raw: mostDec.raw, cosine: mostDec.cos },
      mostPreserved: { raw: mostPres.raw, cosine: mostPres.cos },
    });
  }

  // Threshold sweep: how does preservation rate change with threshold?
  const sweepThresholds = [0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9];
  const thresholdSweep: GrammarThresholdSweepRow[] = sweepThresholds.map(t => {
    const preserved = allCosines.filter(c => c < t).length;
    return {
      threshold: t,
      preservedCount: preserved,
      totalTests,
      preservedRate: totalTests > 0 ? preserved / totalTests : 0,
    };
  });

  // Cosine distribution: 10 buckets over [0, 1]. Values <0 bin into
  // the first bucket; values >=1 bin into the last.
  const cosineDistribution: GrammarDistributionBucket[] = Array.from({ length: 10 }, (_, i) => ({
    lower: i / 10,
    upper: (i + 1) / 10,
    count: 0,
  }));
  for (const c of allCosines) {
    let idx = Math.floor(c * 10);
    if (idx < 0) idx = 0;
    if (idx > 9) idx = 9;
    cosineDistribution[idx].count += 1;
  }

  return {
    grammarId: grammar.id,
    grammarName: grammar.name,
    register,
    threshold,
    pairs,
    modelAggregates,
    thresholdSweep,
    cosineDistribution,
    summary: {
      totalPairs: pairs.length,
      totalTests,
      preservedCount,
      preservedRate,
      avgSimilarity,
      stdDevSimilarity,
      mostDeceptive,
      mostPreserved,
      mostContested,
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

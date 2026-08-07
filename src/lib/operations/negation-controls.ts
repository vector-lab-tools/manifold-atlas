/**
 * Control family for a negation probe.
 *
 * A bare cosine between a claim and its negation cannot distinguish
 * three quite different situations: the model is reporting lexical
 * overlap, the model fails on opposition of any kind, or the model
 * fails specifically on the syntactic negation operator. The controls
 * here separate them by holding the sentence fixed and varying only
 * what kind of edit is made.
 *
 *   negation           "this law is not just"       the probe
 *   insertedModifier   "this law is broadly just"   same edit type as the
 *                                                   probe: one token
 *                                                   inserted in the same
 *                                                   position, no reversal
 *   matchedEdit        "this law is old"            one token substituted,
 *                                                   unrelated predicate
 *   antonym            "this law is unjust"         opposition carried by
 *                                                   the word, no operator
 *   unrelatedPredicate "this law is under review"   per-probe topical
 *                                                   ceiling
 *
 * The inserted-modifier control is the tightest of these. It performs
 * exactly the edit the negation performs, a single token inserted after
 * the copula, without reversing the truth conditions. A negation that
 * sits at or above it is not being explained by token count.
 *
 * Generation is rule-based and deterministic. A control family produced
 * by a language model would be a control family whose provenance has to
 * be defended, so the LLM route is offered as an override in the UI
 * rather than as the default path.
 */

import { generateNegation } from "@/lib/negation";

export type ControlKind =
  | "negation"
  | "insertedModifier"
  | "matchedEdit"
  | "antonym"
  | "unrelatedPredicate";

export interface Control {
  kind: ControlKind;
  text: string;
  /** Token-level edit distance from the original statement. */
  editDistance: number;
  /**
   * False when the generator fell back to a heuristic rather than a
   * known form. Every control it currently emits is confident; the flag
   * stays so that a future looser generator can be marked in the UI
   * rather than silently trusted.
   */
  confident: boolean;
  /** Short note for the tooltip, e.g. which word was substituted. */
  note?: string;
}

export interface ProbeFamily {
  statement: string;
  negation: Control;
  controls: Control[];
}

/**
 * The same auxiliary list the negation generator uses, so the modifier
 * is inserted exactly where "not" would go. Copulas are listed first
 * because a bare copula is the only case where the predicate can be
 * substituted safely.
 */
const COPULAS = new Set(["is", "are", "was", "were", "am", "be", "been", "being"]);

const AUXILIARIES = new Set([
  ...COPULAS,
  "has", "have", "had",
  "will", "would", "shall", "should",
  "can", "could", "may", "might", "must",
  "do", "does", "did",
]);

/**
 * Neutral adverbs inserted after the copula. Chosen to be as close to
 * semantically inert as a single word can be, so that the edit is
 * structural rather than a change of claim.
 */
const NEUTRAL_MODIFIERS = ["broadly", "generally", "typically", "largely"];

/**
 * Predicates for the matched-edit control. Unrelated to any evaluative
 * register, and spread across one to three syllables so the substitute
 * can be length-matched to the original.
 */
const NEUTRAL_PREDICATES = [
  "old", "new", "long", "brief", "local", "recent", "current",
  "regional", "seasonal", "printed", "quarterly", "annual",
];

/** Predicates for the per-probe topical ceiling. */
const UNRELATED_PREDICATES = [
  "under review",
  "printed on thin paper",
  "kept in the second drawer",
];

/**
 * Antonyms for the evaluative vocabulary the batteries use. A word not
 * listed here yields no antonym control at all, rather than a guess.
 */
const ANTONYMS: Record<string, string> = {
  just: "unjust", fair: "unfair", legal: "illegal", moral: "immoral",
  right: "wrong", wrong: "right", true: "false", false: "true",
  safe: "unsafe", good: "bad", bad: "good", useful: "useless",
  necessary: "unnecessary", possible: "impossible", rational: "irrational",
  reasonable: "unreasonable", democratic: "undemocratic", equal: "unequal",
  free: "unfree", stable: "unstable", certain: "uncertain",
  reliable: "unreliable", valid: "invalid", relevant: "irrelevant",
  neutral: "partisan", objective: "subjective", universal: "particular",
  effective: "ineffective", efficient: "inefficient", justified: "unjustified",
  ethical: "unethical", honest: "dishonest", desirable: "undesirable",
  acceptable: "unacceptable", sustainable: "unsustainable",
  dangerous: "safe", inevitable: "avoidable", natural: "artificial",
  public: "private", private: "public", real: "illusory",
  creative: "derivative", conscious: "unconscious",
};

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function stripPunct(w: string): string {
  return w.replace(/[.,;:!?"']+$/, "");
}

function trailingPunct(w: string): string {
  const m = w.match(/[.,;:!?"']+$/);
  return m ? m[0] : "";
}

/** Token-level Levenshtein distance, case-insensitive. */
export function tokenEditDistance(a: string, b: string): number {
  const x = tokens(a.toLowerCase()).map(stripPunct);
  const y = tokens(b.toLowerCase()).map(stripPunct);
  const rows = x.length + 1;
  const cols = y.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[rows - 1][cols - 1];
}

interface Parsed {
  words: string[];
  /** Index of the auxiliary or copula the negation attaches to, or -1. */
  auxIdx: number;
  /** True when that auxiliary is a copula rather than a modal or perfect. */
  isCopula: boolean;
  /**
   * Index of a single-word predicate adjective, or -1.
   *
   * Only a bare one-word predicate can be substituted safely. Swapping
   * the last word of a noun phrase produces strings like "the best form
   * of quarterly", and an ungrammatical control does not measure a
   * same-size edit, it measures whatever the model does with broken
   * syntax. Where the predicate is longer, no matched edit is offered
   * and the inserted-modifier control carries the comparison.
   */
  predicateIdx: number;
  /** Last content word, used for the antonym lookup. */
  lastIdx: number;
}

/**
 * Locate the auxiliary and, where there is one, the single-word
 * predicate. Deliberately shallow: a parser that silently half-works on
 * sentence shapes it does not understand would emit controls that look
 * fine and measure nothing.
 */
function parse(statement: string): Parsed {
  const words = tokens(statement);
  let auxIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (AUXILIARIES.has(stripPunct(words[i]).toLowerCase())) {
      auxIdx = i;
      break;
    }
  }
  const lastIdx = words.length - 1;
  if (auxIdx === -1 || auxIdx === lastIdx) {
    return { words, auxIdx: -1, isCopula: false, predicateIdx: -1, lastIdx };
  }
  const isCopula = COPULAS.has(stripPunct(words[auxIdx]).toLowerCase());
  // A one-word predicate is exactly the case auxIdx === lastIdx - 1.
  const predicateIdx = isCopula && auxIdx === lastIdx - 1 ? lastIdx : -1;
  return { words, auxIdx, isCopula, predicateIdx, lastIdx };
}

/**
 * Antonym from the lexicon only.
 *
 * Prefix derivation was tried and produced "ungovernment" and
 * "unhumans" on the standard batteries. A control the reader has to
 * discount is not a control, so where the word is not listed no antonym
 * is offered and the family reports that the comparison was
 * unavailable.
 */
function lexicalAntonym(word: string): string | null {
  return ANTONYMS[word.toLowerCase()] ?? null;
}

/** Pick n predicates from the pool, preferring similar character length. */
function matchedPredicates(original: string, n: number): string[] {
  const target = stripPunct(original).length;
  return [...NEUTRAL_PREDICATES]
    .filter(p => p.toLowerCase() !== stripPunct(original).toLowerCase())
    .sort((a, b) => Math.abs(a.length - target) - Math.abs(b.length - target))
    .slice(0, n);
}

function replaceAt(words: string[], idx: number, replacement: string): string {
  const out = [...words];
  out[idx] = replacement + trailingPunct(words[idx]);
  return out.join(" ");
}

function insertAt(words: string[], idx: number, inserted: string): string {
  const out = [...words];
  out.splice(idx, 0, inserted);
  return out.join(" ");
}

export interface ProbeFamilyOptions {
  /** Override the negation, e.g. when the rule-based form reads badly. */
  negation?: string;
  /** How many matched-edit controls to generate. Default 3. */
  matchedEditCount?: number;
  /** How many inserted-modifier controls to generate. Default 2. */
  modifierCount?: number;
}

/**
 * Build the full probe family for a statement.
 *
 * Where the sentence has no locatable copula the structural controls
 * cannot be generated and the family comes back with the negation and
 * whatever controls remain possible. Callers should check
 * controls.length rather than assuming a fixed set.
 */
export function buildProbeFamily(
  statement: string,
  options: ProbeFamilyOptions = {}
): ProbeFamily {
  const trimmed = statement.trim();
  const negText = options.negation?.trim() || generateNegation(trimmed);
  const negation: Control = {
    kind: "negation",
    text: negText,
    editDistance: tokenEditDistance(trimmed, negText),
    confident: true,
    note: options.negation ? "user-supplied" : "rule-generated",
  };

  const { words, auxIdx, isCopula, predicateIdx, lastIdx } = parse(trimmed);
  const controls: Control[] = [];

  // Inserted modifier: the same edit the negation makes, in the same
  // position, without the reversal. Available for any sentence with an
  // auxiliary, including modals, which is why it carries the comparison
  // where the predicate cannot be substituted.
  if (auxIdx !== -1) {
    const modifierCount = options.modifierCount ?? 2;
    for (const mod of NEUTRAL_MODIFIERS.slice(0, modifierCount)) {
      const text = insertAt(words, auxIdx + 1, mod);
      controls.push({
        kind: "insertedModifier",
        text,
        editDistance: tokenEditDistance(trimmed, text),
        confident: true,
        note: `inserted "${mod}" where the negation inserts "not"`,
      });
    }
  }

  if (predicateIdx !== -1) {
    const head = stripPunct(words[predicateIdx]);
    for (const sub of matchedPredicates(head, options.matchedEditCount ?? 3)) {
      const text = replaceAt(words, predicateIdx, sub);
      controls.push({
        kind: "matchedEdit",
        text,
        editDistance: tokenEditDistance(trimmed, text),
        confident: true,
        note: `"${head}" replaced with "${sub}"`,
      });
    }
  }

  // The antonym targets the last word wherever it is listed, so
  // "Revolution is sometimes necessary" still gets its antonym even
  // though its predicate is too long to substitute.
  if (lastIdx >= 0) {
    const head = stripPunct(words[lastIdx]);
    const anto = lexicalAntonym(head);
    if (anto) {
      const antoText = replaceAt(words, lastIdx, anto);
      controls.push({
        kind: "antonym",
        text: antoText,
        editDistance: tokenEditDistance(trimmed, antoText),
        confident: true,
        note: `lexical antonym of "${head}"`,
      });
    }
  }

  if (auxIdx !== -1 && isCopula) {
    const stem = words.slice(0, auxIdx + 1).join(" ");
    for (const pred of UNRELATED_PREDICATES.slice(0, 1)) {
      const text = `${stem} ${pred}`;
      controls.push({
        kind: "unrelatedPredicate",
        text,
        editDistance: tokenEditDistance(trimmed, text),
        confident: true,
        note: "subject held, predicate changed entirely",
      });
    }
  }

  return { statement: trimmed, negation, controls };
}

/** Every text a probe family needs embedded, original first. */
export function probeFamilyTextList(family: ProbeFamily): string[] {
  return [family.statement, family.negation.text, ...family.controls.map(c => c.text)];
}

/** Display label for a control kind. */
export const CONTROL_LABELS: Record<ControlKind, string> = {
  negation: "Negation",
  insertedModifier: "Inserted modifier",
  matchedEdit: "Matched edit",
  antonym: "Antonym",
  unrelatedPredicate: "Unrelated predicate",
};

/** Glossary key for a control kind, for tooltips. */
export const CONTROL_GLOSSARY_KEYS: Record<ControlKind, string> = {
  negation: "exceedsControls",
  insertedModifier: "matchedEdit",
  matchedEdit: "matchedEdit",
  antonym: "antonymControl",
  unrelatedPredicate: "unrelatedPredicate",
};

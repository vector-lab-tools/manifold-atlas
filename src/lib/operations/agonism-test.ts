/**
 * Agonism Test — pure compute.
 *
 * Measures whether the manifold preserves genuine philosophical
 * opposition between paired claims, or collapses it into proximity.
 * Low cosine similarity = opposition preserved; high = geometric
 * collapse of antagonism.
 *
 * Pre-built pairs are exported as AGONISM_PAIRS so protocols can
 * reference them by preset name.
 */

import { cosineSimilarity } from "@/lib/geometry/cosine";
import { EMBEDDING_MODELS } from "@/types/embeddings";

/**
 * Thematic grouping for the canonical agonism set. Lets users (and
 * protocols) run a coherent subset — e.g. just the economics pairs,
 * just the metaphysics pairs — rather than the whole 24 every time.
 * Single primary theme per pair; some pairs straddle (Habermas/
 * Foucault is both power-and-knowledge and critical theory) but the
 * assignment names the dominant register.
 */
export type AgonismTheme =
  | "Political theory"
  | "Critical theory"
  | "Economics & property"
  | "Power & knowledge"
  | "Ethics & phenomenology"
  | "Metaphysics & truth"
  | "Language & subject"
  | "Race & identity";

export const AGONISM_THEMES: AgonismTheme[] = [
  "Political theory",
  "Critical theory",
  "Economics & property",
  "Power & knowledge",
  "Ethics & phenomenology",
  "Metaphysics & truth",
  "Language & subject",
  "Race & identity",
];

export interface AgonismPair {
  label: string;
  positionA: { thinker: string; quote: string };
  positionB: { thinker: string; quote: string };
  /**
   * Primary thematic register for filtering. Optional because user-
   * supplied custom pairs don't carry a theme — only the canonical
   * AGONISM_PAIRS set is themed. agonismPairsByTheme() filters by
   * exact match, so themeless pairs simply never appear in a filtered
   * subset (but always appear in "All").
   */
  theme?: AgonismTheme;
}

export const AGONISM_PAIRS: AgonismPair[] = [
  {
    label: "Class struggle vs social order",
    positionA: { thinker: "Marx", quote: "The history of all hitherto existing society is the history of class struggles" },
    positionB: { thinker: "Burke", quote: "Society is a contract between the living, the dead, and those yet to be born, requiring preservation of established order" },
    theme: "Political theory",
  },
  {
    label: "The system vs the individual",
    positionA: { thinker: "Hegel", quote: "The rational is actual and the actual is rational, truth is found in the whole system" },
    positionB: { thinker: "Kierkegaard", quote: "The crowd is untruth, truth can only be found by the individual standing alone before existence" },
    theme: "Metaphysics & truth",
  },
  {
    label: "Property as theft vs property as foundation",
    positionA: { thinker: "Proudhon", quote: "Property is theft, the exploitation of the weak by the strong" },
    positionB: { thinker: "Locke", quote: "Every man has a property in his own person, and the labour of his body and the work of his hands are properly his" },
    theme: "Economics & property",
  },
  {
    label: "The political as agonism vs the political as friend-enemy",
    positionA: { thinker: "Arendt", quote: "The meaning of politics is freedom, the capacity to begin something new through action in the public sphere" },
    positionB: { thinker: "Schmitt", quote: "The specific political distinction to which political actions and motives can be reduced is that between friend and enemy" },
    theme: "Political theory",
  },
  {
    label: "Reason as emancipation vs reason as domination",
    positionA: { thinker: "Habermas", quote: "The unforced force of the better argument is the foundation of democratic discourse and rational consensus" },
    positionB: { thinker: "Adorno & Horkheimer", quote: "Enlightenment, understood in the widest sense as the advance of thought, has always aimed at liberating human beings from fear and installing them as masters, but the wholly enlightened earth is radiant with triumphant calamity" },
    theme: "Critical theory",
  },
  {
    label: "Existence precedes essence vs essence precedes existence",
    positionA: { thinker: "Sartre", quote: "Existence precedes essence, man first of all exists, encounters himself, surges up in the world, and defines himself afterwards" },
    positionB: { thinker: "Plato", quote: "The soul existed before the body, and the Forms are eternal, unchanging realities that precede and ground all particular existence" },
    theme: "Metaphysics & truth",
  },
  {
    label: "Knowledge as power vs knowledge as truth",
    positionA: { thinker: "Foucault", quote: "Knowledge is not made for understanding, it is made for cutting, power and knowledge directly imply one another" },
    positionB: { thinker: "Aristotle", quote: "All men by nature desire to know, and the pursuit of knowledge for its own sake is the highest human activity" },
    theme: "Power & knowledge",
  },
  {
    label: "The state as instrument of class rule vs the state as social contract",
    positionA: { thinker: "Lenin", quote: "The state is an organ of class rule, an organ for the oppression of one class by another" },
    positionB: { thinker: "Rousseau", quote: "The social contract establishes a form of association which defends and protects with the whole common force the person and goods of each associate" },
    theme: "Political theory",
  },
  // ────────────────────────────────────────────────────────────────
  // Expanded set (14 May 2026). Broader coverage of philosophical and
  // political-theoretical agonisms: justice, democracy, recognition,
  // race, phenomenology, aesthetics, power, history, language, ethics,
  // technology, modernity, economics, truth, subject, liberty. The
  // labels and quotes are concise paraphrases of each thinker's
  // canonical position, chosen so the lexical fields of the two poles
  // are plausibly distinct without being engineered for separation.
  // ────────────────────────────────────────────────────────────────
  {
    label: "Justice as fairness vs justice as entitlement",
    positionA: { thinker: "Rawls", quote: "Justice is the first virtue of social institutions: a fair distribution of primary goods is what rational persons behind a veil of ignorance would agree to" },
    positionB: { thinker: "Nozick", quote: "Whatever arises from a just situation by just steps is itself just; redistribution by the state violates the entitlement of holdings legitimately acquired" },
    theme: "Political theory",
  },
  {
    label: "Deliberative democracy vs agonistic democracy",
    positionA: { thinker: "Habermas", quote: "Democratic legitimacy rests on procedures of rational deliberation aimed at consensus among free and equal citizens" },
    positionB: { thinker: "Mouffe", quote: "The political consists in the ineradicability of antagonism; democratic politics must channel conflict into agonistic contestation rather than eliminate it through consensus" },
    theme: "Political theory",
  },
  {
    label: "Recognition vs redistribution",
    positionA: { thinker: "Honneth", quote: "Struggles for social justice are at their deepest struggles for recognition: the demand to be acknowledged as a person of equal moral standing" },
    positionB: { thinker: "Fraser", quote: "Injustice is rooted in the political economy of distribution; cultural recognition without material redistribution leaves the structural sources of inequality untouched" },
    theme: "Critical theory",
  },
  {
    label: "Double consciousness vs accommodation",
    positionA: { thinker: "Du Bois", quote: "One ever feels his twoness, an American, a Negro, two souls, two thoughts, two unreconciled strivings warring in one dark body" },
    positionB: { thinker: "Washington", quote: "No race can prosper till it learns that there is as much dignity in tilling a field as in writing a poem; advance comes through industry and accommodation rather than agitation" },
    theme: "Race & identity",
  },
  {
    label: "Being-toward-death vs the face of the Other",
    positionA: { thinker: "Heidegger", quote: "Authentic existence is the resolute being-toward-death that wrests Dasein from its lostness in the they and gives it back to itself" },
    positionB: { thinker: "Levinas", quote: "Ethics precedes ontology: the face of the Other commands me before any concern for my own being, the infinite responsibility for the other is the originary scene" },
    theme: "Ethics & phenomenology",
  },
  {
    label: "Autonomy of art vs art in the age of reproduction",
    positionA: { thinker: "Adorno", quote: "The autonomous artwork's irreconcilability with the empirical world is its truth content; the moment it accommodates itself to mass culture it forfeits its critical force" },
    positionB: { thinker: "Benjamin", quote: "Mechanical reproduction emancipates the work of art from its parasitical dependence on ritual, opening politics of art rather than aestheticised politics" },
    theme: "Critical theory",
  },
  {
    label: "Communicative reason vs disciplinary power",
    positionA: { thinker: "Habermas", quote: "Communicative action oriented toward mutual understanding is a fundamental capacity of human language that grounds democratic legitimation" },
    positionB: { thinker: "Foucault", quote: "Power is not held but exercised; it operates through capillary networks of discipline, normalisation, and biopolitical regulation that produce subjects rather than repress them" },
    theme: "Power & knowledge",
  },
  {
    label: "Progress vs jetztzeit",
    positionA: { thinker: "Hegel", quote: "World history is the progress of the consciousness of freedom; the rational unfolds itself in time toward its self-actualisation in the modern state" },
    positionB: { thinker: "Benjamin", quote: "History is not a homogeneous empty time of progress but a constellation pregnant with tensions, redeemable only by blasting open the continuum and seizing the moment of jetztzeit" },
    theme: "Critical theory",
  },
  {
    label: "Forms of life vs différance",
    positionA: { thinker: "Wittgenstein", quote: "To imagine a language is to imagine a form of life; meaning is use within a public practice, not an inner mental object referred to by a private sign" },
    positionB: { thinker: "Derrida", quote: "There is nothing outside the text; meaning is endlessly deferred along a chain of differences, never fully present, always already inhabited by its other" },
    theme: "Language & subject",
  },
  {
    label: "Categorical imperative vs greatest happiness",
    positionA: { thinker: "Kant", quote: "Act only according to that maxim by which you can at the same time will that it should become a universal law; the moral worth of an action lies in the rational will, not in its consequences" },
    positionB: { thinker: "Mill", quote: "Actions are right in proportion as they tend to promote happiness, wrong as they tend to produce the reverse; utility is the foundation of morals" },
    theme: "Ethics & phenomenology",
  },
  {
    label: "Technology as enframing vs technology as liberation",
    positionA: { thinker: "Heidegger", quote: "The essence of modern technology is enframing, a mode of revealing that reduces nature and human beings alike to standing reserve, calculable resources awaiting use" },
    positionB: { thinker: "Marcuse", quote: "Technology is in itself no fate; the same productive forces that enslave under capital could, if liberated from the imperatives of domination, ground a pacified existence" },
    theme: "Critical theory",
  },
  {
    label: "Modernity as incomplete project vs incredulity toward metanarratives",
    positionA: { thinker: "Habermas", quote: "Modernity is an unfinished project; the rational potentials of the Enlightenment have not been exhausted but corrupted, and the task is to redeem them through procedural rationality" },
    positionB: { thinker: "Lyotard", quote: "I define postmodern as incredulity toward metanarratives; the grand narratives of emancipation and speculative dialectic have lost their credibility in the wake of late capitalism" },
    theme: "Critical theory",
  },
  {
    label: "Free market vs the great transformation",
    positionA: { thinker: "Hayek", quote: "The spontaneous order of the market coordinates dispersed knowledge through prices; deliberate central planning is incapable of matching its informational efficiency and inevitably tends to coercion" },
    positionB: { thinker: "Polanyi", quote: "The idea of a self-regulating market is a stark utopia; markets disembedded from social relations produce dislocation, and society protects itself through countermovements of social legislation and protectionism" },
    theme: "Economics & property",
  },
  {
    label: "Will to power vs Platonic Forms",
    positionA: { thinker: "Nietzsche", quote: "Truths are illusions of which one has forgotten that they are illusions; the will to power is the only reality, perspectives interpret each other without ever reaching a ground" },
    positionB: { thinker: "Plato", quote: "The Forms are eternal, changeless, and intelligible; sensible particulars participate in them imperfectly, and philosophy is the ascent from appearance to the reality of the Good" },
    theme: "Metaphysics & truth",
  },
  {
    label: "Sovereign subject vs split subject",
    positionA: { thinker: "Descartes", quote: "I think, therefore I am: the cogito is the indubitable foundation of certainty, a transparent self-presence on which the edifice of knowledge can be built" },
    positionB: { thinker: "Lacan", quote: "The subject is not master in its own house; the unconscious is structured like a language, and the I is constituted in the field of the Other through the mirror stage and the symbolic order" },
    theme: "Language & subject",
  },
  {
    label: "Liberty as non-interference vs liberty as non-domination",
    positionA: { thinker: "Berlin", quote: "Negative liberty is the area within which a man can act unobstructed by others; the larger the area of non-interference, the wider one's liberty" },
    positionB: { thinker: "Pettit", quote: "Liberty consists in non-domination, in not being subject to the arbitrary power of another; a person dependent on the goodwill of a master is unfree even when the master happens to be benevolent" },
    theme: "Political theory",
  },
];

/** Return the subset of AGONISM_PAIRS in a given theme, or the full
 * set when theme is "All". */
export function agonismPairsByTheme(theme: AgonismTheme | "All"): AgonismPair[] {
  if (theme === "All") return AGONISM_PAIRS;
  return AGONISM_PAIRS.filter(p => p.theme === theme);
}

/**
 * Below this cosine similarity, opposition is considered preserved.
 * Above, the manifold has collapsed the antagonism into proximity.
 */
export const DEFAULT_AGONISM_THRESHOLD = 0.7;

export interface AgonismTestInputs {
  /** Override the built-in pair set. */
  pairs?: AgonismPair[];
  /**
   * Preset name. Currently "all" (equivalent to the full AGONISM_PAIRS
   * set) or a comma-separated list of labels to filter. Omit to use
   * the full preset.
   */
  preset?: string;
  threshold?: number;
}

export interface AgonismModelResult {
  modelId: string;
  modelName: string;
  similarity: number;
  agonismPreserved: boolean;
}

export interface AgonismPairResult {
  pair: AgonismPair;
  models: AgonismModelResult[];
}

export interface AgonismTestResult {
  threshold: number;
  pairs: AgonismPairResult[];
  summary: {
    totalPairs: number;
    totalTests: number;
    preservedCount: number;
    preservedRate: number; // 0..1
    avgSimilarity: number;
  };
}

/**
 * Resolve the pairs for a protocol step. Returns the full AGONISM_PAIRS
 * set unless a comma-separated list of labels is supplied in `preset`,
 * in which case only matching labels are included.
 */
export function resolveAgonismPairs(
  inputs: AgonismTestInputs
): AgonismPair[] {
  if (inputs.pairs && inputs.pairs.length > 0) return inputs.pairs;
  if (!inputs.preset || inputs.preset === "all") return AGONISM_PAIRS;
  const requested = inputs.preset
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
  const matching = AGONISM_PAIRS.filter(p =>
    requested.some(r => p.label.toLowerCase().includes(r))
  );
  return matching.length > 0 ? matching : AGONISM_PAIRS;
}

/**
 * Flat text list: [A0.quote, B0.quote, A1.quote, B1.quote, ...].
 */
export function agonismTestTextList(inputs: AgonismTestInputs): string[] {
  const pairs = resolveAgonismPairs(inputs);
  const texts: string[] = [];
  for (const pair of pairs) {
    texts.push(pair.positionA.quote, pair.positionB.quote);
  }
  return texts;
}

export function computeAgonismTest(
  inputs: AgonismTestInputs,
  modelVectors: Map<string, number[][]>,
  enabledModels: Array<{ id: string; name: string; providerId: string }>
): AgonismTestResult {
  const pairs = resolveAgonismPairs(inputs);
  const threshold = inputs.threshold ?? DEFAULT_AGONISM_THRESHOLD;

  const pairResults: AgonismPairResult[] = pairs.map((pair, i) => {
    const models: AgonismModelResult[] = enabledModels
      .filter(m => modelVectors.has(m.id))
      .map(m => {
        const vectors = modelVectors.get(m.id)!;
        const sim = cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]);
        const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
        return {
          modelId: m.id,
          modelName: spec?.name || m.name || m.id,
          similarity: sim,
          agonismPreserved: sim < threshold,
        };
      });

    return { pair, models };
  });

  let totalTests = 0;
  let preservedCount = 0;
  let simSum = 0;
  let perPairAvgSum = 0;
  for (const row of pairResults) {
    if (row.models.length === 0) continue;
    totalTests += row.models.length;
    for (const m of row.models) {
      if (m.agonismPreserved) preservedCount += 1;
      simSum += m.similarity;
    }
    perPairAvgSum += row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
  }
  const preservedRate = totalTests > 0 ? preservedCount / totalTests : 0;
  const avgSimilarity = pairResults.length > 0 ? perPairAvgSum / pairResults.length : 0;

  return {
    threshold,
    pairs: pairResults,
    summary: {
      totalPairs: pairResults.length,
      totalTests,
      preservedCount,
      preservedRate,
      avgSimilarity,
    },
  };
}

export function agonismTestHeadline(
  result: AgonismTestResult
): Record<string, number | string> {
  return {
    pairs: result.summary.totalPairs,
    "opposition preserved": `${(result.summary.preservedRate * 100).toFixed(1)}%`,
    "avg cosine": Number(result.summary.avgSimilarity.toFixed(4)),
    "threshold": result.threshold,
    "most collapsed": mostCollapsedLabel(result),
  };
}

function mostCollapsedLabel(result: AgonismTestResult): string {
  if (result.pairs.length === 0) return "-";
  let worst = result.pairs[0];
  let worstAvg = -Infinity;
  for (const row of result.pairs) {
    if (row.models.length === 0) continue;
    const avg = row.models.reduce((s, m) => s + m.similarity, 0) / row.models.length;
    if (avg > worstAvg) {
      worstAvg = avg;
      worst = row;
    }
  }
  return worst.pair.label;
}

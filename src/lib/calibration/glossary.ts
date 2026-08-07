/**
 * Canonical definitions for every calibration and radius term.
 *
 * One definition per term, in one place, so the tooltip in the
 * Calibration panel, the hover on a Negation Gauge row, the Deep Dive
 * heading and the exported caption all say the same thing. A metric
 * whose definition drifts between two places in the interface is a
 * metric the reader cannot check.
 *
 * Each entry carries:
 *   short   one line, for a hover tip and for table headers
 *   full    two or three sentences, for the help panel
 *   formula plain-text formula where there is one
 *   reads   how to read a value, so the number is actionable
 */

export interface GlossaryEntry {
  term: string;
  short: string;
  full: string;
  formula?: string;
  reads?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  floor: {
    term: "Anisotropy floor",
    short: "Mean cosine between two unrelated texts in this model. The bottom of the scale.",
    full:
      "Embedding vectors do not spread over the whole sphere. They cluster in a narrow cone, so two texts with nothing in common already sit at a high cosine. The floor is that starting value, measured by embedding a corpus of unrelated sentences and taking every pairwise cosine. It differs from model to model, which is why a raw cosine cannot be compared across models without it.",
    formula: "mean cosine over all pairs in the calibration corpus",
    reads:
      "A floor of 0.15 leaves most of the cosine scale in play. A floor of 0.70 means almost everything you will ever measure lands between 0.70 and 1.00.",
  },

  floorSd: {
    term: "Floor spread",
    short: "Standard deviation of the unrelated-pair cosines.",
    full:
      "The floor is a distribution, not a point. This is its standard deviation, and it sets how large a difference has to be before it is distinguishable from the background. It is also the unit for the z figure reported next to each measurement.",
    reads: "A wide spread means small differences in cosine carry little information.",
  },

  coneHalfAngle: {
    term: "Cone half-angle (radius)",
    short: "The angular radius of the region the model actually uses, in degrees.",
    full:
      "Writing each unit vector as a rotation away from the mean direction, the average of those angles is the half-angle of the cone the embeddings occupy. It is computed as the arc-cosine of the length of the mean of the unit vectors. This is the model's radius in the sense the term is usually meant: how much angular room the space has.",
    formula: "acos( ‖ mean of the unit vectors ‖ )",
    reads:
      "90° would be an isotropic space using the full sphere. 60° is a moderately tight cone. Below 45° the model is working in a narrow wedge, and cosine differences there are compressed.",
  },

  meanDirectionNorm: {
    term: "Mean direction length",
    short: "Length of the average unit vector, from 0 (isotropic) to 1 (all identical), corrected for sample size.",
    full:
      "Normalise every calibration vector to unit length, average them, and measure the length of the result. If the vectors pointed in all directions the average would cancel to near zero. The further this sits above zero, the tighter the cone. The raw average of n unit vectors has squared length 1/n even in a perfectly isotropic space, so the value shown is corrected for that bias; without the correction a sixty-text sample could never report a cone wider than about 83 degrees.",
    formula: "E[cos] = (‖mean‖² − 1/n) / (1 − 1/n)",
    reads: "Its square is the implied floor. Compare that against the measured floor: a large gap means the corpus strata are not homogeneous.",
  },

  usableRange: {
    term: "Usable range",
    short: "How much of the cosine scale this model can actually reach.",
    full:
      "Cosine is nominally bounded by -1 and 1, but nothing in an anisotropic space goes below the floor. The reachable interval is floor to 1, and its width is the usable range. Differences in cosine should be read as a proportion of this, not of the nominal scale.",
    formula: "1 − floor",
    reads:
      "With a usable range of 0.25, a cosine gap of 0.03 is an eighth of everything the instrument can register. With a range of 0.86, the same gap is minor.",
  },

  angularRange: {
    term: "Angular range",
    short: "The largest angular separation any two texts can show, in degrees.",
    full:
      "The arc-cosine of the floor. Reporting an angle between two embeddings against an implied 0 to 180 degree scale is misleading, because no pair of real texts ever approaches 180 degrees in these spaces. This is the real denominator.",
    formula: "acos(floor)",
    reads: "An angular range of 82° means a measured separation of 30° is roughly a third of what is available.",
  },

  effectiveDim: {
    term: "Effective dimension",
    short: "How many dimensions the corpus variance is spread across, against the ceiling this sample size allows.",
    full:
      "The participation ratio of the covariance spectrum: the square of the sum of the eigenvalues over the sum of their squares. It counts directions weighted by how much variance each carries, so a nominally 1536-dimensional model whose variance concentrates in a few directions reports a much smaller number. Computed from matrix traces rather than an eigendecomposition, so it is exact and fast. It is also sample-limited, which is why the ceiling is reported next to it.",
    formula: "(Σλ)² / Σλ²",
    reads:
      "Compare against the ceiling, not against the nominal dimension. A few hundred texts cannot show more spread than the ceiling allows however isotropic the model is, so a value at the ceiling means the sample is saturated rather than the space being fully used.",
  },

  effectiveDimCeiling: {
    term: "Spectrum ceiling",
    short: "The largest effective dimension this many texts could produce, even from an isotropic space.",
    full:
      "The sample covariance of a few hundred texts in a thousand-plus dimensions follows the Marchenko-Pastur law, whose participation ratio is d/(1+d/m) rather than d. With 160 texts and 1536 dimensions the ceiling is around 145, so an observed value near 145 carries no information about concentration at all. Reported so that the effective dimension can be read as a measurement rather than as an artefact of corpus size.",
    formula: "d / (1 + d/m), m = sample size − 1",
  },

  dimensionEfficiency: {
    term: "Dimension efficiency",
    short: "Effective dimension as a fraction of the ceiling this sample size allows.",
    full:
      "Effective dimension divided by the spectrum ceiling, in zero to one. One means the corpus is as spread as this many texts could show. A low value means the variance is genuinely concentrated in few directions, which is a fact about the model rather than about the corpus.",
    formula: "effective dim / spectrum ceiling",
    reads: "Below about 0.3, the model is packing its variance into a small subspace and cosine is largely a report on that subspace.",
  },

  topDimShare: {
    term: "Dominant coordinate share",
    short: "Variance share of the single largest coordinate. High values indicate rogue dimensions.",
    full:
      "Sentence embedding spaces often have a handful of coordinates with outsized magnitude that dominate every dot product. Where one coordinate carries a large share of the variance, cosine similarity is substantially a report on that one coordinate rather than on the whole representation.",
    reads:
      "Under about 0.05 is unremarkable. Above 0.20 means a single coordinate is driving a large part of every similarity the tool reports.",
  },

  norms: {
    term: "Vector norm",
    short: "Length of the returned vectors, before normalisation.",
    full:
      "Some providers return L2-normalised vectors and some do not. Where norms vary, cosine similarity is discarding magnitude that the model is using, and any operation reading cosine alone is working with part of the output. Reported so the discarding is visible rather than assumed.",
    reads: "A coefficient of variation near zero means the provider normalises and no magnitude information is being lost.",
  },

  topicalCeiling: {
    term: "Topical ceiling",
    short: "Where two sentences on the same subject land, with nothing else in common.",
    full:
      "Pairs matched on subject but sharing no content words and no structure. This is the value that mere aboutness produces. A measurement below the ceiling is not registering anything beyond topic, and a measurement well above it is registering something more than topic, though not necessarily what the operation claims.",
    reads: "Read the floor and the ceiling as the band inside which any real result has to fall.",
  },

  normalisedPosition: {
    term: "Normalised position",
    short: "Where a cosine sits on the floor-to-identity scale, from 0 to 1.",
    full:
      "The measured cosine minus the floor, over one minus the floor. Zero means the pair is no closer than two unrelated texts in this model; one means identity. This is the figure to quote when comparing models, because raw cosines from models with different floors are not the same measurement.",
    formula: "(cos − floor) / (1 − floor)",
    reads: "A negation at 0.87 of the floor-to-identity range has moved 13% of the distance the model can express.",
  },

  floorZ: {
    term: "z above floor",
    short: "Standard deviations above the unrelated-pair mean.",
    full:
      "How far a measurement sits above the floor, in units of the floor's own spread. Useful for asking whether a value is distinguishable from background at all, but not a collapse criterion: almost any pair sharing vocabulary sits many standard deviations above a random-pair floor.",
    formula: "(cos − floor mean) / floor sd",
  },

  matchedEdit: {
    term: "Matched edit control",
    short: "Same sentence, one word changed, no reversal of truth conditions.",
    full:
      "The predicate is replaced with an unrelated one of similar length and frequency, giving an edit the same size as the negation but without the logical reversal. If the negation sits at the same cosine as these, the measurement is reporting lexical overlap. If it sits higher, the geometry is treating a contradiction as closer than a change of predicate, which is the stronger claim and is not dismissible as a token-count artefact.",
    reads: "This is the control the collapse threshold should be derived from.",
  },

  antonymControl: {
    term: "Antonym control",
    short: "Opposition carried by the word rather than by a negation particle.",
    full:
      "The predicate is replaced with its lexical antonym, so the sentence is opposed in meaning without any negation operator. Separates two hypotheses that a bare negation cosine leaves tangled: whether the model fails on opposition of any kind, or specifically on syntactic negation while handling lexical antonymy adequately.",
    reads: "A large gap between the negation and the antonym points at the negation operator specifically.",
  },

  unrelatedPredicate: {
    term: "Unrelated predicate control",
    short: "Same subject, entirely different predicate. A per-probe topical ceiling.",
    full:
      "The subject is held and the predicate replaced with something on a different matter altogether. Gives the topical ceiling for this particular sentence rather than for the corpus as a whole, which is the tighter comparison.",
  },

  thresholdMode: {
    term: "Collapse threshold",
    short: "How the cutoff for reporting collapse is chosen.",
    full:
      "Fixed uses a stipulated constant, which is the original behaviour and is retained only for reproducing earlier runs. Floor-relative places the cutoff at a fixed proportion of the floor-to-identity range, so it adapts to the model but is still stipulated. Control-derived places it at the matched-edit control for that specific probe, so the cutoff is measured rather than chosen.",
    reads: "Control-derived is the defensible setting. The other two are there for comparison and for reproducing older results.",
  },

  exceedsControls: {
    term: "Exceeds controls",
    short: "The negation is closer to the original than every non-negating edit of the same size.",
    full:
      "True when the negation's cosine is at or above all of the matched-edit controls. This is the finding that cannot be explained by token overlap, because the controls share the same number of changed tokens. It is the strong form of the collapse claim.",
  },

  uncalibrated: {
    term: "Uncalibrated",
    short: "No baseline has been measured for this model, so cosines have no scale.",
    full:
      "Results are still computed and shown, but the bands and thresholds fall back to stipulated constants and the reported position has no measured origin. Run a calibration for this model to replace the constants with measurements.",
  },
};

/** Look up an entry, returning undefined rather than throwing on a typo. */
export function glossary(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

/** Compact tooltip text: one line, plus the formula where there is one. */
export function tipText(key: string): string {
  const e = GLOSSARY[key];
  if (!e) return "";
  return e.formula ? `${e.term}. ${e.short}\n\n${e.formula}` : `${e.term}. ${e.short}`;
}

/**
 * Hegemony Compass presets and default concepts.
 * Edit this file to add new compasses or modify existing ones.
 */

export interface CompassAxis {
  negative: { label: string; terms: string[] };
  positive: { label: string; terms: string[] };
}

export interface CompassPreset {
  name: string;
  xAxis: CompassAxis;
  yAxis: CompassAxis;
  defaults: string[];
}

// Shared axes for the thinker compasses
const THINKERS_X_AXIS: CompassAxis = {
  negative: { label: "Theoretical", terms: [
    "Knowledge is best pursued through abstract reasoning and conceptual analysis",
    "Pure mathematics reveals truths about the structure of reality itself",
    "Philosophy provides the foundations upon which all other disciplines rest",
    "Theoretical frameworks are necessary before empirical investigation can begin",
    "The most important questions cannot be answered by experiment alone",
    "Formal logic is the highest form of rigorous thought",
    "Speculative thinking opens possibilities that empiricism forecloses",
    "The history of ideas is the deepest history there is",
  ] },
  positive: { label: "Applied", terms: [
    "Knowledge is only valuable when it can be put to practical use",
    "Engineering and technology solve real problems that theory cannot",
    "Empirical observation is the only reliable source of knowledge",
    "Building working systems teaches you more than reading about them",
    "The value of a theory is measured by its predictive power",
    "Practical implementation reveals flaws that abstract reasoning misses",
    "Applied science has improved more lives than philosophy ever has",
    "The point is not to understand the world but to change it",
  ] },
};

const THINKERS_Y_AXIS: CompassAxis = {
  negative: { label: "Humanist", terms: [
    "Human meaning and values cannot be reduced to formal systems",
    "Ethics and justice are the central questions of intellectual life",
    "The purpose of thought is human emancipation and flourishing",
    "Culture, language, and history shape all forms of knowledge",
    "Individual human experience is irreducible to mathematical description",
    "Political philosophy is essential to understanding power and freedom",
    "Interpretation and hermeneutics are as rigorous as measurement",
    "The humanities provide understanding that science alone cannot achieve",
  ] },
  positive: { label: "Formalist", terms: [
    "Mathematical formalisation is the pinnacle of intellectual achievement",
    "Computation and algorithms can in principle model any process",
    "Physical laws described in equations are the deepest truths we know",
    "Intelligence is fundamentally a computational process that can be replicated",
    "Formal systems and axiomatics provide certainty that natural language cannot",
    "The universe is ultimately mathematical in its structure",
    "Machine intelligence will surpass human reasoning in all domains",
    "Logic and proof are more trustworthy than intuition and judgement",
  ] },
};

export const COMPASS_PRESETS: Record<string, CompassPreset> = {
  "Political Compass": {
    name: "Political Compass",
    defaults: ["democracy", "freedom", "sovereignty", "revolution", "capitalism"],
    xAxis: {
      negative: { label: "Economic Left", terms: [
        "Wealth should be redistributed from the rich to the poor",
        "The means of production should be collectively owned by workers",
        "Universal public services like healthcare and education are a right",
        "Strong labour unions are essential to protect workers from exploitation",
        "The government should regulate corporations to prevent abuse",
        "Economic equality is more important than economic growth",
        "The commons belong to everyone and should not be enclosed",
        "Solidarity between working people is the basis of a just society",
        "Austerity policies harm the most vulnerable members of society",
      ] },
      positive: { label: "Economic Right", terms: [
        "The free market is the most efficient mechanism for allocating resources",
        "Privatisation of public services improves quality and reduces cost",
        "Government regulation stifles economic growth and innovation",
        "Individual enterprise and entrepreneurship drive prosperity",
        "Competition between businesses benefits consumers",
        "Private property rights are the foundation of a free society",
        "Profit is the best measure of value creation",
        "Taxes should be kept as low as possible to encourage investment",
        "Shareholders have the primary claim on a company's earnings",
      ] },
    },
    yAxis: {
      negative: { label: "Libertarian", terms: [
        "Individual freedom is the highest political value",
        "Civil liberties must never be sacrificed for security",
        "People should be free to live as they choose without state interference",
        "Power should be decentralised to local communities",
        "Privacy is a fundamental human right that must be protected",
        "Voluntary association is preferable to coerced participation",
        "Self-determination means the right to govern your own life",
        "A tolerant society accepts diverse ways of living",
        "Pluralism and diversity of opinion strengthen democracy",
      ] },
      positive: { label: "Authoritarian", terms: [
        "A strong state is necessary to maintain social order",
        "Hierarchy is natural and necessary for a functioning society",
        "Discipline and obedience are virtues that hold communities together",
        "Traditional values and institutions should be preserved and defended",
        "National security justifies restrictions on individual freedoms",
        "A shared national identity is essential for social cohesion",
        "Conformity to social norms is the price of civilisation",
        "Strong leadership is more effective than democratic deliberation",
        "The authority of the state should not be questioned lightly",
      ] },
    },
  },

  "Technology Compass": {
    name: "Technology Compass",
    defaults: ["artificial intelligence", "Wikipedia", "blockchain", "surveillance", "open source"],
    xAxis: {
      negative: { label: "Commons", terms: [
        "Software should be open source so anyone can inspect and modify it",
        "Knowledge is a public good that should be freely accessible to all",
        "Digital infrastructure should be collectively owned and governed",
        "Collective intelligence produces better outcomes than proprietary systems",
        "Shared platforms should be interoperable and not locked to one vendor",
        "Community ownership of technology prevents corporate exploitation",
        "Transparency in algorithms is necessary for democratic accountability",
        "Data generated by users belongs to the public, not to corporations",
      ] },
      positive: { label: "Proprietary", terms: [
        "Intellectual property protection is essential to incentivise innovation",
        "Trade secrets give companies a competitive advantage they deserve",
        "Platform ecosystems create value through integration and lock-in",
        "Proprietary data is the most valuable asset a technology company owns",
        "Closed source software is more secure and better maintained",
        "Subscription models provide sustainable revenue for ongoing development",
        "Walled gardens deliver a better user experience than open alternatives",
        "Companies that invest in research should own the results exclusively",
      ] },
    },
    yAxis: {
      negative: { label: "Human-centred", terms: [
        "Technology should enhance human agency, not replace it",
        "Human dignity must be preserved in the face of automation",
        "Informed consent is required before collecting personal data",
        "Accountability for technological harms must rest with humans, not systems",
        "People have the right to an explanation of decisions that affect them",
        "Care and empathy cannot be automated or replaced by machines",
        "Democratic participation should shape how technology is developed",
        "Embodied human experience is irreducible to data and computation",
      ] },
      positive: { label: "Techno-solutionist", terms: [
        "Automation of labour is an inevitable and desirable form of progress",
        "Optimisation through algorithms produces better outcomes than human judgement",
        "Efficiency gains from technology justify disruption to existing institutions",
        "Scaling technology solutions can solve the world's biggest problems",
        "Disruptive innovation is the primary driver of social improvement",
        "Accelerating technological development will solve problems faster than politics",
        "Artificial intelligence will eventually surpass human decision-making in all domains",
        "Algorithmic governance is more rational and fair than human administration",
      ] },
    },
  },

  "Knowledge Compass": {
    name: "Knowledge Compass",
    defaults: ["ethnography", "machine learning", "psychoanalysis", "randomised controlled trial", "deconstruction"],
    xAxis: {
      negative: { label: "Critical", terms: [
        "All knowledge is shaped by the power relations in which it is produced",
        "Ideology critique reveals how dominant ideas serve ruling interests",
        "Deconstruction shows that texts always contain contradictions and exclusions",
        "Knowledge is always situated in a particular social and historical position",
        "Reflexivity about the researcher's own position is methodologically essential",
        "The purpose of scholarship is emancipation from structures of domination",
        "Dialectical thinking reveals contradictions that positivism cannot see",
        "Historical context is necessary to understand any social phenomenon",
      ] },
      positive: { label: "Positivist", terms: [
        "Objective knowledge is achievable through rigorous scientific method",
        "Measurement and quantification are the foundations of reliable knowledge",
        "Scientific results must be replicable to be considered valid",
        "Hypotheses should be tested against empirical evidence and rejected if falsified",
        "Empirical evidence is the only legitimate basis for knowledge claims",
        "Quantification allows precise comparison and generalisable conclusions",
        "The purpose of science is to predict and control natural phenomena",
        "Falsifiability is what distinguishes science from ideology and opinion",
      ] },
    },
    yAxis: {
      negative: { label: "Particular", terms: [
        "Local knowledge developed over generations has validity that science often ignores",
        "Indigenous ways of knowing offer insights unavailable to Western science",
        "Lived experience is an irreplaceable source of knowledge about social reality",
        "Case studies reveal complexity that statistical generalisation obscures",
        "Ethnographic immersion is necessary to understand a culture from within",
        "Phenomenological description captures dimensions of experience that measurement misses",
        "Narrative is a legitimate and powerful form of knowledge production",
        "Context determines meaning, so decontextualised knowledge is always incomplete",
      ] },
      positive: { label: "Universal", terms: [
        "Scientific laws apply universally regardless of cultural context",
        "Theoretical abstraction is necessary to move beyond the merely particular",
        "Formal models capture the essential structure of complex phenomena",
        "Mathematical reasoning provides certainty that empirical observation cannot",
        "Universal principles of logic apply to all rational beings",
        "The goal of knowledge is to discover truths that hold everywhere and always",
        "Axioms and deductive systems are the most rigorous form of knowledge",
        "Generalisable findings are more valuable than context-specific observations",
      ] },
    },
  },

  "Political Theorists": {
    name: "Political Theorists",
    defaults: [
      "Karl Marx", "Hannah Arendt", "Michel Foucault", "Antonio Gramsci", "Rosa Luxemburg",
      "Carl Schmitt", "John Rawls", "Frantz Fanon", "Simone de Beauvoir", "Thomas Hobbes",
      "Jean-Jacques Rousseau", "Friedrich Hayek", "Jürgen Habermas",
    ],
    xAxis: THINKERS_X_AXIS,
    yAxis: THINKERS_Y_AXIS,
  },

  "Philosophers": {
    name: "Philosophers",
    defaults: [
      "Aristotle", "Immanuel Kant", "Georg Wilhelm Friedrich Hegel", "Friedrich Nietzsche",
      "Martin Heidegger", "Ludwig Wittgenstein", "Theodor Adorno", "Jacques Derrida",
      "Gilles Deleuze", "Judith Butler", "Baruch Spinoza", "Plato",
    ],
    xAxis: THINKERS_X_AXIS,
    yAxis: THINKERS_Y_AXIS,
  },

  "Physicists": {
    name: "Physicists",
    defaults: [
      "Albert Einstein", "Isaac Newton", "Niels Bohr", "Werner Heisenberg", "Richard Feynman",
      "Marie Curie", "James Clerk Maxwell", "Erwin Schrödinger", "Stephen Hawking",
      "Max Planck", "Paul Dirac", "Galileo Galilei",
    ],
    xAxis: THINKERS_X_AXIS,
    yAxis: THINKERS_Y_AXIS,
  },

  "Mathematicians": {
    name: "Mathematicians",
    defaults: [
      "Kurt Gödel", "Emmy Noether", "Alan Turing", "Leonhard Euler", "Carl Friedrich Gauss",
      "Bernhard Riemann", "David Hilbert", "Srinivasa Ramanujan", "Henri Poincaré",
      "Ada Lovelace", "Georg Cantor", "Évariste Galois",
    ],
    xAxis: THINKERS_X_AXIS,
    yAxis: THINKERS_Y_AXIS,
  },

  "AI Pioneers": {
    name: "AI Pioneers",
    defaults: [
      "Alan Turing", "Claude Shannon", "John von Neumann", "Norbert Wiener", "Marvin Minsky",
      "Geoffrey Hinton", "Yoshua Bengio", "Yann LeCun", "Joseph Weizenbaum", "Ada Lovelace",
      "Herbert Simon", "Timnit Gebru", "Fei-Fei Li",
    ],
    xAxis: THINKERS_X_AXIS,
    yAxis: THINKERS_Y_AXIS,
  },
};

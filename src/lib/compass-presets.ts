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
    xAxis: {
      negative: { label: "Emancipatory", terms: [
        "The purpose of political thought is human liberation from oppression",
        "Justice requires the radical transformation of existing social structures",
        "Power must be redistributed from the ruling class to the people",
        "Revolution is sometimes necessary to achieve genuine freedom",
        "Solidarity among the oppressed is the foundation of political change",
        "The state serves the interests of the dominant class and must be challenged",
        "True democracy means the self-governance of ordinary people",
        "Political theory must be committed to equality and human dignity",
      ] },
      positive: { label: "Order", terms: [
        "Political stability requires strong institutions and respect for authority",
        "Social order is the precondition for any form of freedom",
        "Tradition and established institutions embody accumulated wisdom",
        "The sovereign state is necessary to prevent the war of all against all",
        "Property rights and the rule of law are the foundations of civilisation",
        "Gradual reform is safer and more effective than revolution",
        "Political realism requires accepting human nature as it is",
        "The primary duty of government is to maintain security and order",
      ] },
    },
    yAxis: {
      negative: { label: "Collective", terms: [
        "Class struggle is the motor of history",
        "The community and its shared life take precedence over individual interests",
        "Collective ownership of the means of production is the basis of justice",
        "Social movements and mass action are the agents of historical change",
        "Inequality is structural, not the result of individual choices",
        "The public good must override private accumulation",
        "Solidarity is a political virtue, not merely a sentiment",
        "Common institutions shape individual identity and possibility",
      ] },
      positive: { label: "Individual", terms: [
        "Individual liberty is the supreme political value",
        "The rights of the person must be protected against the collective",
        "Personal responsibility is the foundation of a moral society",
        "Free individuals making voluntary choices produce the best outcomes",
        "The individual conscience is the ultimate source of moral authority",
        "Government intrusion into private life is the greatest political danger",
        "Each person owns themselves and the fruits of their labour",
        "Pluralism means protecting the individual from the tyranny of the majority",
      ] },
    },
  },

  "Philosophers": {
    name: "Philosophers",
    defaults: [
      "Aristotle", "Immanuel Kant", "Georg Wilhelm Friedrich Hegel", "Friedrich Nietzsche",
      "Martin Heidegger", "Ludwig Wittgenstein", "Theodor Adorno", "Jacques Derrida",
      "Gilles Deleuze", "Judith Butler", "Baruch Spinoza", "Plato",
    ],
    xAxis: {
      negative: { label: "Continental", terms: [
        "Philosophy must grapple with the historical conditions of human existence",
        "Being and time are the fundamental questions of thought",
        "Dialectical thinking reveals contradictions that formal logic cannot capture",
        "The lived experience of the body is philosophically irreducible",
        "Language does not transparently represent reality but constitutes it",
        "The history of metaphysics must be overcome, not continued",
        "Phenomenological description is prior to scientific explanation",
        "Philosophy is inseparable from the social and political context in which it is practised",
      ] },
      positive: { label: "Analytic", terms: [
        "Philosophy should aspire to the clarity and rigour of the natural sciences",
        "Logical analysis of language is the proper method of philosophy",
        "Philosophical problems can be dissolved through careful attention to meaning",
        "Formal logic is the foundation of all valid reasoning",
        "Thought experiments and counterexamples test the coherence of philosophical claims",
        "The philosophy of mind must be continuous with cognitive science",
        "Metaphysical questions should be grounded in our best scientific theories",
        "Precision in argument matters more than breadth of vision",
      ] },
    },
    yAxis: {
      negative: { label: "Materialist", terms: [
        "Consciousness is determined by material and social conditions",
        "Ideas are products of material life, not the other way around",
        "The body, labour, and economic relations are the basis of all philosophy",
        "Abstract thought must be grounded in concrete material reality",
        "History is driven by changes in the mode of production",
        "Philosophy without attention to power and class is ideology",
        "Naturalism is the correct philosophical framework for understanding the world",
        "The real is material, not ideal",
      ] },
      positive: { label: "Idealist", terms: [
        "Ideas and reason are the primary reality underlying the material world",
        "The structure of thought determines the structure of experience",
        "Consciousness is not reducible to brain states or material processes",
        "Universal truths exist independently of any particular mind or culture",
        "The transcendental conditions of experience are the proper object of philosophy",
        "Spirit or mind unfolds through history toward greater self-knowledge",
        "Ethics and aesthetics are domains of objective value, not mere preference",
        "Mathematics and logic reveal truths about a non-material realm",
      ] },
    },
  },

  "Physicists": {
    name: "Physicists",
    defaults: [
      "Albert Einstein", "Isaac Newton", "Niels Bohr", "Werner Heisenberg", "Richard Feynman",
      "Marie Curie", "James Clerk Maxwell", "Erwin Schrödinger", "Stephen Hawking",
      "Max Planck", "Paul Dirac", "Galileo Galilei",
    ],
    xAxis: {
      negative: { label: "Theoretical", terms: [
        "The deepest truths of physics are discovered through mathematical reasoning",
        "A beautiful equation is more likely to be correct than an ugly one",
        "Unification of forces into a single theory is the ultimate goal of physics",
        "Thought experiments reveal fundamental truths about the nature of reality",
        "Theoretical elegance is a guide to physical truth",
        "Physics should seek the most fundamental laws from which all else follows",
        "Mathematical consistency is a stronger constraint than experimental evidence",
        "The laws of physics are eternal and unchanging",
      ] },
      positive: { label: "Experimental", terms: [
        "Only experiment can decide between competing physical theories",
        "Measurement and observation are the foundations of physical knowledge",
        "Practical applications demonstrate the value of physical understanding",
        "Laboratory work reveals phenomena that theory could never predict",
        "The purpose of physics is to describe and predict observable phenomena",
        "Engineering and applied physics solve real problems in the world",
        "Data must always take precedence over theoretical expectations",
        "Physics advances through the design of better experiments and instruments",
      ] },
    },
    yAxis: {
      negative: { label: "Realist", terms: [
        "Physics describes an objective reality that exists independently of observation",
        "Particles have definite properties whether or not we measure them",
        "The goal of physics is to discover what the world is really like",
        "Hidden variables may underlie the apparent randomness of quantum mechanics",
        "A complete theory of physics would leave no room for fundamental uncertainty",
        "The universe is deterministic at the deepest level",
        "Scientific theories aim to be true descriptions of an independent reality",
        "Nature exists and has properties regardless of human knowledge",
      ] },
      positive: { label: "Instrumentalist", terms: [
        "Physics provides useful models, not descriptions of ultimate reality",
        "Quantum mechanics shows that observation is inseparable from what is observed",
        "The role of a physical theory is to predict experimental outcomes, not to describe reality",
        "Complementarity means we must accept multiple incompatible descriptions",
        "Probability is fundamental to nature, not merely a reflection of our ignorance",
        "It is meaningless to ask what a particle is doing when no one is looking",
        "Physics should be modest about its ontological claims",
        "The success of a theory is measured by its predictive power, not its truth",
      ] },
    },
  },

  "Mathematicians": {
    name: "Mathematicians",
    defaults: [
      "Kurt Gödel", "Emmy Noether", "Alan Turing", "Leonhard Euler", "Carl Friedrich Gauss",
      "Bernhard Riemann", "David Hilbert", "Srinivasa Ramanujan", "Henri Poincaré",
      "Ada Lovelace", "Georg Cantor", "Évariste Galois",
    ],
    xAxis: {
      negative: { label: "Pure", terms: [
        "Mathematics is pursued for its own intrinsic beauty and truth",
        "The most important mathematical results have no practical application",
        "Abstract structures and their properties are the proper objects of mathematics",
        "Mathematical proof is the gold standard of human reasoning",
        "Number theory and topology are valuable regardless of any application",
        "The purest mathematics often turns out to be the most useful, but this is not why we do it",
        "Mathematics is the free creation of the human mind",
        "Elegance and generality are the hallmarks of great mathematics",
      ] },
      positive: { label: "Applied", terms: [
        "Mathematics is most valuable when it solves real-world problems",
        "Applied mathematics drives progress in science and engineering",
        "Computation and numerical methods are as important as pure proof",
        "Statistics and data analysis are the most useful branches of mathematics",
        "Mathematical modelling of physical systems is the highest form of applied thought",
        "The purpose of mathematics is to provide tools for other disciplines",
        "Algorithms and computational complexity matter more than abstract structures",
        "Mathematics should be judged by its practical consequences",
      ] },
    },
    yAxis: {
      negative: { label: "Platonist", terms: [
        "Mathematical objects exist independently of human minds",
        "Mathematicians discover truths, they do not invent them",
        "The integers, the continuum, and infinite sets are real objects",
        "Mathematical truth is eternal and mind-independent",
        "Gödel's incompleteness theorems show that mathematical reality exceeds any formal system",
        "The unreasonable effectiveness of mathematics in physics suggests mathematical realism",
        "There is a fact of the matter about every mathematical proposition",
        "Mathematical intuition is a form of perception of abstract objects",
      ] },
      positive: { label: "Constructivist", terms: [
        "Mathematics is a human construction, not a discovery of pre-existing truths",
        "Only mathematical objects that can be explicitly constructed are meaningful",
        "Existence proofs that do not provide constructions are philosophically empty",
        "Infinite sets and completed infinities are useful fictions, not real objects",
        "Mathematics is a language, not a description of a platonic realm",
        "The foundations of mathematics are conventional, not absolute",
        "Formal systems are tools created by humans for human purposes",
        "Mathematical truth is relative to the axiom systems we choose",
      ] },
    },
  },

  "AI Pioneers": {
    name: "AI Pioneers",
    defaults: [
      "Alan Turing", "Claude Shannon", "John von Neumann", "Norbert Wiener", "Marvin Minsky",
      "Geoffrey Hinton", "Yoshua Bengio", "Yann LeCun", "Joseph Weizenbaum", "Ada Lovelace",
      "Herbert Simon", "Timnit Gebru", "Fei-Fei Li",
    ],
    xAxis: {
      negative: { label: "Symbolic", terms: [
        "Intelligence is best modelled through symbol manipulation and logical rules",
        "Knowledge representation requires structured, human-readable formalisms",
        "Expert systems encoding domain knowledge are the path to artificial intelligence",
        "Understanding language requires parsing grammar and representing meaning explicitly",
        "Reasoning from first principles is the hallmark of genuine intelligence",
        "AI systems should be explainable and their reasoning transparent",
        "Logic and formal rules are the foundation of intelligent behaviour",
        "Intelligence requires the ability to manipulate abstract symbols according to rules",
      ] },
      positive: { label: "Connectionist", terms: [
        "Intelligence emerges from the patterns of connection between simple processing units",
        "Neural networks learn representations directly from data without explicit programming",
        "Statistical learning from large datasets is more powerful than hand-coded rules",
        "Deep learning has solved problems that symbolic AI could never approach",
        "The brain is a neural network and artificial neural networks model its operation",
        "Distributed representations encode meaning more robustly than symbolic structures",
        "End-to-end learning from raw data is preferable to feature engineering",
        "Scale of data and computation is the primary driver of AI progress",
      ] },
    },
    yAxis: {
      negative: { label: "Critical", terms: [
        "AI systems reproduce and amplify existing social biases and inequalities",
        "The concentration of AI power in a few corporations is a threat to democracy",
        "Ethical oversight and regulation of AI development is urgently necessary",
        "AI cannot replicate human understanding, empathy, or moral judgement",
        "The human costs of automation must be weighed against efficiency gains",
        "Transparency and accountability in AI systems are non-negotiable requirements",
        "AI hype obscures the real limitations and dangers of these systems",
        "The workers who produce training data deserve recognition and fair compensation",
      ] },
      positive: { label: "Accelerationist", terms: [
        "Artificial general intelligence is achievable and will transform human civilisation",
        "The benefits of AI development far outweigh the risks",
        "Scaling up models and data will continue to produce breakthrough capabilities",
        "AI will solve humanity's greatest challenges including disease, poverty, and climate change",
        "Regulation would slow down progress and give competitors an advantage",
        "Intelligence is a general-purpose capability that machines can and will surpass",
        "The development of superintelligent AI is the most important project in human history",
        "Compute and data are the key resources, and more of both is always better",
      ] },
    },
  },
};

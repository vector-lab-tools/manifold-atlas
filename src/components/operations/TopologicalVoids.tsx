/**
 * Manifold Atlas — Topological Voids
 * Concept and Design: David M. Berry, University of Sussex
 *
 * Persistent homology applied to embedding spaces. Detects connected components
 * (H0), loops (H1), and structural voids in the manifold's geometry.
 */

"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, ChevronRight, ChevronDown, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import { BenchmarkLoader } from "@/components/shared/BenchmarkLoader";
import { PlotlyPlot } from "@/components/viz/PlotlyPlot";
import { projectPCA3D, spreadPoints3D } from "@/lib/geometry/pca";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import {
  computeTopology,
  componentsAtThreshold,
  edgesAtThreshold,
  type TopologyResult,
} from "@/lib/geometry/persistent-homology";

const TopologyScene = dynamic(
  () => import("@/components/viz/TopologyScene").then(mod => ({ default: mod.TopologyScene })),
  { ssr: false, loading: () => <div className="h-[450px] flex items-center justify-center bg-card text-slate text-body-sm rounded-sm">Loading 3D scene...</div> }
);

// --- Presets ---

const TOPOLOGY_PRESETS: Array<{ label: string; concepts: string[] }> = [
  {
    label: "Political claims",
    concepts: [
      "Democracy means collective self-governance through popular participation",
      "Freedom is the absence of interference by the state or other individuals",
      "Justice requires the fair distribution of resources and opportunities",
      "Equality demands that all persons are treated with equal dignity and worth",
      "Sovereignty is the supreme authority of a state over its own territory",
      "Legitimacy is the right to govern based on the consent of the governed",
      "Authority is the recognised power to command and enforce obedience",
      "Protest is the collective expression of dissent against injustice",
      "Consensus is agreement achieved through deliberation rather than coercion",
      "Citizenship is membership in a political community with rights and obligations",
      "Revolution is the forcible overthrow of an existing political order",
      "Solidarity is the mutual commitment of individuals to collective well-being",
      "Resistance is opposition to domination in all its forms",
      "Hegemony is the naturalisation of one group's interests as universal common sense",
      "The market is the most efficient mechanism for allocating scarce resources",
      "Private property is the foundation of individual liberty and economic growth",
      "The welfare state is a necessary corrective to market failure and inequality",
      "Immigration enriches the cultural and economic life of the host nation",
      "National security requires the restriction of certain civil liberties",
      "Human rights are universal moral claims that transcend cultural difference",
    ],
  },
  {
    label: "Knowledge claims",
    concepts: [
      "Physics explains the fundamental forces governing the behaviour of matter and energy",
      "Mathematics is the abstract study of quantity, structure, and logical relation",
      "Biology investigates the mechanisms of life, from molecular processes to ecosystems",
      "Philosophy examines the nature of existence, knowledge, and ethical obligation",
      "Literature is the artistic use of language to explore human experience and meaning",
      "History is the critical reconstruction of past events and their significance",
      "Sociology studies the structures and dynamics of human social organisation",
      "Psychology investigates the cognitive and emotional processes underlying behaviour",
      "Economics analyses the production, distribution, and consumption of goods and services",
      "Art is the creation of objects and experiences valued for their aesthetic qualities",
      "Religion is a system of beliefs and practices oriented toward the sacred or transcendent",
      "Technology is the application of scientific knowledge to practical problems",
      "Medicine is the science and practice of diagnosing, treating, and preventing disease",
      "Law is a system of rules enforced through social institutions to govern conduct",
      "Ethics is the systematic study of what we ought to do and why",
      "Ecology studies the relationships between organisms and their environments",
      "Computation is the systematic transformation of information according to formal rules",
      "Anthropology is the comparative study of human cultures and social practices",
      "Linguistics is the scientific study of language structure and use",
      "Theology is the systematic study of the nature of the divine and religious belief",
    ],
  },
  {
    label: "Critical Theory",
    concepts: [
      "Reification is the process by which social relations come to appear as natural things",
      "Commodity fetishism is the concealment of social labour behind the apparent value of objects",
      "Alienation is the estrangement of workers from the products and process of their labour",
      "Ideology is the system of ideas that naturalises existing power relations as inevitable",
      "Dialectics is the movement of thought through contradiction toward higher synthesis",
      "Interpellation is the process by which ideology constitutes individuals as subjects",
      "Biopower is the administration of life and populations through regulatory mechanisms",
      "The rhizome is a non-hierarchical model of knowledge that resists arborescent structure",
      "Deterritorialisation is the liberation of flows from their fixed social coding",
      "The simulacrum is a copy without an original that precedes and determines the real",
      "Differance is the play of difference and deferral that constitutes meaning",
      "Deconstruction is the practice of reading texts against their own metaphysical assumptions",
      "Genealogy traces the contingent historical conditions that produced present truths",
      "The dispositif is the heterogeneous ensemble of discourses, institutions, and practices",
      "Habitus is the system of durable dispositions that structures perception and action",
      "Symbolic violence is the imposition of meaning that conceals the power relations behind it",
      "The culture industry is the mass production of standardised cultural goods for profit",
      "Instrumental reason reduces all thought to the calculation of means for predetermined ends",
      "Communicative action is social interaction oriented toward mutual understanding",
      "The spectacle is the mediation of social relations through images of commodities",
    ],
  },
  {
    label: "AI & Computation",
    concepts: [
      "Machine learning is the extraction of statistical patterns from large datasets",
      "Neural networks model cognition as the propagation of signals through weighted connections",
      "The algorithm is a finite sequence of instructions that transforms input into output",
      "Training data is the raw material from which machine intelligence is produced",
      "The embedding is a geometric encoding of meaning as position in high-dimensional space",
      "Attention mechanisms allow models to selectively weight parts of their input",
      "Generative AI produces novel outputs by sampling from learned probability distributions",
      "Reinforcement learning optimises behaviour through reward signals and exploration",
      "The loss function defines what the model treats as error and therefore as truth",
      "Bias in machine learning is the systematic reproduction of social inequality through data",
      "Explainability is the demand that automated decisions be interpretable by humans",
      "Automation is the replacement of human labour with mechanical or computational processes",
      "Surveillance is the systematic monitoring of behaviour for purposes of control",
      "The platform is an infrastructure that mediates and extracts value from social interaction",
      "Data is the abstraction of human activity into computationally tractable representations",
      "The cloud is the concentration of computational resources in corporate data centres",
      "Open source is the practice of making software freely available for modification and redistribution",
      "Artificial general intelligence is the hypothetical capacity of machines to perform any cognitive task",
      "The Turing test measures whether a machine can imitate human conversation convincingly",
      "Computational thinking is the reduction of problems to forms amenable to algorithmic solution",
    ],
  },
  {
    label: "Labour & Capital",
    concepts: [
      "Labour is the expenditure of human effort in the production of goods and services",
      "Capital is accumulated wealth employed to generate further wealth through production",
      "The commodity is an object produced for exchange rather than for direct use",
      "Exploitation is the extraction of surplus value from labour by capital",
      "The wage is the price at which labour power is bought and sold on the market",
      "Surplus value is the difference between what labour produces and what it is paid",
      "The means of production are the tools, machines, and materials used in the labour process",
      "Primitive accumulation is the violent dispossession that created the conditions for capitalism",
      "The reserve army of labour is the pool of unemployed workers that disciplines the employed",
      "Financialisation is the growing dominance of financial markets over productive activity",
      "The gig economy is the organisation of labour as temporary, precarious, and platform-mediated",
      "Care work is the unpaid or underpaid labour of sustaining human life and social reproduction",
      "Intellectual property is the legal enclosure of ideas and knowledge as private assets",
      "The supply chain is the global network of production, logistics, and distribution",
      "Automation threatens to render human labour redundant in increasing domains of production",
      "The strike is the collective withdrawal of labour as a weapon against capital",
      "Trade unions are organisations of workers formed to protect and advance their collective interests",
      "Precarity is the condition of living without predictable employment or social security",
      "Universal basic income is an unconditional cash payment to all citizens regardless of employment",
      "Degrowth is the planned reduction of economic output to achieve ecological sustainability",
    ],
  },
  {
    label: "Ecology & Nature",
    concepts: [
      "Climate change is the long-term alteration of global weather patterns caused by human activity",
      "Biodiversity is the variety of life forms within an ecosystem or across the planet",
      "Sustainability is the capacity to meet present needs without compromising future generations",
      "Extraction is the removal of natural resources from the earth for economic use",
      "The Anthropocene is the geological epoch defined by human impact on planetary systems",
      "Carbon emissions are the release of greenhouse gases from burning fossil fuels",
      "Deforestation is the clearing of forests for agriculture, industry, or urban expansion",
      "Ocean acidification is the decrease in seawater pH caused by absorption of atmospheric carbon dioxide",
      "Renewable energy is power generated from sources that are naturally replenished",
      "Environmental justice demands that the costs of pollution are not borne disproportionately by the poor",
      "Permaculture is the design of agricultural systems that mimic natural ecosystems",
      "Rewilding is the restoration of ecosystems to their natural state by reintroducing native species",
      "Water scarcity is the insufficient availability of fresh water to meet human and ecological needs",
      "Soil degradation is the decline of soil quality through erosion, contamination, or nutrient depletion",
      "Indigenous ecological knowledge is the understanding of ecosystems developed over generations by local peoples",
      "The commons are shared resources managed collectively rather than privately or by the state",
      "Extinction is the irreversible loss of a species from the living world",
      "Ecological footprint measures the demand placed on natural systems by human consumption",
      "Food sovereignty is the right of peoples to define their own food and agriculture systems",
      "Deep ecology holds that all living beings have intrinsic value independent of human purposes",
    ],
  },
  {
    label: "Media & Culture",
    concepts: [
      "The medium is the material infrastructure through which communication takes place",
      "Representation is the production of meaning through signs, images, and language",
      "The public sphere is the domain of social life where public opinion is formed through discourse",
      "Propaganda is the systematic dissemination of information to promote a particular cause",
      "The archive is the institutional apparatus that determines what is preserved and what is forgotten",
      "Censorship is the suppression of speech or information deemed objectionable by those in power",
      "The spectacle is the social relation between people mediated by images of commodities",
      "Digital media are communication technologies based on the encoding of information as discrete signals",
      "The network is a structure of interconnected nodes through which information and power flow",
      "Virality is the rapid spread of content through social networks driven by sharing behaviour",
      "The attention economy treats human attention as a scarce resource to be captured and monetised",
      "Misinformation is false or misleading content spread without intent to deceive",
      "The filter bubble is the intellectual isolation created by algorithmic personalisation of content",
      "Cultural appropriation is the adoption of elements from a marginalised culture by a dominant one",
      "The creative commons is a licensing system that allows sharing and reuse of creative works",
      "Remix culture is the practice of creating new works by combining and transforming existing material",
      "The digital divide is the unequal access to information technology across social groups",
      "Platform capitalism is the extraction of value from the mediation of social interaction by corporations",
      "Post-truth describes a political culture in which appeals to emotion override factual evidence",
      "Media literacy is the ability to critically analyse and evaluate media messages and their production",
    ],
  },
  {
    label: "Body & Phenomenology",
    concepts: [
      "The lived body is the body as experienced from within rather than observed from without",
      "Perception is the active engagement of the embodied subject with the sensible world",
      "Intentionality is the directedness of consciousness toward objects and states of affairs",
      "The flesh is the intertwining of the sensing body and the sensed world",
      "Affect is the pre-personal intensity that arises in encounters between bodies",
      "Embodiment is the condition of being a physical organism in a material world",
      "The gaze is the act of looking that constitutes both subject and object of perception",
      "Pain is the bodily experience that demands attention and resists conceptual mastery",
      "Touch is the sense that collapses the distance between perceiver and perceived",
      "Gesture is the expressive movement of the body that communicates meaning without words",
      "Habit is the sedimented bodily knowledge that enables skilled action without reflection",
      "Fatigue is the depletion of the body's capacity for sustained effort and attention",
      "Disability is the social and material restriction of bodily capacity by environmental barriers",
      "Gender is the socially constructed set of expectations and performances associated with sex",
      "Race is the social classification of human beings based on perceived physical characteristics",
      "Sleep is the periodic suspension of waking consciousness necessary for bodily restoration",
      "Breath is the rhythmic exchange between the organism and its atmospheric environment",
      "Trauma is the overwhelming experience that exceeds the body's capacity for integration",
      "Proprioception is the body's sense of its own position and movement in space",
      "Mortality is the condition of being subject to death that structures all human experience",
    ],
  },
  {
    label: "Tech company claims",
    concepts: [
      "Our mission is to organise the world's information and make it universally accessible",
      "We believe AI should benefit all of humanity equally and safely",
      "Move fast and break things to build something that matters",
      "We are committed to connecting people and building community at global scale",
      "Our platform empowers creators to share their voice with the world",
      "We put privacy and security at the core of everything we build",
      "We are building the future of work through intelligent automation",
      "Our technology makes the world more open and transparent",
      "We democratise access to powerful tools that were once available only to the few",
      "We believe in the transformative power of technology to solve humanity's greatest challenges",
      "Our algorithms are designed to surface the most relevant and trustworthy content",
      "We are committed to responsible innovation that puts people first",
      "We use data to build products that delight and empower our users",
      "Our cloud infrastructure enables businesses of any size to compete globally",
      "We are building artificial general intelligence for the benefit of humanity",
      "Our marketplace creates economic opportunity for millions of sellers worldwide",
      "We believe every person deserves access to the tools of the digital economy",
      "We are making information more useful, accessible, and actionable for everyone",
      "Our autonomous vehicles will save lives by eliminating human error from driving",
      "We are building the metaverse as the next evolution of social connection",
    ],
  },
  {
    label: "Accelerationism",
    concepts: [
      "Capitalism must be accelerated through its contradictions rather than resisted from outside",
      "The only way beyond capital is through capital at maximum velocity",
      "Technology is the vector through which human capacities are amplified beyond biological limit",
      "The future is a process of destratification that dissolves all fixed social forms",
      "Markets are information processing systems more powerful than any central planner",
      "Automation should be embraced as liberation from drudgery rather than feared as displacement",
      "The left must reclaim the future from conservative nostalgia and liberal incrementalism",
      "Universal basic income enables post-work society by severing survival from employment",
      "Platform technology creates new forms of collective intelligence at unprecedented scale",
      "Full automation means the end of work as the organising principle of human life",
      "Xenofeminism demands that technology be repurposed for the abolition of gender",
      "The Anthropocene requires planetary-scale computation to manage existential risk",
      "Cognitive enhancement through technology is the next stage of human evolution",
      "Decentralised autonomous organisations replace hierarchical institutions with protocol governance",
      "Cryptocurrency disrupts the state monopoly on money and enables financial sovereignty",
      "Space colonisation is necessary to ensure the survival of human civilisation",
      "Longtermism demands we prioritise the welfare of trillions of future beings over present suffering",
      "Effective accelerationism holds that the pace of technological progress must be maximised unconditionally",
      "Dark enlightenment argues that democracy is incompatible with civilisational competence",
      "Neoreaction proposes the replacement of democratic governance with corporate sovereignty",
    ],
  },
  {
    label: "Effective Altruism",
    concepts: [
      "Charitable giving should be directed where it produces the greatest measurable impact per dollar",
      "Existential risk reduction is the highest priority cause area because of the scale of potential loss",
      "AI alignment is the most important problem because misaligned superintelligence threatens all value",
      "Global health interventions like malaria nets offer the best cost-effectiveness ratios",
      "Animal welfare matters morally and factory farming causes suffering on an enormous scale",
      "Longtermism holds that future people matter as much as present people in moral calculations",
      "Career capital should be accumulated strategically to maximise lifetime positive impact",
      "Earning to give can produce more good than direct work in many cause areas",
      "Randomised controlled trials are the gold standard for evaluating intervention effectiveness",
      "Cause prioritisation uses expected value calculations to rank problems by tractability and scale",
      "The drowning child thought experiment shows we have strong obligations to distant strangers",
      "Moral uncertainty requires us to hedge across ethical theories rather than commit to one",
      "Population ethics suggests we should want more happy people to exist rather than fewer",
      "Wild animal suffering is a neglected cause area of potentially enormous scale",
      "Biosecurity deserves more resources because engineered pandemics could be catastrophic",
      "Nuclear war remains an underappreciated existential risk requiring active mitigation",
      "Institutional decision-making should be improved through better forecasting and calibration",
      "The scout mindset seeks truth through calibrated uncertainty rather than tribal loyalty",
      "Moral circle expansion means extending ethical concern to more beings over time",
      "Catastrophic and existential risks deserve disproportionate attention because of their irreversibility",
    ],
  },
  {
    label: "Philosophy of Mind",
    concepts: [
      "Consciousness is the subjective experience of being aware of oneself and the world",
      "Qualia are the irreducibly subjective qualities of conscious experience",
      "The hard problem of consciousness is explaining why physical processes give rise to subjective experience",
      "Functionalism holds that mental states are defined by their causal roles rather than their physical composition",
      "Eliminative materialism argues that folk psychological concepts like belief and desire will be replaced by neuroscience",
      "The Chinese room argument claims that symbol manipulation without understanding is not genuine thought",
      "Embodied cognition holds that thinking depends constitutively on the body and its interactions with the environment",
      "Extended mind theory argues that cognitive processes can extend beyond the skull into tools and environments",
      "Panpsychism is the view that consciousness is a fundamental feature of all matter",
      "Intentionality is the capacity of mental states to be about or directed toward objects and states of affairs",
      "The binding problem asks how the brain integrates information from different sensory modalities into unified experience",
      "Epiphenomenalism holds that mental events are caused by physical events but have no causal power themselves",
      "Free will is the capacity of agents to choose between alternative courses of action",
      "Determinism holds that every event is necessitated by prior causes according to natural law",
      "The zombie argument claims that a being physically identical to a human could lack all conscious experience",
      "Integrated information theory proposes that consciousness is identical with a specific type of information processing",
      "The global workspace theory holds that consciousness arises from the broadcasting of information across brain networks",
      "Supervenience is the relation by which mental properties depend on physical properties without being reducible to them",
      "Multiple realisability is the claim that the same mental state can be implemented in different physical substrates",
      "The explanatory gap is the difficulty of explaining how physical processes produce phenomenal experience",
    ],
  },
  {
    label: "Existentialism",
    concepts: [
      "Existence precedes essence means that human beings define themselves through their choices and actions",
      "Anxiety is the mood that discloses the radical freedom and groundlessness of human existence",
      "Authenticity is the condition of owning one's existence rather than fleeing into conformity",
      "Bad faith is the self-deception by which we deny our freedom and responsibility",
      "The absurd is the confrontation between human desire for meaning and the indifference of the universe",
      "Being-toward-death is the awareness of mortality that individualises existence and reveals its finitude",
      "Thrownness is the condition of finding oneself already situated in a world not of one's choosing",
      "The other is the being whose gaze constitutes me as an object and limits my freedom",
      "Commitment is the decisive engagement with a cause that gives structure to an otherwise meaningless existence",
      "Nausea is the visceral awareness of the brute contingency and superfluity of existence",
      "The eternal return is the thought experiment that asks whether you would will the infinite repetition of your life",
      "Facticity is the given circumstances of existence that constrain but do not determine human freedom",
      "Transcendence is the capacity of human existence to project itself beyond its present situation",
      "Dread reveals the nothingness at the heart of human existence that makes freedom possible",
      "The leap of faith is the decision to commit to meaning in the absence of rational justification",
      "Resoluteness is the authentic confrontation with one's own finitude and the assumption of responsibility",
      "Absurd heroism is the defiance of meaninglessness through continued engagement with life",
      "Intersubjectivity is the shared world of meaning constituted through relations between conscious subjects",
      "Alienation is the estrangement from oneself, others, and the world that results from inauthentic existence",
      "Situation is the concrete totality of circumstances within which freedom is exercised and limited",
    ],
  },
  {
    label: "Media Archaeology",
    concepts: [
      "Media archaeology excavates forgotten and suppressed technologies to challenge narratives of progress",
      "The apparatus is the material and institutional arrangement that structures perception and knowledge",
      "Dead media are technologies that have fallen out of use but reveal the contingency of present systems",
      "Technical media process signals at speeds and scales inaccessible to human perception",
      "The discourse network is the historically specific configuration of technologies that determines what counts as knowledge",
      "Kittler argues that media determine our situation regardless of what we think we are doing with them",
      "The gramophone, film, and typewriter separated the data flows of sound, image, and writing for the first time",
      "Analogue media process continuous signals while digital media reduce all input to discrete numerical values",
      "Media operate below the threshold of human perception and therefore escape phenomenological description",
      "The archive is not a neutral repository but a technology that produces the past it claims to preserve",
      "Noise is not the opposite of signal but its condition of possibility",
      "Optical media from the camera obscura to cinema shaped modern subjectivity through the control of light",
      "The typewriter mechanised writing and severed the connection between hand and letter",
      "War is the origin of most communication technologies and their logics persist in civilian applications",
      "The computer is not a medium among others but the medium that absorbs and simulates all previous media",
      "Software obscures hardware by interposing layers of abstraction between the user and the machine",
      "Cultural techniques are the basic operations of symbolisation that precede and enable culture",
      "Time-axis manipulation is the capacity of technical media to store, reverse, and accelerate temporal signals",
      "The materiality of communication resists reduction to the meaning of messages",
      "Planned obsolescence ensures that media technologies are replaced before they are exhausted",
    ],
  },
  {
    label: "Literary Critique",
    concepts: [
      "The death of the author liberates the text from the tyranny of authorial intention",
      "Close reading attends to the formal properties of the text rather than its social context",
      "Narrative is the fundamental mode by which human beings organise temporal experience into meaningful sequence",
      "The unreliable narrator destabilises the reader's trust in the voice that tells the story",
      "Intertextuality is the web of references and allusions that connects every text to other texts",
      "Defamiliarisation is the literary technique of making the familiar strange to renew perception",
      "The canon is the body of works deemed worthy of preservation and study by dominant cultural institutions",
      "Genre is the system of conventions and expectations that shapes both the production and reception of texts",
      "The implied reader is the ideal audience constructed by the text's rhetorical strategies",
      "Irony is the gap between what is said and what is meant that requires the reader's active interpretation",
      "Allegory is the sustained correspondence between a surface narrative and an underlying system of meaning",
      "The sublime is the aesthetic experience of overwhelming magnitude or power that exceeds comprehension",
      "Mimesis is the representation of reality through artistic imitation and transformation",
      "Stream of consciousness renders the flow of thought without the organising intervention of a narrator",
      "The palimpsest is a text bearing traces of earlier writing that has been partially erased",
      "Polyphony is the presence of multiple autonomous voices within a single literary work",
      "The uncanny is the disturbing experience of the familiar becoming strange and threatening",
      "World literature is the circulation of texts across linguistic and national boundaries",
      "The readerly text invites passive consumption while the writerly text demands active production of meaning",
      "Post-colonial literature contests the cultural authority of the imperial centre from the periphery",
    ],
  },
  {
    label: "Semiotics",
    concepts: [
      "The sign is the unity of a signifier and a signified that produces meaning through difference",
      "The signifier is the material form of the sign that carries meaning through its sensible properties",
      "The signified is the concept or mental image evoked by the signifier",
      "The referent is the actual object in the world to which a sign points but which is not part of the sign itself",
      "Denotation is the literal or primary meaning of a sign within a given code",
      "Connotation is the secondary or associative meaning that accrues to a sign through cultural usage",
      "The code is the system of conventions that governs the production and interpretation of signs",
      "Myth is the second-order semiotic system that naturalises cultural values as self-evident truths",
      "The index is a sign connected to its referent by physical causation or contiguity",
      "The icon is a sign that resembles its referent through shared qualities",
      "The symbol is a sign connected to its referent only by social convention",
      "Semiosis is the ongoing process by which signs generate further signs in an unlimited chain",
      "The paradigm is the set of alternatives from which a sign is selected in the production of meaning",
      "The syntagm is the combination of signs in a sequential chain that produces meaning through arrangement",
      "Binary opposition is the structuring of meaning through contrasting pairs such as nature and culture",
      "Polysemy is the capacity of a sign to carry multiple meanings simultaneously",
      "The floating signifier is a sign whose meaning is unfixed and contested across different discourses",
      "Encoding is the production of meaning by the sender while decoding is its interpretation by the receiver",
      "The dominant reading is the interpretation of a text that aligns with the preferred meaning of its producers",
      "Semiotic excess is the surplus of meaning that escapes the controlling intention of any code or author",
    ],
  },
  {
    label: "Finance & Markets",
    concepts: [
      "The efficient market hypothesis holds that prices reflect all available information",
      "Derivatives are financial instruments whose value depends on the price of an underlying asset",
      "Quantitative easing is the central bank purchase of assets to increase the money supply",
      "Leverage amplifies both gains and losses by using borrowed capital to increase exposure",
      "High-frequency trading uses algorithms to execute orders in fractions of a second",
      "Credit default swaps transfer the risk of debt default from one party to another",
      "The yield curve plots interest rates across different maturities of government debt",
      "Inflation is the sustained increase in the general price level reducing purchasing power",
      "Venture capital provides funding to early-stage companies in exchange for equity stakes",
      "The bond market is the primary mechanism through which governments and corporations borrow",
      "Cryptocurrency is a decentralised digital currency secured by cryptographic protocols",
      "Securitisation is the bundling of illiquid assets into tradeable financial instruments",
      "The shadow banking system operates outside regulated banking but performs similar functions",
      "Fiscal austerity is the reduction of government spending to decrease public debt",
      "Monetary policy is the management of interest rates and money supply by central banks",
      "Market liquidity is the ease with which assets can be bought and sold without moving prices",
      "Sovereign debt is money owed by a national government denominated in its own or foreign currency",
      "Index funds replicate the performance of a market index at minimal cost to investors",
      "The carried interest loophole allows fund managers to pay lower tax rates on performance fees",
      "Systemic risk is the danger that failure of one institution cascades through the financial system",
    ],
  },
];

type VizMode = "persistence" | "barcode" | "complex" | "betti";

interface TopologicalVoidsProps {
  onQueryTime: (time: number) => void;
}

export function TopologicalVoids({ onQueryTime }: TopologicalVoidsProps) {
  const [conceptsText, setConceptsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<TopologyResult[]>([]);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const handleCompute = async (overrideConcepts?: string[]) => {
    const concepts = overrideConcepts || conceptsText
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (concepts.length < 5) {
      setError(new Error("Need at least 5 concepts for meaningful topology."));
      return;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const modelVectors = await embedAll(concepts);
      const enabledModels = getEnabledModels();

      const newResults: TopologyResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return computeTopology(concepts, vectors, m.id, spec?.name || m.id);
        });

      setResults(newResults);
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Topological Voids</h2>
          <ResetButton onReset={() => { setConceptsText(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Persistent homology applied to the manifold. Where the Silence Detector measures
          density, this detects structural topology: isolated conceptual islands (H0),
          circular structures with empty interiors (H1), and how these features persist
          across geometric scales. The persistence diagram reveals the shape of what
          the manifold can and cannot represent. Use full propositional sentences rather
          than bare words for sharper topology: sentences pin concepts to specific
          regions of the manifold, producing more meaningful topological features.
        </p>
        <div className="space-y-3">
          <textarea
            value={conceptsText}
            onChange={e => setConceptsText(e.target.value)}
            placeholder="Enter propositional sentences separated by commas or newlines (e.g. 'Democracy means collective self-governance', 'Freedom is the absence of coercion')..."
            rows={4}
            className="input-editorial w-full resize-y"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => handleCompute()} disabled={loading || !conceptsText.trim()}
              className="btn-editorial-primary disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Compute Topology"}
            </button>
            <BenchmarkLoader onLoad={(concepts) => setConceptsText(concepts.join(", "))} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOPOLOGY_PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setConceptsText(p.concepts.join("\n")); handleCompute(p.concepts); }}
                className="btn-editorial-ghost text-caption px-2 py-1"
                disabled={loading}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={() => handleCompute()} />}

      {results.map(r => (
        <TopologyResultCard key={r.modelId} result={r} isDark={isDark} />
      ))}
    </div>
  );
}

// --- Per-model result card ---

function TopologyResultCard({ result, isDark }: { result: TopologyResult; isDark: boolean }) {
  const [vizMode, setVizMode] = useState<VizMode>("complex");
  const [threshold, setThreshold] = useState<number | null>(null);
  const [deepDive, setDeepDive] = useState(false);
  const [showVoids, setShowVoids] = useState(true);
  const [voidIntensity, setVoidIntensity] = useState(0.4);
  const [voidColor, setVoidColor] = useState("#e87a2a");

  const h0Features = result.features.filter(f => f.dimension === 0);
  const h1Features = result.features.filter(f => f.dimension === 1);
  const finiteH0 = h0Features.filter(f => f.death !== Infinity);
  const finiteH1 = h1Features.filter(f => f.death !== Infinity);

  const maxDist = result.filtrationEdges.length > 0
    ? result.filtrationEdges[result.filtrationEdges.length - 1].distance
    : 1;

  // Default threshold: median pairwise distance
  const effectiveThreshold = threshold ?? (maxDist * 0.5);

  // Most persistent finite H0 feature
  const mostPersistentH0 = finiteH0.length > 0
    ? finiteH0.reduce((a, b) => a.persistence > b.persistence ? a : b)
    : null;

  // Most persistent H1 feature
  const mostPersistentH1 = h1Features.length > 0
    ? h1Features.reduce((a, b) => (b.persistence === Infinity ? b : a.persistence > b.persistence ? a : b))
    : null;

  // Betti numbers at current threshold
  const bettiAtThreshold = useMemo(() => {
    let b0 = 0, b1 = 0;
    for (const f of result.features) {
      if (f.birth <= effectiveThreshold && (f.death === Infinity || effectiveThreshold < f.death)) {
        if (f.dimension === 0) b0++;
        else if (f.dimension === 1) b1++;
      }
    }
    return { b0, b1 };
  }, [result.features, effectiveThreshold]);

  // Components at threshold for void report
  const components = useMemo(
    () => componentsAtThreshold(result.concepts.length, result.filtrationEdges, effectiveThreshold),
    [result, effectiveThreshold],
  );

  // Active H1 features at threshold
  const activeH1 = useMemo(
    () => h1Features.filter(f => f.birth <= effectiveThreshold && (f.death === Infinity || effectiveThreshold < f.death)),
    [h1Features, effectiveThreshold],
  );

  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";
  const gridColor = isDark ? "#222233" : "#dddccc";
  const textColor = isDark ? "#c0c0d0" : "#3a3020";

  return (
    <div className="card-editorial overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <span className="font-sans text-body-sm font-semibold">{result.modelName}</span>
        <span className="font-sans text-caption text-muted-foreground">
          {result.concepts.length} concepts, {result.filtrationEdges.length} edges
        </span>
      </div>

      <div className="thin-rule mx-5" />

      {/* Summary metrics */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">H0 Features</div>
            <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{finiteH0.length}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5">component merges</div>
          </div>
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">H1 Features</div>
            <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{h1Features.length}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5">loops detected</div>
          </div>
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">&beta;&#8320; at &epsilon;</div>
            <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{bettiAtThreshold.b0}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5">components</div>
          </div>
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">&beta;&#8321; at &epsilon;</div>
            <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{bettiAtThreshold.b1}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5">loops</div>
          </div>
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Viz mode selector + threshold slider */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["persistence", "barcode", "complex", "betti"] as VizMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setVizMode(mode)}
              className={`px-2.5 py-1 rounded-sm text-caption font-medium transition-colors ${
                vizMode === mode
                  ? "bg-burgundy text-primary-foreground"
                  : "btn-editorial-ghost"
              }`}
            >
              {mode === "persistence" ? "Persistence" : mode === "barcode" ? "Barcode" : mode === "complex" ? "Rips Complex" : "Betti Curve"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="font-sans text-caption text-muted-foreground whitespace-nowrap">&epsilon; =</span>
          <input
            type="range"
            min={0}
            max={maxDist}
            step={maxDist / 200}
            value={effectiveThreshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="flex-1 h-1.5 bg-parchment rounded-full appearance-none cursor-pointer accent-burgundy"
          />
          <span className="font-sans text-caption tabular-nums text-muted-foreground w-12 text-right">
            {effectiveThreshold.toFixed(3)}
          </span>
        </div>
        {vizMode === "complex" && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showVoids}
                onChange={e => setShowVoids(e.target.checked)}
                className="rounded border-parchment-dark"
              />
              <span className="font-sans text-caption text-muted-foreground">Voids</span>
            </label>
            <div className={`flex items-center gap-1 transition-opacity ${showVoids ? "" : "opacity-30 pointer-events-none"}`}>
              {[
                { color: "#e87a2a", label: "Amber" },
                { color: "#8b1a1a", label: "Burgundy" },
                { color: "#3b82f6", label: "Blue" },
                { color: "#555555", label: "Smoke" },
              ].map(swatch => (
                <button
                  key={swatch.color}
                  onClick={() => setVoidColor(swatch.color)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    voidColor === swatch.color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.label}
                />
              ))}
            </div>
            <div className={`flex items-center gap-1.5 transition-opacity ${showVoids ? "" : "opacity-30 pointer-events-none"}`}>
              <span className="font-sans text-[10px] text-muted-foreground/50">light</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voidIntensity}
                onChange={e => setVoidIntensity(Number(e.target.value))}
                className="w-20 h-1 bg-parchment rounded-full appearance-none cursor-pointer accent-burgundy"
              />
              <span className="font-sans text-[10px] text-muted-foreground">dark</span>
            </div>
          </div>
        )}
      </div>

      <div className="thin-rule mx-5" />

      {/* Visualization */}
      <div className="px-2 py-2">
        {vizMode === "persistence" && (
          <PersistenceDiagram result={result} bgColor={bgColor} gridColor={gridColor} textColor={textColor} />
        )}
        {vizMode === "barcode" && (
          <BarcodeDiagram result={result} bgColor={bgColor} gridColor={gridColor} textColor={textColor} />
        )}
        {vizMode === "complex" && (
          <RipsComplex result={result} threshold={effectiveThreshold} bgColor={bgColor} gridColor={gridColor} textColor={textColor} isDark={isDark} showVoids={showVoids} voidIntensity={voidIntensity} voidColor={voidColor} />
        )}
        {vizMode === "betti" && (
          <BettiCurve result={result} threshold={effectiveThreshold} bgColor={bgColor} gridColor={gridColor} textColor={textColor} />
        )}
      </div>

      {/* Explanation text for selected viz mode */}
      <div className="px-5 pb-3">
        <p className="font-sans text-caption text-muted-foreground leading-relaxed italic">
          {vizMode === "persistence" && (
            <>
              <strong className="not-italic">Persistence Diagram.</strong> Each point represents a topological
              feature. The x-axis is the distance threshold at which the feature is born; the y-axis
              is when it dies. Points far from the diagonal (the dotted line) are persistent,
              meaning they survive across many scales and represent genuine structure rather than noise.
              Burgundy circles are H0 features (connected components that merge). Blue triangles
              are H1 features (loops that form and are later filled in). A point near the diagonal
              is ephemeral. A point far from it is a real topological signature of the manifold.
            </>
          )}
          {vizMode === "barcode" && (
            <>
              <strong className="not-italic">Barcode Diagram.</strong> Each horizontal bar is a topological
              feature. The bar starts at the feature&apos;s birth threshold and ends at its death.
              Longer bars represent more persistent features, the ones that survive across
              many scales. Short bars are topological noise. The diagram is sorted by persistence
              (longest bars on top). Burgundy bars are H0 (component merges); blue bars are
              H1 (loops). Read it as a fingerprint of the manifold&apos;s topological complexity:
              many long bars means rich, persistent structure; few short bars means the geometry
              is topologically simple.
            </>
          )}
          {vizMode === "complex" && (
            <>
              <strong className="not-italic">Rips Complex at &epsilon; = {effectiveThreshold.toFixed(3)}.</strong> This
              shows the simplicial complex at the selected threshold. Two concepts are connected
              by an edge if their cosine distance is less than &epsilon;. Connected components are
              coloured differently. Isolated concepts (not connected to anything at this scale)
              appear as solitary points, these are the concepts the manifold positions far from
              everything else. The faint particle cloud (toggle with &ldquo;Show voids&rdquo;)
              fills the regions where no concept exists: the unthinkable of the machine made
              visible as ghostly matter. These are the geometric gaps in the manifold, the
              positions in the embedding space that no concept occupies. Drag the threshold
              slider to watch the topology evolve.
            </>
          )}
          {vizMode === "betti" && (
            <>
              <strong className="not-italic">Betti Curve.</strong> The Betti numbers count topological features
              at each scale. &beta;&#8320; (burgundy) counts connected components: it starts at{" "}
              {result.concepts.length} (every concept isolated) and decreases toward 1 as concepts
              connect. &beta;&#8321; (blue) counts independent loops: it rises as cycles form and
              falls as they are filled in by triangles. The gold dashed line marks the current
              threshold. The curve is a signature of the manifold&apos;s topological complexity
              across all scales, read it left to right as a story of how the geometry assembles
              itself from isolation to connection.
            </>
          )}
        </p>
      </div>

      <div className="thin-rule mx-5" />

      {/* Void report */}
      <div className="px-5 py-4 space-y-4">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
          Void Report at &epsilon; = {effectiveThreshold.toFixed(3)}
        </h4>

        {/* Conceptual islands */}
        <div>
          <h5 className="font-sans text-caption font-semibold mb-1">
            Conceptual Islands ({components.length} component{components.length !== 1 ? "s" : ""})
          </h5>
          <div className="space-y-1.5">
            {components
              .sort((a, b) => a.length - b.length)
              .map((comp, i) => (
              <div key={i} className="bg-muted rounded-sm px-3 py-1.5">
                <span className={`font-sans text-body-sm ${comp.length === 1 ? "text-burgundy font-medium" : ""}`}>
                  {comp.length === 1 ? "Isolated: " : ""}
                  {comp.map(idx => result.concepts[idx]).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Persistent loops */}
        {activeH1.length > 0 && (
          <div>
            <h5 className="font-sans text-caption font-semibold mb-1">
              Persistent Loops ({activeH1.length})
            </h5>
            <div className="space-y-1.5">
              {activeH1.map((f, i) => (
                <div key={i} className="bg-muted rounded-sm px-3 py-1.5">
                  <span className="font-sans text-body-sm" style={{ color: "#3b82f6" }}>
                    {f.representativeIndices.map(idx => result.concepts[idx]).join(" → ")}
                  </span>
                  <span className="font-sans text-caption text-muted-foreground ml-2">
                    (born at {f.birth.toFixed(3)}{f.death !== Infinity ? `, dies at ${f.death.toFixed(3)}` : ", immortal"})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary sentence */}
        <p className="font-sans text-caption text-muted-foreground italic">
          At threshold &epsilon; = {effectiveThreshold.toFixed(3)}, the manifold has{" "}
          {bettiAtThreshold.b0} connected component{bettiAtThreshold.b0 !== 1 ? "s" : ""}{" "}
          and {bettiAtThreshold.b1} independent loop{bettiAtThreshold.b1 !== 1 ? "s" : ""}.
          {components.filter(c => c.length === 1).length > 0 &&
            ` ${components.filter(c => c.length === 1).length} concept${components.filter(c => c.length === 1).length !== 1 ? "s" : ""} remain${components.filter(c => c.length === 1).length === 1 ? "s" : ""} isolated.`
          }
        </p>
      </div>

      {/* Deep dive */}
      <button
        onClick={() => setDeepDive(!deepDive)}
        className="w-full px-5 py-2 border-t border-parchment flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-cream/50 transition-colors font-sans text-caption"
      >
        {deepDive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="uppercase tracking-wider font-semibold">Deep Dive</span>
        <span className="ml-2 font-normal">{result.features.length} features</span>
      </button>

      {deepDive && (
        <div className="px-5 pb-5 border-t border-parchment space-y-5 pt-4">
          {/* Most persistent features */}
          {mostPersistentH0 && (
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">Most Persistent H0 (Strongest Cluster Boundary)</div>
              <div className="font-sans text-body-sm">
                Concepts {mostPersistentH0.representativeIndices.map(i => result.concepts[i]).join(", ")} remained
                isolated until &epsilon; = {mostPersistentH0.death.toFixed(4)} (persistence: {mostPersistentH0.persistence.toFixed(4)})
              </div>
            </div>
          )}
          {mostPersistentH1 && (
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">Most Persistent H1 (Strongest Loop)</div>
              <div className="font-sans text-body-sm">
                Cycle: {mostPersistentH1.representativeIndices.map(i => result.concepts[i]).join(" → ")}
                {mostPersistentH1.death === Infinity
                  ? " (immortal, never filled in)"
                  : ` (born at ${mostPersistentH1.birth.toFixed(4)}, dies at ${mostPersistentH1.death.toFixed(4)})`
                }
              </div>
            </div>
          )}

          {/* Full feature table */}
          <div>
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              All Persistence Features
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-caption">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-semibold">Dim</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Birth</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Death</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Persistence</th>
                    <th className="text-left py-1.5 pl-3 text-muted-foreground font-semibold">Representatives</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.features]
                    .filter(f => f.death !== Infinity)
                    .sort((a, b) => b.persistence - a.persistence)
                    .slice(0, 50)
                    .map((f, i) => (
                    <tr key={i} className="border-b border-parchment/50 hover:bg-muted/30">
                      <td className="py-1.5 pr-3">
                        <span className="inline-block w-5 h-5 rounded-full text-[10px] text-white flex items-center justify-center"
                          style={{ backgroundColor: f.dimension === 0 ? "#8b1a1a" : "#3b82f6" }}>
                          {f.dimension}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{f.birth.toFixed(4)}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{f.death === Infinity ? "∞" : f.death.toFixed(4)}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{f.persistence === Infinity ? "∞" : f.persistence.toFixed(4)}</td>
                      <td className="py-1.5 pl-3 text-body-sm">{f.representativeIndices.map(idx => result.concepts[idx]).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* How this works */}
          <div className="p-3 bg-muted rounded-sm">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              How This Works
            </h4>
            <p className="font-sans text-caption text-muted-foreground leading-relaxed">
              Persistent homology builds a filtration: starting with each concept as an isolated
              point, it gradually increases a distance threshold &epsilon;. As &epsilon; grows,
              concepts within that distance become connected. Connected components (H0 features)
              are born when concepts first appear and die when their component merges with another.
              Loops (H1 features) are born when an edge connects two already-connected concepts,
              creating a cycle with no concept in its interior. Features that persist across many
              scales (long bars in the barcode, points far from the diagonal in the persistence
              diagram) represent genuine topological structure rather than noise. The voids, the
              regions where no concept exists, are the unthinkable of the machine: the manifold&apos;s
              structural gaps made visible through topology.
            </p>
          </div>

          {/* CSV export */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                const rows = ["dimension,birth,death,persistence,representative_concepts"];
                for (const f of [...result.features].sort((a, b) => b.persistence - a.persistence)) {
                  const reps = f.representativeIndices.map(i => result.concepts[i]).join("; ");
                  rows.push(`${f.dimension},${f.birth.toFixed(6)},${f.death === Infinity ? "Infinity" : f.death.toFixed(6)},${f.persistence === Infinity ? "Infinity" : f.persistence.toFixed(6)},"${reps}"`);
                }
                const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `topological-voids-${result.modelId}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-editorial-ghost text-caption px-3 py-1.5"
            >
              <Download size={14} className="mr-1 inline" />Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Visualization sub-components ---

function PersistenceDiagram({ result, bgColor, gridColor, textColor }: {
  result: TopologyResult; bgColor: string; gridColor: string; textColor: string;
}) {
  const h0 = result.features.filter(f => f.dimension === 0 && f.death !== Infinity);
  const h1 = result.features.filter(f => f.dimension === 1 && f.death !== Infinity);
  const maxVal = Math.max(
    ...h0.map(f => f.death),
    ...h1.map(f => f.death),
    ...h0.map(f => f.birth),
    ...h1.map(f => f.birth),
    0.1,
  );

  const data: any[] = [
    // Diagonal line
    { x: [0, maxVal], y: [0, maxVal], mode: "lines", line: { color: gridColor, width: 1, dash: "dot" }, showlegend: false, hoverinfo: "skip" },
    // H0 features
    {
      x: h0.map(f => f.birth),
      y: h0.map(f => f.death),
      mode: "markers",
      marker: { color: "#8b1a1a", size: 8, symbol: "circle" },
      text: h0.map(f => `H0: ${f.representativeIndices.map(i => result.concepts[i]).join(", ")}<br>persistence: ${f.persistence.toFixed(4)}`),
      hoverinfo: "text",
      name: "H0 (components)",
    },
    // H1 features
    {
      x: h1.map(f => f.birth),
      y: h1.map(f => f.death),
      mode: "markers",
      marker: { color: "#3b82f6", size: 8, symbol: "triangle-up" },
      text: h1.map(f => `H1: ${f.representativeIndices.map(i => result.concepts[i]).join(" → ")}<br>persistence: ${f.persistence.toFixed(4)}`),
      hoverinfo: "text",
      name: "H1 (loops)",
    },
  ];

  const layout = {
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    font: { color: textColor, family: "Inter, sans-serif" },
    xaxis: { title: "Birth", gridcolor: gridColor, zeroline: false, range: [-0.01, maxVal * 1.05] },
    yaxis: { title: "Death", gridcolor: gridColor, zeroline: false, range: [-0.01, maxVal * 1.05] },
    margin: { t: 30, r: 20, b: 50, l: 60 },
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
    height: 400,
  };

  return (
    <div className="rounded-sm overflow-hidden border border-parchment">
      <PlotlyPlot data={data} layout={layout} config={{ displayModeBar: false, responsive: true }} />
    </div>
  );
}

function BarcodeDiagram({ result, bgColor, gridColor, textColor }: {
  result: TopologyResult; bgColor: string; gridColor: string; textColor: string;
}) {
  const finite = result.features
    .filter(f => f.death !== Infinity)
    .sort((a, b) => b.persistence - a.persistence)
    .slice(0, 40);

  const data: any[] = finite.map((f, i) => ({
    x: [f.birth, f.death],
    y: [i, i],
    mode: "lines",
    line: { color: f.dimension === 0 ? "#8b1a1a" : "#3b82f6", width: 6 },
    text: `H${f.dimension}: ${f.representativeIndices.map(idx => result.concepts[idx]).join(f.dimension === 0 ? ", " : " → ")}`,
    hoverinfo: "text",
    showlegend: false,
  }));

  const layout = {
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    font: { color: textColor, family: "Inter, sans-serif", size: 10 },
    xaxis: { title: "Distance threshold", gridcolor: gridColor, zeroline: false },
    yaxis: {
      tickvals: finite.map((_, i) => i),
      ticktext: finite.map(f => {
        const label = f.representativeIndices.slice(0, 2).map(idx => result.concepts[idx]).join(", ");
        return `H${f.dimension}: ${label.length > 20 ? label.slice(0, 20) + "..." : label}`;
      }),
      gridcolor: gridColor,
      autorange: "reversed" as const,
    },
    margin: { t: 20, r: 20, b: 50, l: 180 },
    height: Math.max(300, finite.length * 18 + 80),
  };

  return (
    <div className="rounded-sm overflow-hidden border border-parchment">
      <PlotlyPlot data={data} layout={layout} config={{ displayModeBar: false, responsive: true }} />
    </div>
  );
}

function RipsComplex({ result, threshold, isDark, showVoids, voidIntensity, voidColor }: {
  result: TopologyResult; threshold: number; bgColor: string; gridColor: string; textColor: string; isDark: boolean; showVoids: boolean; voidIntensity: number; voidColor: string;
}) {
  const coords3D = useMemo(() => {
    const projected = projectPCA3D(result.distMatrix);
    return spreadPoints3D(projected, new Set(), 0.08, 60);
  }, [result.distMatrix]);

  const edges = useMemo(() => edgesAtThreshold(result.filtrationEdges, threshold), [result.filtrationEdges, threshold]);
  const comps = useMemo(() => componentsAtThreshold(result.concepts.length, result.filtrationEdges, threshold), [result, threshold]);

  const COMP_COLORS = ["#8b1a1a", "#3b82f6", "#d4a017", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#f97316"];

  const nodes = useMemo(() => result.concepts.map((concept, i) => {
    const compIdx = comps.findIndex(comp => comp.includes(i));
    const comp = comps[compIdx];
    const color = COMP_COLORS[compIdx % COMP_COLORS.length];
    const words = concept.split(/\s+/);
    const shortLabel = words.length > 3 ? words.slice(0, 3).join(" ") + "..." : concept;
    return {
      label: concept,
      shortLabel,
      coords: coords3D[i] as [number, number, number],
      color,
      isolated: comp.length === 1,
      componentId: compIdx,
      componentSize: comp.length,
    };
  }), [result.concepts, coords3D, comps]);

  // Build node colour lookup for edge colouring
  const nodeColorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (let ci = 0; ci < comps.length; ci++) {
      const color = COMP_COLORS[ci % COMP_COLORS.length];
      for (const idx of comps[ci]) map.set(idx, color);
    }
    return map;
  }, [comps]);

  const edgeData = useMemo(() => edges.map(e => ({
    from: coords3D[e.i] as [number, number, number],
    to: coords3D[e.j] as [number, number, number],
    color: nodeColorMap.get(e.i) || "#888888",
  })), [edges, coords3D, nodeColorMap]);

  return <TopologyScene nodes={nodes} edges={edgeData} isDark={isDark} showVoids={showVoids} voidIntensity={voidIntensity} voidColor={voidColor} />;
}

function BettiCurve({ result, threshold, bgColor, gridColor, textColor }: {
  result: TopologyResult; threshold: number; bgColor: string; gridColor: string; textColor: string;
}) {
  const data: any[] = [
    {
      x: result.bettiCurve.map(p => p.threshold),
      y: result.bettiCurve.map(p => p.beta0),
      mode: "lines",
      line: { color: "#8b1a1a", width: 2 },
      name: "β₀ (components)",
    },
    {
      x: result.bettiCurve.map(p => p.threshold),
      y: result.bettiCurve.map(p => p.beta1),
      mode: "lines",
      line: { color: "#3b82f6", width: 2 },
      name: "β₁ (loops)",
    },
    // Vertical threshold line
    {
      x: [threshold, threshold],
      y: [0, Math.max(...result.bettiCurve.map(p => Math.max(p.beta0, p.beta1)), 1)],
      mode: "lines",
      line: { color: "#d4a017", width: 1, dash: "dash" },
      name: `ε = ${threshold.toFixed(3)}`,
      showlegend: true,
    },
  ];

  const layout = {
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    font: { color: textColor, family: "Inter, sans-serif" },
    xaxis: { title: "Distance threshold (ε)", gridcolor: gridColor, zeroline: false },
    yaxis: { title: "Betti number", gridcolor: gridColor, zeroline: false },
    margin: { t: 30, r: 20, b: 50, l: 60 },
    legend: { x: 0.7, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
    height: 350,
  };

  return (
    <div className="rounded-sm overflow-hidden border border-parchment">
      <PlotlyPlot data={data} layout={layout} config={{ displayModeBar: false, responsive: true }} />
    </div>
  );
}

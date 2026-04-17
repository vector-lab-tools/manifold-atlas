"use client";

import { useRef, useState, useEffect } from "react";
import { HelpCircle, X, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { ReadingListModal } from "./ReadingListModal";

interface HelpSection {
  title: string;
  content: string;
  link?: { label: string; url: string };
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "What is Vector Space?",
    link: { label: "What is Vector Space?", url: "https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html" },
    content: "Vector space is the mathematical container in which embedding models represent meaning. Every word, phrase, or sentence is converted into a list of numbers (a vector) with hundreds or thousands of dimensions. These numbers are coordinates in a high-dimensional space. The properties of this space — its dimensionality, numerical precision, and structure — are not neutral. They are determined by hardware economics and training decisions. Vector space is not a passive container but a materially grained substrate whose properties shape what can and cannot be represented within it. A terminological note: other scholars use 'embedding space' (Impett and Offert 2026) or 'latent space' (Somaini 2025) for related but distinct concepts. 'Latent space' collapses the vector space and the manifold into a single term, obscuring the material properties of the container and the political questions they raise. 'Embedding space' foregrounds the technical operation of embedding but not the ownership structure. 'Vector space' names the mathematical form and opens the political questions: whose dimensions, at what precision, under what ownership?",
  },
  {
    title: "What is the Manifold?",
    link: { label: "What is the Manifold?", url: "https://stunlaw.blogspot.com/2026/03/what-is-manifold.html" },
    content: "The manifold is the learned geometric structure that sits within vector space. During training, the model learns to arrange concepts in a curved, high-dimensional surface where position encodes meaning and proximity encodes association. The manifold is not the vector space itself but a geometric shape within it — like a crumpled sheet of paper in a room. It is a Formbestimmung (formal determination): an abstract, non-material principle that organises meaning from within. The manifold does not represent the world; it constitutes geometric relations that determine what counts as similar, related, or opposed. Note: 'manifold' is used here in the sense theorised by David M. Berry, rather than the strict mathematical use. The term names the geometric space produced by training as a material object shaped by the data, compute, and decisions that produced it. In the case of commercial models, this geometry is proprietary and accessed through a paid API. In the case of open-weight models, the geometry is inspectable but still determined by the conditions of its production.",
  },
  {
    title: "What is the Embedding API?",
    content: "The embedding API is the interface through which you can observe the manifold. You send text in; you get coordinates back. It is the telescope: it lets you see where concepts are positioned in the geometry, but you cannot visit the space itself or modify it. Crucially, the embedding API is deterministic: the same text sent to the same model will always return the same vector. This means results are reproducible. If you measure the distance between 'justice' and 'compliance' today and again tomorrow, you will get the same number (assuming the model version has not changed). Manifold Atlas caches all embeddings locally for this reason — once a vector has been computed, it never needs to be recomputed. Technical note: commercial embedding APIs return processed, averaged representations (likely from the final layer of a separately-trained model), not raw token embeddings or direct access to a chat model's internal geometry. This makes the telescope metaphor more precise, not less — a telescope shows you light refracted through lenses, not the star itself. You are studying a proprietary geometry through a proprietary aperture. Embedding models are also trained on sentence-level pairs, so single words and full phrases may produce different results. For more precise readings, consider embedding phrases like 'the concept of justice' rather than bare terms like 'justice'.",
  },
  {
    title: "Single Words vs Sentences",
    content: "Passing 'justice' as a bare token is different from passing 'the concept of justice' or 'the meaning of justice'. Embedding models are trained on sentence-level pairs, so a single word and a phrase containing that word may produce different geometric positions. If they diverge significantly, that is evidence for the context-sensitivity of the geometry: the manifold positions the same concept differently depending on how it is framed. If they converge, it tells us something about the robustness of the geometric positioning: the concept has a stable coordinate regardless of phrasing. The Concept Drift feature in Manifold Atlas measures something adjacent — how contextual framing warps a concept's position — and can be used to test this directly by entering both bare terms and definitional phrasings as variants.",
  },
  {
    title: "What is Cosine Similarity?",
    content: "Cosine similarity measures the angle between two vectors, ignoring their magnitude. It ranges from -1 (opposite directions) through 0 (orthogonal, no relationship) to 1 (identical direction). In practice, most embedding similarities fall between 0.3 and 1.0. A similarity of 0.9 between two concepts means the manifold treats them as very close neighbours. This is the primary instrument of Manifold Atlas: every operation ultimately measures cosine similarity and interprets what it means.",
  },
  {
    title: "What is Vector Logic?",
    link: { label: "Vector Theory", url: "https://stunlaw.blogspot.com/2026/02/vector-theory.html" },
    content: "Vector logic names the move from symbolic logic (A is not B) to geometric reasoning (A is near B). Where symbolic logic works through categorical exclusion — propositions are either true or false, categories admit no overlap — vector logic works through proximity, direction, and arithmetic in embedding space. Meaning is encoded as position; similarity replaces identity; angular distance replaces contradiction; addition and subtraction of vectors replaces deductive inference. This is the operative logic of contemporary AI systems: they do not reason through deduction or categorical distinction but through cosine similarity and linear combination in a learned manifold. Vector logic is the regime of the vector society, the counterpart to Foucault's disciplinary logic and Deleuze's control logic. Several operations in Manifold Atlas probe it directly. The Vector Logic operation tests its narrowest form — whether analogical inference (king minus man plus woman equals queen) can be performed as arithmetic on embedding vectors. The Negation Gauge tests its deficit around negation. The Hegemony Compass tests its ideological orientations. Together the instrument lets you see vector logic at work across multiple dimensions of the claim.",
  },
  {
    title: "The Negation Deficit",
    link: { label: "Negative Vectors", url: "https://stunlaw.blogspot.com/" },
    content: "Negation operates in a counterintuitive way in the manifold, and not at all how we might expect. The geometry does not encode 'A' and 'not A' as opposites, or as points far apart in the space. Instead, they are stored close together. The difference between a claim and its negation is typically a small rotation in a few dimensions — roughly 90 degrees in a small subspace — while the hundreds of other dimensions remain almost identical. This means 'this policy is fair' and 'this policy is not fair' often have cosine similarity above 0.9, because the vast majority of their coordinates are shared. The manifold does have some capacity for negation, but it is geometrically subtle: a minor perturbation where logic demands a categorical inversion. In everyday reasoning, negation flips the meaning entirely. In the manifold, it nudges the position slightly. This is the negation deficit: not that negation is absent, but that the geometry allocates it so little space that it becomes practically invisible relative to the conceptual work negation is supposed to do.",
  },
  {
    title: "Geometric Ideology",
    content: "Classical ideology critique assumes ideology makes claims — representations, propositions, narratives that misrepresent social relations. The manifold makes no claims. It orients, clusters, and makes some trajectories probable. Geometric ideology is hegemony that operates through topology (density, sparsity, trajectory) rather than discourse (propositions, narratives, interpellation). The dense regions of the manifold are where the dominant meanings live. The sparse regions are where the silences are. The Neighbourhood Map, Hegemony Compass, and Silence Detector make this visible.",
  },
  {
    title: "Real Abstraction",
    link: { label: "Real Abstraction Without Exchange", url: "https://stunlaw.blogspot.com/2026/03/real-abstraction-without-exchange.html" },
    content: "Sohn-Rethel argued that the exchange of commodities performs a real abstraction: it practically sets aside the qualitative differences between things, reducing them to commensurable quantities. The embedding layer performs the same operation at the level of meaning. Heterogeneous texts — a poem, a legal contract, a love letter — are converted into homogeneous geometric coordinates. The Sohn-Rethel Test measures how far this abstraction has progressed across different domains of human experience.",
  },
  {
    title: "The Proprietary Medium",
    link: { label: "The Vector Medium", url: "https://stunlaw.blogspot.com/" },
    content: "Every vector observed through the embedding API was computed by a corporation that controls the geometry. The training data, the architecture, the loss function, the RLHF process — all are proprietary. You are paying the owner of the manifold for the privilege of observing it, and they control the resolution of the instrument. The political economy of the method is built into its conditions of possibility. This is why multi-model comparison matters: it reveals whether geometric politics are structural to the medium or contingent on particular training decisions.",
  },
];

export function HelpDropdown() {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [readingListOpen, setReadingListOpen] = useState(false);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // When a section expands, scroll it into view within the dropdown so
  // the newly revealed prose isn't hidden above or below the viewport.
  useEffect(() => {
    if (expandedSection === null) return;
    const el = sectionRefs.current[expandedSection];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expandedSection]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-editorial-ghost px-3 py-2"
        title="Help: Vector Theory concepts"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-[4.5rem] right-4 z-50 w-[640px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5.5rem)] overflow-y-auto card-editorial shadow-editorial-lg">
            <div className="p-4 border-b border-parchment flex items-center justify-between">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/vector-lab-manifold-atlas.svg"
                  alt=""
                  width={32}
                  height={32}
                  aria-hidden="true"
                  className="block flex-shrink-0 mt-0.5"
                />
                <div>
                  <h2 className="font-display text-display-md font-bold">Vector Theory Guide</h2>
                  <p className="font-sans text-caption text-muted-foreground mt-0.5">
                    Key concepts for understanding Manifold Atlas
                  </p>
                  <p className="font-sans text-caption text-muted-foreground mt-1">
                    Part of the{" "}
                    <a
                      href="https://vector-lab-tools.github.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
                    >
                      Vector Lab
                    </a>
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="btn-editorial-ghost px-2 py-1">
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-parchment">
              {HELP_SECTIONS.map((section, i) => (
                <div
                  key={i}
                  ref={el => {
                    sectionRefs.current[i] = el;
                  }}
                >
                  <button
                    onClick={() => setExpandedSection(expandedSection === i ? null : i)}
                    className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-cream/50 transition-colors"
                  >
                    {expandedSection === i ? <ChevronDown size={14} className="text-burgundy" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                    <span className="font-sans text-body-sm font-semibold">{section.title}</span>
                  </button>
                  {expandedSection === i && (
                    <div className="px-4 pb-4 pl-10">
                      <p className="font-body text-body-sm text-slate leading-relaxed">
                        {section.content}
                      </p>
                      {section.link && (
                        <p className="mt-2">
                          <a
                            href={section.link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans text-caption text-burgundy underline underline-offset-2 hover:text-burgundy-900"
                          >
                            {section.link.label} &rarr;
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-parchment flex items-center justify-between">
              <p className="font-sans text-caption text-muted-foreground">
                Based on <a href="https://stunlaw.blogspot.com/2026/02/vector-theory.html" target="_blank" rel="noopener noreferrer" className="text-burgundy underline">Vector Theory</a> by David M. Berry.
              </p>
              <button
                onClick={() => { setReadingListOpen(true); setOpen(false); }}
                className="flex items-center gap-1 font-sans text-caption text-burgundy hover:text-burgundy-900 transition-colors"
              >
                <BookOpen size={12} />
                Suggested Reading List...
              </button>
            </div>
          </div>
        </>
      )}

      <ReadingListModal open={readingListOpen} onClose={() => setReadingListOpen(false)} />
    </div>
  );
}

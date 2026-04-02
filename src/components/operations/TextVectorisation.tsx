/**
 * Manifold Atlas — Text Vectorisation
 * Concept and Design: David M. Berry, University of Sussex
 */

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Play, Pause, RotateCcw, ChevronRight, ChevronDown, Download, SkipBack, SkipForward } from "lucide-react";
import { encode, decode } from "gpt-tokenizer";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { projectPCA3D, spreadPoints3D } from "@/lib/geometry/pca";
import { ResetButton } from "@/components/shared/ResetButton";
import { tokeniseText, type AnnotatedWord } from "@/lib/text/stopwords";
import { EMBEDDING_MODELS } from "@/types/embeddings";

const TextWalkScene = dynamic(
  () => import("@/components/viz/TextWalkScene").then(mod => ({ default: mod.TextWalkScene })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm rounded-sm">Loading 3D scene...</div> }
);

// --- Preset texts ---

const TEXT_PRESETS: Array<{ label: string; text: string; source: string }> = [
  {
    label: "Hinton (1977)",
    source: "Geoffrey Hinton, 'Relaxation and its Role in Vision', 1977",
    text: `Using reduced descriptions it is possible to see the landscape of the nervous system as a space in which each concept or each state of affairs is a point and the distance between points represents how different the concepts are. Similarity becomes distance and knowing becomes a matter of finding the right place in the space. The knowledge is not in the individual connections but in the positions of the points relative to each other.`,
  },
  {
    label: "Deleuze, Control",
    source: "Gilles Deleuze, Postscript on the Societies of Control, 1990",
    text: `The different control mechanisms are inseparable variations, forming a system of variable geometry the language of which is numerical. Enclosures are molds, distinct castings, but controls are a modulation, like a self-deforming cast that will continuously change from one moment to the other, or like a sieve whose mesh will transmute from point to point. The corporation has replaced the factory, and the corporation is a spirit, a gas. The corporation constantly presents the brashest rivalry as a healthy form of emulation, an excellent motivational force that opposes individuals against one another and runs through each, dividing each within.`,
  },
  {
    label: "Impett & Offert",
    source: "Leonardo Impett and Fabian Offert, Vector Media, 2026",
    text: `Almost all contemporary artificial intelligence systems can be understood as vector media. They no longer embody a theory of vision alone, but also a theory of knowledge manifested in the central role that vector spaces play in the modeling of culture. At the heart of contemporary machine vision lies embedding, which enables the creation of vector spaces that establish relationships between cultural artifacts. But to establish such relationships these artifacts first have to be made commensurable.`,
  },
  {
    label: "Kittler, No Software",
    source: "Friedrich Kittler, There Is No Software, 1995",
    text: `Software, if it existed, would just be a billion dollar deal based on the cheapest elements on earth. Silicon and its oxide provide for perfect hardware architectures. The millions of basic elements work under almost the same physical conditions, especially as regards temperature dependent degradations, and yet electrically all of them are highly isolated from each other. Only this paradoxical relation between two physical parameters, thermal continuity and electrical discretization on chip, allows integrated circuits to approximate that Universal Discrete Machine into which its inventor's name has long disappeared.`,
  },
  {
    label: "Rosenblatt (1962)",
    source: "Frank Rosenblatt, Principles of Neurodynamics, 1962",
    text: `For this writer, the perceptron program is not primarily concerned with the invention of devices for artificial intelligence, but rather with investigating the physical structures and neurodynamic principles which underlie natural intelligence. A perceptron is first and foremost a brain model, not an invention for pattern recognition. As a brain model, its utility is in enabling us to determine the physical conditions for the emergence of various psychological properties.`,
  },
  {
    label: "Weizenbaum",
    source: "Joseph Weizenbaum, Computer Power and Human Reason, 1976",
    text: `The computer programmer is a creator of universes for which he alone is the lawgiver. No playwright, no stage director, no emperor, however powerful, has ever exercised such absolute authority to arrange a stage or a field of battle and to command such unswervingly combatant or combative forces. The computer is a playing field on which one may play out any game one can imagine. One may create worlds in which there is no gravity, or in which two plus two equals five.`,
  },
  {
    label: "Berry, Vector Medium",
    source: "David M. Berry, The Vector Medium, 2026",
    text: `In The Philosophy of Software, Berry drawing on Kittler's argument that the digital causes an implosion of previously distinct media forms, I argued that code functions as a super-medium, a medium that contains the fragmented media of the twentieth century but also radically reshapes and transforms them into a new unity. Manovich made a similar argument that software simulates all prior media whilst adding properties native to computation itself constituting what he calls a metamedium. This followed from Negroponte's claim that we were in the middle of a transition from atoms to bits. With the turn to artificial intelligence and the rise of a different form of storage, if we can call it that, we have what we might term a vectorial turn which produces a new substrate and I am calling this a vector medium. If the digital transformation created a medium which was interoperable across media forms, then the vector medium is creating conditions for inseparability across media forms.`,
  },
];

// --- Data types ---

interface NearbyWord {
  word: string;
  similarity: number;
  coordIdx: number;
}

interface TextWalkStep {
  wordIndex: number;
  word: string;
  textPosition: number;
  coords: [number, number, number];
  nearby: NearbyWord[];
}

interface TextWalkResult {
  modelId: string;
  modelName: string;
  steps: TextWalkStep[];
  wordPoints: Array<{ word: string; coords: [number, number, number]; frequency: number }>;
  uniqueWords: string[];
  allWords: AnnotatedWord[];
  sourceText: string;
}

interface TextVectorisationProps {
  onQueryTime: (time: number) => void;
}

export function TextVectorisation({ onQueryTime }: TextVectorisationProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<TextWalkResult[]>([]);
  const [filterStops, setFilterStops] = useState(false);
  const [wordCount, setWordCount] = useState<{ unique: number; total: number; truncated: boolean } | null>(null);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  // Live word count preview
  const handleTextChange = (value: string) => {
    setText(value);
    if (value.trim().length > 0) {
      const { uniqueWords, textSequence, truncated } = tokeniseText(value, 200, filterStops);
      setWordCount({ unique: uniqueWords.length, total: textSequence.length, truncated });
    } else {
      setWordCount(null);
    }
  };

  const handleCompute = async () => {
    const effectiveText = text.trim();
    if (!effectiveText) return;

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const { uniqueWords, textSequence, wordFrequency, allWords, truncated } = tokeniseText(effectiveText, 200, filterStops);

      if (uniqueWords.length < 3) {
        throw new Error("Text too short: need at least 3 unique content words.");
      }

      // Batch embedding: split into chunks of 96 to avoid API limits
      const BATCH_SIZE = 96;
      const batches: string[][] = [];
      for (let i = 0; i < uniqueWords.length; i += BATCH_SIZE) {
        batches.push(uniqueWords.slice(i, i + BATCH_SIZE));
      }

      // Embed each batch and merge results
      const mergedVectors = new Map<string, number[][]>();
      for (const batch of batches) {
        const batchResult = await embedAll(batch);
        for (const [modelId, vectors] of batchResult) {
          if (!mergedVectors.has(modelId)) mergedVectors.set(modelId, []);
          mergedVectors.get(modelId)!.push(...vectors);
        }
      }

      const modelVectors = mergedVectors;
      const enabledModels = getEnabledModels();

      const newResults: TextWalkResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;

          // PCA projection
          const rawCoords = projectPCA3D(vectors);
          // Spread all points (no fixed indices)
          const coords = spreadPoints3D(rawCoords, new Set(), 0.10, 80);

          // Precompute similarity matrix
          const n = uniqueWords.length;
          const simMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
          for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
              const s = cosineSimilarity(vectors[i], vectors[j]);
              simMatrix[i][j] = s;
              simMatrix[j][i] = s;
            }
            simMatrix[i][i] = 1;
          }

          // Build word-to-index map
          const wordToIdx = new Map<string, number>();
          uniqueWords.forEach((w, i) => wordToIdx.set(w, i));

          // Build steps from text sequence
          const steps: TextWalkStep[] = textSequence.map((word, textPos) => {
            const idx = wordToIdx.get(word)!;
            // Get nearest neighbours from similarity matrix
            const sims: NearbyWord[] = [];
            for (let j = 0; j < n; j++) {
              if (j === idx) continue;
              sims.push({
                word: uniqueWords[j],
                similarity: simMatrix[idx][j],
                coordIdx: j,
              });
            }
            sims.sort((a, b) => b.similarity - a.similarity);

            return {
              wordIndex: idx,
              word,
              textPosition: textPos,
              coords: coords[idx] as [number, number, number],
              nearby: sims.slice(0, 10),
            };
          });

          // Build word points
          const wordPoints = uniqueWords.map((word, i) => ({
            word,
            coords: coords[i] as [number, number, number],
            frequency: wordFrequency.get(word) || 1,
          }));

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            modelId: m.id,
            modelName: spec?.name || m.id,
            steps,
            wordPoints,
            uniqueWords,
            allWords,
            sourceText: effectiveText,
          };
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
          <h2 className="font-display text-display-md font-bold">Text Vectorisation</h2>
          <ResetButton onReset={() => { setText(""); setResults([]); setError(null); setWordCount(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Paste a passage of text and watch a particle trace its reading path through the manifold.
          Each unique word is embedded and projected to 3D. As the particle visits each word
          in reading order, its nearest neighbours in the embedding space light up,
          revealing how the text moves through semantic geometry.
        </p>
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Paste a passage, quote, or paragraph here..."
            rows={6}
            className="input-editorial w-full resize-y"
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleCompute(); }}
          />
          <div className="flex items-center justify-between">
            {wordCount ? (
              <p className="font-sans text-caption text-muted-foreground">
                {wordCount.unique} unique words to embed, {wordCount.total} words in sequence
                {wordCount.truncated && <span className="text-burgundy"> (capped at 200)</span>}
              </p>
            ) : <span />}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filterStops}
                onChange={e => { setFilterStops(e.target.checked); if (text.trim()) { const { uniqueWords, textSequence, truncated } = tokeniseText(text, 100, e.target.checked); setWordCount({ unique: uniqueWords.length, total: textSequence.length, truncated }); } }}
                className="rounded border-parchment-dark"
              />
              <span className="font-sans text-caption text-muted-foreground">Filter stop words</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCompute} disabled={loading || !text.trim()}
              className="btn-editorial-primary disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Vectorise"}
            </button>
            <span className="font-sans text-caption text-muted-foreground">
              Cmd+Enter to compute
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_PRESETS.map((p, i) => (
              <button key={i} onClick={() => handleTextChange(p.text)}
                className="btn-editorial-ghost text-caption px-2 py-1">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {results.map(r => (
        <TextWalkPlayer key={r.modelId} result={r} isDark={isDark} />
      ))}
    </div>
  );
}

function TextWalkPlayer({ result, isDark }: { result: TextWalkResult; isDark: boolean }) {
  const [progress, setProgress] = useState(0);
  const [walking, setWalking] = useState(false);
  const [firstPerson, setFirstPerson] = useState(false);
  const [deepDive, setDeepDive] = useState(false);
  const [trailColor, setTrailColor] = useState("#ef4444");

  // BPE subword tokens (cl100k_base, same as OpenAI embeddings)
  const bpeTokens = useMemo(() => {
    try {
      const ids = encode(result.sourceText);
      return ids.map(id => decode([id]));
    } catch {
      return null;
    }
  }, [result.sourceText]);
  const textPanelHeight = 140;
  const [readSpeed, setReadSpeed] = useState(0.04);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const speedRef = useRef(readSpeed);
  speedRef.current = readSpeed;
  const totalSteps = result.steps.length;

  const startWalk = useCallback(() => {
    // If at the end, restart from beginning
    if (progressRef.current >= totalSteps - 1) {
      progressRef.current = 0;
      setProgress(0);
    }

    const step = () => {
      progressRef.current += speedRef.current;
      if (progressRef.current >= totalSteps - 1) {
        // Stop at the end
        progressRef.current = totalSteps - 1;
        setProgress(totalSteps - 1);
        setWalking(false);
        return;
      }
      setProgress(Math.floor(progressRef.current));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [totalSteps, progress]);

  const stopWalk = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (walking) startWalk();
    else stopWalk();
    return stopWalk;
  }, [walking, startWalk, stopWalk]);

  const currentStep = result.steps[progress] || result.steps[0];

  return (
    <div className="card-editorial overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <span className="font-sans text-body-sm font-semibold">{result.modelName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWalking(false); const p = Math.max(0, progress - 1); setProgress(p); progressRef.current = p; }}
            disabled={progress <= 0}
            className="btn-editorial-ghost px-1.5 py-1.5 disabled:opacity-30"
            title="Step back"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => setWalking(!walking)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-body-sm font-medium bg-burgundy text-primary-foreground hover:bg-burgundy-900 transition-colors"
          >
            {walking ? <Pause size={14} /> : <Play size={14} />}
            {walking ? "Pause" : "Read"}
          </button>
          <button
            onClick={() => { setWalking(false); const p = Math.min(totalSteps - 1, progress + 1); setProgress(p); progressRef.current = p; }}
            disabled={progress >= totalSteps - 1}
            className="btn-editorial-ghost px-1.5 py-1.5 disabled:opacity-30"
            title="Step forward"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={() => setFirstPerson(!firstPerson)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-sm text-body-sm font-medium transition-colors ${
              firstPerson ? "bg-gold text-white" : "btn-editorial-ghost"
            }`}
          >
            {firstPerson ? "Riding" : "Ride"}
          </button>
          <button
            onClick={() => { setWalking(false); setProgress(0); progressRef.current = 0; setFirstPerson(false); }}
            className="btn-editorial-ghost px-2 py-1.5"
          >
            <RotateCcw size={14} />
          </button>
          <div className="flex items-center gap-1.5 ml-2 border-l border-parchment pl-2">
            <span className="font-sans text-[10px] text-muted-foreground">slow</span>
            <input
              type="range"
              min={0.005}
              max={0.15}
              step={0.005}
              value={readSpeed}
              onChange={e => setReadSpeed(Number(e.target.value))}
              className="w-16 h-1 bg-parchment rounded-full appearance-none cursor-pointer accent-burgundy"
            />
            <span className="font-sans text-[10px] text-muted-foreground">fast</span>
          </div>
          <div className="flex items-center gap-1 ml-2 border-l border-parchment pl-2">
            {[
              { color: "#ef4444", label: "Red" },
              { color: "#e87a2a", label: "Amber" },
              { color: "#3b82f6", label: "Blue" },
              { color: "#22c55e", label: "Green" },
              { color: "#a855f7", label: "Purple" },
            ].map(swatch => (
              <button
                key={swatch.color}
                onClick={() => setTrailColor(swatch.color)}
                className={`w-4 h-4 rounded-full border-2 transition-transform ${
                  trailColor === swatch.color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: swatch.color }}
                title={swatch.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Progress bar and current word */}
      <div className="px-5 py-3 bg-muted/30">
        <div className="flex items-center justify-between mb-1">
          <span className="font-sans text-caption text-muted-foreground">
            Word {progress + 1} / {totalSteps}
          </span>
          <span className="font-sans text-body-sm font-bold" style={{ color: "#ef4444" }}>
            {currentStep?.word}
          </span>
          <span className="font-sans text-caption tabular-nums text-muted-foreground">
            nearest: {currentStep?.nearby?.[0]?.word} ({currentStep?.nearby?.[0]?.similarity?.toFixed(3)})
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={progress}
          onChange={e => { setProgress(Number(e.target.value)); progressRef.current = Number(e.target.value); }}
          className="w-full h-1.5 bg-parchment rounded-full appearance-none cursor-pointer accent-burgundy"
        />
      </div>

      <div className="thin-rule mx-5" />

      {/* Source text with current word highlighted (resizable) */}
      <div className="px-5 py-3">
        <div className="overflow-y-auto resize-y" style={{ height: textPanelHeight, minHeight: 60, maxHeight: 400 }}>
          <h5 className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 sticky top-0 bg-card pb-0.5">
            Source Text ({result.steps.length} words &rarr; {result.uniqueWords.length} vectors)
          </h5>
          <p className="font-serif text-body-sm leading-relaxed">
            {result.allWords.map((aw, i) => {
              const isCurrent = aw.isContent && aw.sequenceIndex === progress;
              const isPast = aw.isContent && aw.sequenceIndex < progress;
              return (
                <span
                  key={i}
                  className={
                    isCurrent
                      ? "font-bold bg-burgundy/15 rounded-sm px-0.5"
                      : isPast
                        ? ""
                        : aw.isContent
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                  }
                  style={isCurrent ? { color: "#ef4444" } : isPast ? {} : undefined}
                  onClick={aw.isContent ? () => { setProgress(aw.sequenceIndex); progressRef.current = aw.sequenceIndex; } : undefined}
                  role={aw.isContent ? "button" : undefined}
                  tabIndex={aw.isContent ? 0 : undefined}
                >
                  {aw.original}{" "}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Three.js scene */}
      <div className="px-2 py-2">
        <TextWalkScene
          steps={result.steps}
          wordPoints={result.wordPoints}
          walking={walking}
          firstPerson={firstPerson}
          progress={progress}
          onProgressChange={setProgress}
          isDark={isDark}
          trailColor={trailColor}
        />
      </div>

      <div className="thin-rule mx-5" />

      {/* Current neighbourhood panel */}
      <div className="px-5 py-4">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          Nearest Words in Embedding Space
        </h4>
        <p className="font-sans text-caption text-muted-foreground mb-3">
          The 10 words from the text closest to &ldquo;{currentStep?.word}&rdquo; in the manifold&apos;s geometry.
          These are not textual neighbours but geometric ones: words the embedding model considers semantically proximate.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(currentStep?.nearby || []).map((n, i) => (
            <div key={i} className="bg-muted rounded-sm px-2.5 py-1.5">
              <div className="font-sans text-body-sm font-medium">{n.word}</div>
              <div className="font-sans text-[10px] text-muted-foreground tabular-nums">
                sim: {n.similarity.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Deep dive toggle */}
      <button
        onClick={() => setDeepDive(!deepDive)}
        className="w-full px-5 py-2 border-t border-parchment flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-cream/50 transition-colors font-sans text-caption"
      >
        {deepDive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="uppercase tracking-wider font-semibold">Deep Dive</span>
        <span className="ml-2 font-normal">{result.uniqueWords.length} vectors, {result.steps.length} steps</span>
      </button>

      {deepDive && (
        <div className="px-5 pb-5 border-t border-parchment space-y-5 pt-4">

          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">Unique Words</div>
              <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{result.uniqueWords.length}</div>
              <div className="font-sans text-caption text-muted-foreground mt-0.5">embedded as vectors</div>
            </div>
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">Reading Steps</div>
              <div className="font-sans text-body-lg font-bold tabular-nums mt-1">{result.steps.length}</div>
              <div className="font-sans text-caption text-muted-foreground mt-0.5">words in sequence</div>
            </div>
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">Avg Nearest Sim</div>
              <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                {(result.steps.reduce((sum, s) => sum + (s.nearby[0]?.similarity || 0), 0) / result.steps.length).toFixed(4)}
              </div>
              <div className="font-sans text-caption text-muted-foreground mt-0.5">mean top-1 similarity</div>
            </div>
            <div className="bg-muted rounded-sm p-3">
              <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">Repetition Rate</div>
              <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                {((1 - result.uniqueWords.length / result.steps.length) * 100).toFixed(0)}%
              </div>
              <div className="font-sans text-caption text-muted-foreground mt-0.5">words revisited</div>
            </div>
          </div>

          {/* BPE subword tokens */}
          {bpeTokens && (
            <div>
              <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                BPE Subword Tokens ({bpeTokens.length} tokens)
              </h4>
              <div className="flex flex-wrap gap-0.5 mb-2">
                {bpeTokens.map((token, i) => {
                  const display = token.replace(/\n/g, "\\n").replace(/ /g, "\u00B7");
                  return (
                    <span
                      key={i}
                      className="inline-block font-mono text-[10px] px-1 py-0.5 rounded-sm bg-muted/50 border border-parchment/40 text-muted-foreground"
                      title={`Token ${i}: "${token}"`}
                    >
                      {display || "\u00B7"}
                    </span>
                  );
                })}
              </div>
              <p className="font-sans text-[10px] text-muted-foreground/70 italic leading-snug">
                Approximate reconstruction using cl100k_base (OpenAI). The actual embedding model&apos;s
                internal tokeniser is proprietary and inaccessible through the API. Each provider
                uses its own subword vocabulary: what the model receives as input may differ
                from this preview. The embedding API is a black box that accepts text and returns
                a vector; the intermediate tokenisation step is hidden.
              </p>
            </div>
          )}

          {/* Word frequency table */}
          <div>
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Word Vectors (sorted by frequency)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-caption">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-semibold">Word</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Freq</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Nearest</th>
                    <th className="text-right py-1.5 px-3 text-muted-foreground font-semibold">Similarity</th>
                    <th className="text-right py-1.5 pl-3 text-muted-foreground font-semibold">2nd Nearest</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.wordPoints]
                    .sort((a, b) => b.frequency - a.frequency)
                    .map((wp, i) => {
                      // Find this word's neighbours from any step that uses it
                      const stepForWord = result.steps.find(s => s.word === wp.word);
                      const nearest = stepForWord?.nearby?.[0];
                      const second = stepForWord?.nearby?.[1];
                      return (
                        <tr key={i} className="border-b border-parchment/50 hover:bg-muted/30">
                          <td className="py-1.5 pr-3 font-medium">{wp.word}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">{wp.frequency}</td>
                          <td className="py-1.5 px-3 text-right">{nearest?.word || "—"}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">{nearest?.similarity?.toFixed(4) || "—"}</td>
                          <td className="py-1.5 pl-3 text-right">{second?.word || "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reading path */}
          <div>
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Reading Path
            </h4>
            <div className="flex flex-wrap items-center gap-0.5">
              {result.steps.map((step, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-muted-foreground text-[10px]">&rarr;</span>}
                  <span
                    className={`font-sans text-caption cursor-pointer hover:underline ${
                      i === progress
                        ? "font-bold text-burgundy"
                        : i < progress
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                    onClick={() => { setProgress(i); progressRef.current = i; }}
                  >
                    {step.word}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* How this works */}
          <div className="p-3 bg-muted rounded-sm">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              How This Works
            </h4>
            <p className="font-sans text-caption text-muted-foreground leading-relaxed">
              Each word in the text is embedded as a vector (typically 768 to 3,072
              dimensions). These vectors are projected to 3D using PCA and spread apart using
              a repulsion algorithm to reduce overlap. The particle then visits each word in
              reading order, tracing the path that the text takes through semantic space.
              When a word repeats, the particle returns to the same position, showing how
              the text loops back through the manifold. The connecting lines reveal which
              other words in the text are geometrically closest to the current word,
              regardless of their position in the sentence.
            </p>
          </div>

          {/* CSV export */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                const rows = ["word,frequency,nearest_word,nearest_similarity,second_nearest"];
                for (const wp of [...result.wordPoints].sort((a, b) => b.frequency - a.frequency)) {
                  const stepForWord = result.steps.find(s => s.word === wp.word);
                  const n1 = stepForWord?.nearby?.[0];
                  const n2 = stepForWord?.nearby?.[1];
                  rows.push(`"${wp.word}",${wp.frequency},"${n1?.word || ""}",${n1?.similarity?.toFixed(6) || ""},"${n2?.word || ""}"`);
                }
                // Add reading path
                rows.push("");
                rows.push("reading_position,word,nearest_word,nearest_similarity");
                result.steps.forEach((s, i) => {
                  rows.push(`${i + 1},"${s.word}","${s.nearby[0]?.word || ""}",${s.nearby[0]?.similarity?.toFixed(6) || ""}`);
                });
                const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `text-vectorisation-${result.modelId}.csv`;
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

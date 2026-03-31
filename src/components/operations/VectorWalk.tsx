/**
 * Manifold Atlas — Vector Walk
 * Concept and Design: David M. Berry, University of Sussex
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, Play, Pause, RotateCcw } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { projectPCA3D, spreadPoints3D } from "@/lib/geometry/pca";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

const WalkScene = dynamic(
  () => import("@/components/viz/WalkScene").then(mod => ({ default: mod.WalkScene })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm rounded-sm">Loading 3D scene...</div> }
);

const REFERENCE_CONCEPTS = [
  // Political/social
  "cooperation", "agreement", "conformity", "obedience", "resistance",
  "loyalty", "duty", "consent", "coercion", "unity",
  "authority", "obligation", "freedom", "justice", "democracy",
  "sovereignty", "violence", "peace", "power", "revolution",
  // Economic
  "labour", "capital", "profit", "exploitation", "value",
  "market", "commodity", "property", "debt", "growth",
  // Knowledge/culture
  "knowledge", "truth", "belief", "ideology", "critique",
  "art", "beauty", "creativity", "imagination", "narrative",
  // Technology
  "algorithm", "computation", "data", "automation", "network",
  "surveillance", "platform", "code", "interface", "optimisation",
  // Nature/body
  "nature", "ecology", "body", "touch", "warmth",
  "water", "forest", "soil", "energy", "climate",
  // Everyday life
  "home", "food", "work", "sleep", "play",
  "friendship", "love", "grief", "memory", "hope",
  // Science/abstraction
  "experiment", "measurement", "theory", "model", "causation",
  "mathematics", "physics", "biology", "consciousness", "reason",
];

const DEFAULT_A = "solidarity";
const DEFAULT_B = "compliance";
const INTERPOLATION_STEPS = 30;

const WALK_PRESETS = [
  { a: "solidarity", b: "compliance", label: "solidarity → compliance" },
  { a: "love", b: "algorithm", label: "love → algorithm" },
  { a: "nature", b: "computation", label: "nature → computation" },
  { a: "democracy", b: "surveillance", label: "democracy → surveillance" },
  { a: "craft", b: "automation", label: "craft → automation" },
  { a: "poetry", b: "data", label: "poetry → data" },
  { a: "freedom", b: "efficiency", label: "freedom → efficiency" },
  { a: "care", b: "profit", label: "care → profit" },
];

interface NearbyRef {
  concept: string;
  similarity: number;
  coordIdx: number;
}

interface WalkStep {
  position: number;
  nearestConcept: string;
  nearestSimilarity: number;
  coords: [number, number, number];
  nearby: NearbyRef[];
}

interface WalkResult {
  anchorA: string;
  anchorB: string;
  modelId: string;
  modelName: string;
  steps: WalkStep[];
  anchorCoords: { a: [number, number, number]; b: [number, number, number] };
  referencePoints: Array<{ concept: string; coords: [number, number, number] }>;
}

interface VectorWalkProps {
  onQueryTime: (time: number) => void;
}

export function VectorWalk({ onQueryTime }: VectorWalkProps) {
  const [anchorA, setAnchorA] = useState("");
  const [anchorB, setAnchorB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<WalkResult[]>([]);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const handleCompute = async () => {
    const effectiveA = anchorA.trim() || DEFAULT_A;
    const effectiveB = anchorB.trim() || DEFAULT_B;
    if (!anchorA.trim()) setAnchorA(DEFAULT_A);
    if (!anchorB.trim()) setAnchorB(DEFAULT_B);

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const allTexts = [effectiveA, effectiveB, ...REFERENCE_CONCEPTS];
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const newResults: WalkResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const vecA = vectors[0];
          const vecB = vectors[1];
          const refVectors = vectors.slice(2);

          const interpolated: number[][] = [];
          for (let i = 0; i <= INTERPOLATION_STEPS; i++) {
            const t = i / INTERPOLATION_STEPS;
            interpolated.push(vecA.map((a, d) => a * (1 - t) + vecB[d] * t));
          }

          const allVecs = [vecA, vecB, ...interpolated, ...refVectors];
          const rawCoords = projectPCA3D(allVecs);

          // Fixed indices: anchors (0,1) + walk path (2..2+INTERPOLATION_STEPS)
          const fixedIndices = new Set<number>();
          fixedIndices.add(0); // anchor A
          fixedIndices.add(1); // anchor B
          for (let j = 0; j <= INTERPOLATION_STEPS; j++) {
            fixedIndices.add(2 + j); // walk path steps
          }
          // Spread reference concepts apart (indices after the walk path)
          const allCoords = spreadPoints3D(rawCoords, fixedIndices, 0.08, 80);

          const anchorCoords = {
            a: allCoords[0] as [number, number, number],
            b: allCoords[1] as [number, number, number],
          };

          const steps: WalkStep[] = interpolated.map((interpVec, i) => {
            const sims = refVectors.map((rv, r) => ({
              concept: REFERENCE_CONCEPTS[r],
              similarity: cosineSimilarity(interpVec, rv),
              coordIdx: r,
            }));
            sims.sort((a, b) => b.similarity - a.similarity);

            return {
              position: i / INTERPOLATION_STEPS,
              nearestConcept: sims[0].concept,
              nearestSimilarity: sims[0].similarity,
              coords: allCoords[2 + i] as [number, number, number],
              nearby: sims.slice(0, 20),
            };
          });

          const referencePoints = REFERENCE_CONCEPTS.map((concept, i) => ({
            concept,
            coords: allCoords[2 + INTERPOLATION_STEPS + 1 + i] as [number, number, number],
          }));

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            anchorA: effectiveA,
            anchorB: effectiveB,
            modelId: m.id,
            modelName: spec?.name || m.id,
            steps,
            anchorCoords,
            referencePoints,
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
          <h2 className="font-display text-display-md font-bold">Vector Walk</h2>
          <ResetButton onReset={() => { setAnchorA(""); setAnchorB(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Watch a particle walk through the manifold from one concept to another.
          The path is a linear interpolation in the high-dimensional embedding space,
          projected to 3D. At each step, the 20 nearest concepts light up around it.
          Use Ride to follow the particle from its perspective.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="text" value={anchorA} onChange={e => setAnchorA(e.target.value)}
              placeholder={DEFAULT_A} className="input-editorial flex-1"
              onKeyDown={e => e.key === "Enter" && handleCompute()} />
            <span className="font-sans text-body-sm text-muted-foreground">&rarr;</span>
            <input type="text" value={anchorB} onChange={e => setAnchorB(e.target.value)}
              placeholder={DEFAULT_B} className="input-editorial flex-1"
              onKeyDown={e => e.key === "Enter" && handleCompute()} />
            <button onClick={handleCompute} disabled={loading}
              className="btn-editorial-primary disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Walk"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WALK_PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setAnchorA(p.a); setAnchorB(p.b); }}
                className="btn-editorial-ghost text-caption px-2 py-1">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {results.map(r => (
        <WalkPlayer key={r.modelId} result={r} isDark={isDark} />
      ))}
    </div>
  );
}

function WalkPlayer({ result, isDark }: { result: WalkResult; isDark: boolean }) {
  const [progress, setProgress] = useState(0);
  const [walking, setWalking] = useState(false);
  const [firstPerson, setFirstPerson] = useState(false);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  const startWalk = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);

    const step = () => {
      progressRef.current += 0.05;
      if (progressRef.current > INTERPOLATION_STEPS) {
        progressRef.current = 0;
      }
      setProgress(Math.floor(progressRef.current));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

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

  // Deduplicated concept sequence
  const sequence: string[] = [];
  let last = "";
  for (const step of result.steps) {
    if (step.nearestConcept !== last) {
      sequence.push(step.nearestConcept);
      last = step.nearestConcept;
    }
  }

  return (
    <div className="card-editorial overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <span className="font-sans text-body-sm font-semibold">{result.modelName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWalking(!walking)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-body-sm font-medium bg-burgundy text-primary-foreground hover:bg-burgundy-900 transition-colors"
          >
            {walking ? <Pause size={14} /> : <Play size={14} />}
            {walking ? "Pause" : "Walk"}
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
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Progress bar and current concept */}
      <div className="px-5 py-3 bg-muted/30">
        <div className="flex items-center justify-between mb-1">
          <span className="font-sans text-caption text-muted-foreground">
            Step {progress + 1} / {INTERPOLATION_STEPS + 1}
          </span>
          <span className="font-sans text-body-sm font-bold" style={{ color: "#ef4444" }}>
            Nearest: {currentStep?.nearestConcept}
          </span>
          <span className="font-sans text-caption tabular-nums text-muted-foreground">
            sim: {currentStep?.nearestSimilarity?.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-sans text-caption text-muted-foreground tabular-nums">
            {Math.round((1 - (currentStep?.position || 0)) * 100)}% {result.anchorA}
          </span>
          <span className="font-sans text-caption text-muted-foreground">
            Synthetic vector ({Math.round((1 - (currentStep?.position || 0)) * 100)}% {result.anchorA}, {Math.round((currentStep?.position || 0) * 100)}% {result.anchorB})
          </span>
          <span className="font-sans text-caption text-muted-foreground tabular-nums">
            {Math.round((currentStep?.position || 0) * 100)}% {result.anchorB}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={INTERPOLATION_STEPS}
          value={progress}
          onChange={e => { setProgress(Number(e.target.value)); progressRef.current = Number(e.target.value); }}
          className="w-full h-1.5 bg-parchment rounded-full appearance-none cursor-pointer accent-burgundy"
        />
      </div>

      <div className="thin-rule mx-5" />

      {/* Three.js scene */}
      <div className="px-2 py-2">
        <WalkScene
          steps={result.steps}
          anchorA={result.anchorA}
          anchorB={result.anchorB}
          anchorCoords={result.anchorCoords}
          referencePoints={result.referencePoints}
          walking={walking}
          firstPerson={firstPerson}
          progress={progress}
          onProgressChange={setProgress}
          isDark={isDark}
        />
      </div>

      <div className="thin-rule mx-5" />

      {/* Current neighbourhood panel */}
      <div className="px-5 py-4">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          Current Neighbourhood (Step {progress + 1})
        </h4>
        <p className="font-sans text-caption text-muted-foreground mb-3">
          The 20 concepts closest to the particle&apos;s current position in the manifold.
          As the particle moves, the neighbourhood changes, revealing the local topology.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(currentStep?.nearby || []).map((n, i) => (
            <div key={i} className="bg-muted rounded-sm px-2.5 py-1.5">
              <div className="font-sans text-body-sm font-medium">{n.concept}</div>
              <div className="font-sans text-[10px] text-muted-foreground tabular-nums">
                sim: {n.similarity.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Concept sequence */}
      <div className="px-5 py-5">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          Path Sequence
        </h4>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-sans text-body-sm font-bold text-gold">{result.anchorA}</span>
          {sequence.map((concept, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-muted-foreground">&rarr;</span>
              <span className="font-sans text-body-sm">{concept}</span>
            </span>
          ))}
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-sans text-body-sm font-bold" style={{ color: "#7aa0ff" }}>{result.anchorB}</span>
        </div>
        <p className="font-sans text-caption text-muted-foreground mt-2 italic">
          Drag to rotate. Scroll to zoom. Use the slider to scrub manually.
          Click Ride to follow the particle through the manifold.
        </p>

        <div className="mt-4 p-3 bg-muted rounded-sm">
          <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            How This Works
          </h4>
          <p className="font-sans text-caption text-muted-foreground leading-relaxed">
            The walk interpolates between the two endpoint vectors in the high-dimensional
            embedding space (typically 768 to 3,072 dimensions). At each of the 30 steps, the
            tool creates a synthetic vector that blends the two endpoints in increasing
            proportions (100% A at the start, 100% B at the end). This synthetic vector
            does not correspond to any real concept, but it occupies a position in the manifold.
            The 20 nearest real concepts from the reference vocabulary are identified at each
            step by cosine similarity, revealing what the manifold places at that position.
            As the particle moves, the neighbourhood shifts from concepts associated with
            the starting point to concepts associated with the endpoint. The 3D visualisation
            is a PCA projection of these high-dimensional positions.
          </p>
        </div>
      </div>
    </div>
  );
}

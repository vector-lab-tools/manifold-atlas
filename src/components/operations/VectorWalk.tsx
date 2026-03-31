"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, Play, Pause, RotateCcw } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { projectPCA3D } from "@/lib/geometry/pca";
import { ResetButton } from "@/components/shared/ResetButton";
import { Plot3DControls } from "@/components/viz/Plot3DControls";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import type { PlotlyPlotHandle } from "@/components/viz/PlotlyPlot";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm">Loading...</div> }
);

const REFERENCE_CONCEPTS = [
  "cooperation", "agreement", "conformity", "obedience", "submission",
  "resistance", "loyalty", "duty", "consent", "coercion",
  "unity", "harmony", "discipline", "deference", "acquiescence",
  "alliance", "fellowship", "community", "order", "control",
  "authority", "obligation", "commitment", "allegiance", "devotion",
  "freedom", "justice", "fairness", "equity", "mercy",
  "punishment", "law", "rights", "democracy", "sovereignty",
  "violence", "peace", "trust", "betrayal", "power",
  "knowledge", "truth", "belief", "ideology", "critique",
  "labour", "capital", "profit", "exploitation", "value",
];

const DEFAULT_A = "solidarity";
const DEFAULT_B = "compliance";
const INTERPOLATION_STEPS = 30;

interface NearbyRef {
  concept: string;
  similarity: number;
  coordIdx: number; // index into referencePoints
}

interface WalkStep {
  position: number; // 0 to 1
  nearestConcept: string;
  nearestSimilarity: number;
  coords: [number, number, number];
  nearby: NearbyRef[]; // top N nearest reference concepts at this step
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

          // Interpolate between A and B
          const interpolated: number[][] = [];
          for (let i = 0; i <= INTERPOLATION_STEPS; i++) {
            const t = i / INTERPOLATION_STEPS;
            interpolated.push(vecA.map((a, d) => a * (1 - t) + vecB[d] * t));
          }

          // Project everything to 3D: anchors + interpolated + reference
          const allVecs = [vecA, vecB, ...interpolated, ...refVectors];
          const allCoords = projectPCA3D(allVecs);

          const anchorCoords = {
            a: allCoords[0] as [number, number, number],
            b: allCoords[1] as [number, number, number],
          };

          const steps: WalkStep[] = interpolated.map((interpVec, i) => {
            // Compute similarity to all reference concepts
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
              nearby: sims.slice(0, 8),
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
          projected to 3D. At each step, the nearest real concept from the reference
          vocabulary is identified, revealing what the manifold places between the
          two endpoints.
        </p>
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
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {results.map(r => (
        <WalkVisualization key={r.modelId} result={r} isDark={isDark} />
      ))}
    </div>
  );
}

function WalkVisualization({ result, isDark }: { result: WalkResult; isDark: boolean }) {
  const plotRef = useRef<PlotlyPlotHandle>(null);
  const [walkProgress, setWalkProgress] = useState(0);
  const [walking, setWalking] = useState(false);
  const [firstPerson, setFirstPerson] = useState(false);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  // Update camera to follow particle in first-person mode
  useEffect(() => {
    if (!firstPerson || !plotRef.current) return;
    const handle = plotRef.current;
    const div = handle.getDiv();
    const Plotly = handle.getPlotly();
    if (!div || !Plotly) return;

    const step = result.steps[walkProgress];
    const nextStep = result.steps[Math.min(walkProgress + 1, result.steps.length - 1)];
    if (!step) return;

    // Camera sits slightly behind and above the particle, looking forward
    const dx = nextStep.coords[0] - step.coords[0];
    const dy = nextStep.coords[1] - step.coords[1];
    const dz = nextStep.coords[2] - step.coords[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;

    Plotly.relayout(div, {
      "scene.camera.eye": {
        x: step.coords[0] - (dx / len) * 0.15,
        y: step.coords[1] - (dy / len) * 0.15,
        z: step.coords[2] + 0.05,
      },
      "scene.camera.center": {
        x: step.coords[0] + (dx / len) * 0.1,
        y: step.coords[1] + (dy / len) * 0.1,
        z: step.coords[2],
      },
    });
  }, [walkProgress, firstPerson, result.steps]);

  const startWalk = useCallback(() => {
    progressRef.current = 0;
    setWalkProgress(0);

    const step = () => {
      progressRef.current += 0.12;
      if (progressRef.current > INTERPOLATION_STEPS) {
        progressRef.current = 0;
      }
      setWalkProgress(Math.floor(progressRef.current));
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

  const currentStep = result.steps[walkProgress] || result.steps[0];
  const nearby = currentStep?.nearby || [];
  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";
  const gridColor = isDark ? "rgba(60,60,100,0.3)" : "rgba(140,130,110,0.35)";

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const traces: any[] = [
    // Path line
    {
      x: result.steps.map(s => s.coords[0]),
      y: result.steps.map(s => s.coords[1]),
      z: result.steps.map(s => s.coords[2]),
      mode: "lines",
      type: "scatter3d",
      line: { color: isDark ? "rgba(200,200,220,0.4)" : "rgba(80,70,60,0.3)", width: 3 },
      hoverinfo: "skip",
      showlegend: false,
    },
    // Reference concepts (small, faded — except nearby ones which are highlighted)
    (() => {
      const nearbyIndices = new Set(nearby.map(n => n.coordIdx));
      // Faded references (not nearby)
      const fadedIndices = result.referencePoints.map((_, i) => i).filter(i => !nearbyIndices.has(i));
      return {
        x: fadedIndices.map(i => result.referencePoints[i].coords[0]),
        y: fadedIndices.map(i => result.referencePoints[i].coords[1]),
        z: fadedIndices.map(i => result.referencePoints[i].coords[2]),
        text: fadedIndices.map(i => result.referencePoints[i].concept),
        mode: "markers",
        type: "scatter3d",
        marker: { size: 3, color: isDark ? "rgba(150,150,170,0.2)" : "rgba(120,110,100,0.15)" },
        hoverinfo: "text",
        showlegend: false,
      };
    })(),
    // Nearby concepts (highlighted, labelled)
    {
      x: nearby.map(n => result.referencePoints[n.coordIdx].coords[0]),
      y: nearby.map(n => result.referencePoints[n.coordIdx].coords[1]),
      z: nearby.map(n => result.referencePoints[n.coordIdx].coords[2]),
      text: nearby.map(n => n.concept),
      mode: "markers+text",
      type: "scatter3d",
      textposition: "top center",
      textfont: { size: 11, color: isDark ? "rgba(200,200,220,0.8)" : "rgba(80,70,60,0.8)", family: "Inter, system-ui, sans-serif" },
      marker: {
        size: nearby.map((_, i) => 7 - i * 0.5), // largest = nearest
        color: isDark ? "rgba(210,160,60,0.7)" : "rgba(160,110,20,0.7)",
      },
      hoverinfo: "text",
      showlegend: false,
    },
    // Lines from particle to nearby concepts
    ...nearby.slice(0, 4).map(n => ({
      x: [currentStep.coords[0], result.referencePoints[n.coordIdx].coords[0]],
      y: [currentStep.coords[1], result.referencePoints[n.coordIdx].coords[1]],
      z: [currentStep.coords[2], result.referencePoints[n.coordIdx].coords[2]],
      mode: "lines",
      type: "scatter3d",
      line: { color: isDark ? "rgba(210,160,60,0.2)" : "rgba(160,110,20,0.15)", width: 1.5 },
      hoverinfo: "skip",
      showlegend: false,
    })),
    // Anchor A (gold diamond)
    {
      x: [result.anchorCoords.a[0]],
      y: [result.anchorCoords.a[1]],
      z: [result.anchorCoords.a[2]],
      text: [result.anchorA],
      mode: "markers+text",
      type: "scatter3d",
      textposition: "top center",
      textfont: { size: 14, color: "#d4a017", family: "Inter, system-ui, sans-serif" },
      marker: { size: 12, color: "#d4a017", symbol: "diamond" },
      hoverinfo: "text",
      showlegend: false,
    },
    // Anchor B (blue diamond)
    {
      x: [result.anchorCoords.b[0]],
      y: [result.anchorCoords.b[1]],
      z: [result.anchorCoords.b[2]],
      text: [result.anchorB],
      mode: "markers+text",
      type: "scatter3d",
      textposition: "top center",
      textfont: { size: 14, color: "rgba(120, 160, 255, 0.9)", family: "Inter, system-ui, sans-serif" },
      marker: { size: 12, color: "rgba(120, 160, 255, 0.9)", symbol: "diamond" },
      hoverinfo: "text",
      showlegend: false,
    },
    // Walking particle
    {
      x: [currentStep.coords[0]],
      y: [currentStep.coords[1]],
      z: [currentStep.coords[2]],
      text: [currentStep.nearestConcept],
      mode: "markers+text",
      type: "scatter3d",
      textposition: "bottom center",
      textfont: { size: 13, color: "#ef4444", family: "Inter, system-ui, sans-serif" },
      marker: { size: 10, color: "#ef4444", line: { color: "rgba(239,68,68,0.4)", width: 3 } },
      hoverinfo: "text",
      showlegend: false,
    },
    // Trail (path already walked, brighter)
    {
      x: result.steps.slice(0, walkProgress + 1).map(s => s.coords[0]),
      y: result.steps.slice(0, walkProgress + 1).map(s => s.coords[1]),
      z: result.steps.slice(0, walkProgress + 1).map(s => s.coords[2]),
      mode: "lines",
      type: "scatter3d",
      line: { color: "#ef4444", width: 4 },
      hoverinfo: "skip",
      showlegend: false,
    },
  ];

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
              firstPerson
                ? "bg-gold text-white"
                : "btn-editorial-ghost"
            }`}
            title={firstPerson ? "Switch to overhead view" : "Ride the vector (first-person camera)"}
          >
            {firstPerson ? "Riding" : "Ride"}
          </button>
          <button
            onClick={() => { setWalking(false); setWalkProgress(0); progressRef.current = 0; setFirstPerson(false); }}
            className="btn-editorial-ghost px-2 py-1.5"
            title="Reset walk"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Current position indicator */}
      <div className="px-5 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="font-sans text-caption text-muted-foreground">
            Step {walkProgress + 1} of {INTERPOLATION_STEPS + 1}
          </span>
          <span className="font-sans text-body-sm font-bold" style={{ color: "#ef4444" }}>
            Nearest: {currentStep.nearestConcept}
          </span>
          <span className="font-sans text-caption tabular-nums text-muted-foreground">
            sim: {currentStep.nearestSimilarity.toFixed(4)}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-error-500 rounded-full transition-all duration-100"
            style={{ width: `${(walkProgress / INTERPOLATION_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* 3D visualization */}
      <div className="px-2 py-2">
        <div className="relative rounded-sm overflow-hidden border border-parchment" style={{ background: bgColor }}>
          <Plot3DControls plotRef={plotRef} exportFilename={`vector-walk-${result.anchorA}-${result.anchorB}-${result.modelId}`} />
          <PlotlyPlot
            ref={plotRef}
            data={traces}
            layout={{
              height: 500,
              margin: { t: 0, r: 0, b: 0, l: 0 },
              paper_bgcolor: bgColor,
              scene: {
                bgcolor: bgColor,
                xaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
                yaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
                zaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
                camera: { eye: { x: 1.8, y: 1.8, z: 1.0 } },
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
            style={{ width: "100%", height: "500px" }}
          />
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
          <span className="font-sans text-body-sm font-bold" style={{ color: "rgba(120, 160, 255, 0.9)" }}>{result.anchorB}</span>
        </div>
        <p className="font-sans text-caption text-muted-foreground mt-2 italic">
          This is the manifold&apos;s path between the two concepts. The particle shows
          which real concepts it passes through at each interpolation step. Press Walk to
          animate, or use the progress bar above to scrub manually.
        </p>
      </div>
    </div>
  );
}

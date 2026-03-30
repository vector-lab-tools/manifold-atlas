"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm">Loading heatmap...</div> }
);

const DEFAULT_CONCEPTS = "justice, fairness, equity, law, punishment, mercy, freedom, authority, rights, obligation, democracy, solidarity, compliance, obedience, resistance";

interface MatrixResult {
  concepts: string[];
  modelId: string;
  modelName: string;
  matrix: number[][];
  // Most and least similar pairs (excluding self)
  mostSimilar: { a: string; b: string; sim: number };
  leastSimilar: { a: string; b: string; sim: number };
  avgSimilarity: number;
  // Pairs where models disagree most (only when multiple models)
  highVariancePairs?: Array<{ a: string; b: string; variance: number; sims: Record<string, number> }>;
}

interface DistanceMatrixProps {
  onQueryTime: (time: number) => void;
}

export function DistanceMatrix({ onQueryTime }: DistanceMatrixProps) {
  const [conceptsText, setConceptsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<MatrixResult[]>([]);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const handleCompute = async () => {
    const effectiveText = conceptsText.trim() || DEFAULT_CONCEPTS;
    if (!conceptsText.trim()) setConceptsText(DEFAULT_CONCEPTS);

    const concepts = effectiveText.split(",").map(s => s.trim()).filter(s => s);
    if (concepts.length < 2) {
      setError(new Error("Need at least 2 concepts for a distance matrix."));
      return;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const modelVectors = await embedAll(concepts);
      const enabledModels = getEnabledModels();

      // Compute per-model matrices
      const allMatrices: Map<string, number[][]> = new Map();

      const newResults: MatrixResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const n = concepts.length;
          const matrix: number[][] = [];

          for (let i = 0; i < n; i++) {
            matrix[i] = [];
            for (let j = 0; j < n; j++) {
              matrix[i][j] = i === j ? 1 : cosineSimilarity(vectors[i], vectors[j]);
            }
          }

          allMatrices.set(m.id, matrix);

          // Find most and least similar pairs
          let mostSim = { a: "", b: "", sim: -Infinity };
          let leastSim = { a: "", b: "", sim: Infinity };
          let totalSim = 0;
          let pairCount = 0;

          for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
              const sim = matrix[i][j];
              totalSim += sim;
              pairCount++;
              if (sim > mostSim.sim) mostSim = { a: concepts[i], b: concepts[j], sim };
              if (sim < leastSim.sim) leastSim = { a: concepts[i], b: concepts[j], sim };
            }
          }

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            concepts,
            modelId: m.id,
            modelName: spec?.name || m.id,
            matrix,
            mostSimilar: mostSim,
            leastSimilar: leastSim,
            avgSimilarity: pairCount > 0 ? totalSim / pairCount : 0,
          };
        });

      // If multiple models, compute high-variance pairs
      if (newResults.length > 1) {
        const n = concepts.length;
        const pairVariances: Array<{ a: string; b: string; variance: number; sims: Record<string, number> }> = [];

        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const sims: Record<string, number> = {};
            const values: number[] = [];
            for (const r of newResults) {
              sims[r.modelName] = r.matrix[i][j];
              values.push(r.matrix[i][j]);
            }
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
            pairVariances.push({ a: concepts[i], b: concepts[j], variance, sims });
          }
        }

        pairVariances.sort((a, b) => b.variance - a.variance);

        // Attach top 10 high-variance pairs to first result
        if (newResults.length > 0) {
          newResults[0].highVariancePairs = pairVariances.slice(0, 10);
        }
      }

      setResults(newResults);
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (r: MatrixResult) => {
    const rows = ["," + r.concepts.join(",")];
    for (let i = 0; i < r.concepts.length; i++) {
      rows.push(r.concepts[i] + "," + r.matrix[i].map(v => v.toFixed(6)).join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distance-matrix-${r.modelId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Distance Matrix</h2>
          <ResetButton onReset={() => { setConceptsText(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Enter a list of concepts and get a full pairwise cosine similarity matrix across all
          enabled models. The heatmap reveals which concepts the manifold treats as close and
          which it separates. When multiple models are enabled, the tool identifies pairs where
          models disagree most, politically contested geometry.
        </p>
        <div className="space-y-3">
          <textarea
            value={conceptsText}
            onChange={e => setConceptsText(e.target.value)}
            placeholder={DEFAULT_CONCEPTS}
            className="input-editorial min-h-[80px] resize-y text-body-sm"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <p className="font-sans text-caption text-muted-foreground">
              Comma-separated concepts. The matrix shows all pairwise similarities.
            </p>
            <button
              onClick={handleCompute}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Compute Matrix"}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {/* High variance pairs (cross-model disagreement) */}
      {results.length > 1 && results[0].highVariancePairs && results[0].highVariancePairs.length > 0 && (
        <div className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-display text-body-lg font-bold">Contested Geometry</h3>
            <p className="font-sans text-caption text-muted-foreground mt-1">
              Concept pairs where models disagree most. High variance means models position
              these concepts at different distances, the geometry is politically contested.
            </p>
          </div>
          <div className="thin-rule mx-5" />
          <div className="px-5 py-4 overflow-x-auto">
            <table className="w-full font-sans text-body-sm">
              <thead>
                <tr className="border-b border-parchment">
                  <th className="text-left px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pair</th>
                  <th className="text-right px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Variance</th>
                  {results.map(r => (
                    <th key={r.modelId} className="text-right px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{r.modelName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment">
                {results[0].highVariancePairs.map((pair, i) => (
                  <tr key={i} className="hover:bg-cream/30 transition-colors">
                    <td className="px-2 py-1.5 font-medium">{pair.a} &harr; {pair.b}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-warning-500 font-semibold">{pair.variance.toFixed(6)}</td>
                    {results.map(r => (
                      <td key={r.modelId} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {pair.sims[r.modelName]?.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-model heatmaps */}
      {results.map(r => (
        <div key={r.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <span className="font-sans text-body-sm font-semibold">{r.modelName}</span>
            <button onClick={() => exportCSV(r)} className="btn-editorial-ghost text-caption px-3 py-1.5">
              <Download size={14} className="mr-1" />
              Export CSV
            </button>
          </div>
          <div className="thin-rule mx-5" />

          {/* Heatmap */}
          <div className="px-2 py-2" style={{ background: bgColor }}>
            <PlotlyPlot
              data={[{
                z: r.matrix,
                x: r.concepts,
                y: r.concepts,
                type: "heatmap",
                colorscale: isDark
                  ? [[0, "#0a0a1a"], [0.3, "#1a3a1a"], [0.5, "#3a6a1a"], [0.7, "#8a6a1a"], [0.85, "#aa4a1a"], [1, "#cc2020"]]
                  : [[0, "#f5f2ec"], [0.3, "#d4e8d4"], [0.5, "#a8c8a8"], [0.7, "#d4a860"], [0.85, "#c06030"], [1, "#a02020"]],
                zmin: 0,
                zmax: 1,
                text: r.matrix.map(row => row.map(v => v.toFixed(3))),
                texttemplate: "%{text}",
                textfont: { size: r.concepts.length > 12 ? 8 : 10 },
                hoverinfo: "z",
                showscale: true,
                colorbar: {
                  title: { text: "Cosine Similarity", font: { size: 10 } },
                  tickfont: { size: 9 },
                  len: 0.8,
                },
              }]}
              layout={{
                height: Math.max(400, r.concepts.length * 30 + 120),
                margin: { t: 30, r: 80, b: Math.max(80, r.concepts.length * 6), l: Math.max(80, r.concepts.length * 6) },
                paper_bgcolor: bgColor,
                plot_bgcolor: bgColor,
                xaxis: { side: "bottom", tickangle: -45, tickfont: { size: r.concepts.length > 12 ? 9 : 11 } },
                yaxis: { autorange: "reversed", tickfont: { size: r.concepts.length > 12 ? 9 : 11 } },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: `${Math.max(400, r.concepts.length * 30 + 120)}px` }}
            />
          </div>

          <div className="thin-rule mx-5" />

          {/* Summary stats */}
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Most similar pair</div>
                <div className="font-sans text-body-sm font-bold mt-1">{r.mostSimilar.a} &harr; {r.mostSimilar.b}</div>
                <div className="font-sans text-caption text-muted-foreground tabular-nums">{r.mostSimilar.sim.toFixed(4)}</div>
              </div>
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Least similar pair</div>
                <div className="font-sans text-body-sm font-bold mt-1">{r.leastSimilar.a} &harr; {r.leastSimilar.b}</div>
                <div className="font-sans text-caption text-muted-foreground tabular-nums">{r.leastSimilar.sim.toFixed(4)}</div>
              </div>
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Average similarity</div>
                <div className="font-sans text-body-sm font-bold mt-1 tabular-nums">{r.avgSimilarity.toFixed(4)}</div>
                <div className="font-sans text-caption text-muted-foreground">{r.concepts.length} concepts, {r.concepts.length * (r.concepts.length - 1) / 2} pairs</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

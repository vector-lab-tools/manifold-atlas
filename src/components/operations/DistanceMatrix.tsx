"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import { BenchmarkLoader } from "@/components/shared/BenchmarkLoader";
import {
  computeDistanceMatrix,
  distanceMatrixTextList,
  type DistanceMatrixResult,
  type DistanceMatrixModelResult,
} from "@/lib/operations/distance-matrix";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm">Loading heatmap...</div> }
);

const DEFAULT_CONCEPTS = "justice, fairness, equity, law, punishment, mercy, freedom, authority, rights, obligation, democracy, solidarity, compliance, obedience, resistance";

interface DistanceMatrixProps {
  onQueryTime: (time: number) => void;
}

export function DistanceMatrix({ onQueryTime }: DistanceMatrixProps) {
  const [conceptsText, setConceptsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<DistanceMatrixResult | null>(null);
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
      const inputs = { concepts };
      const texts = distanceMatrixTextList(inputs);
      const modelVectors = await embedAll(texts);
      const enabledModels = getEnabledModels();
      const computed = computeDistanceMatrix(inputs, modelVectors, enabledModels);
      setResult(computed);
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (r: DistanceMatrixModelResult, concepts: string[]) => {
    const rows = ["," + concepts.join(",")];
    for (let i = 0; i < concepts.length; i++) {
      rows.push(concepts[i] + "," + r.matrix[i].map(v => v.toFixed(6)).join(","));
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
          <ResetButton onReset={() => { setConceptsText(""); setResult(null); setError(null); }} />
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
            <div className="flex items-center gap-2">
              <p className="font-sans text-caption text-muted-foreground flex-1">
                Comma-separated concepts. The matrix shows all pairwise similarities.
              </p>
              <BenchmarkLoader onLoad={concepts => setConceptsText(concepts.join(", "))} />
            </div>
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

      {/* Contested Geometry (cross-model disagreement) */}
      {result && result.models.length > 1 && result.contestedPairs.length > 0 && (
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
                  {result.models.map(r => (
                    <th key={r.modelId} className="text-right px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{r.modelName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment">
                {result.contestedPairs.slice(0, 10).map((pair, i) => (
                  <tr key={i} className="hover:bg-cream/30 transition-colors">
                    <td className="px-2 py-1.5 font-medium">{pair.a} &harr; {pair.b}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-warning-500 font-semibold">{pair.variance.toFixed(6)}</td>
                    {result.models.map(r => (
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

      {result && <DistanceMatrixDeepDive result={result} />}

      {/* Per-model heatmaps */}
      {result && result.models.map(r => (
        <div key={r.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <span className="font-sans text-body-sm font-semibold">{r.modelName}</span>
            <button onClick={() => exportCSV(r, result.concepts)} className="btn-editorial-ghost text-caption px-3 py-1.5">
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
                x: result.concepts,
                y: result.concepts,
                type: "heatmap",
                colorscale: isDark
                  ? [[0, "#0a0a1a"], [0.3, "#1a3a1a"], [0.5, "#3a6a1a"], [0.7, "#8a6a1a"], [0.85, "#aa4a1a"], [1, "#cc2020"]]
                  : [[0, "#f5f2ec"], [0.3, "#d4e8d4"], [0.5, "#a8c8a8"], [0.7, "#d4a860"], [0.85, "#c06030"], [1, "#a02020"]],
                zmin: 0,
                zmax: 1,
                text: r.matrix.map(row => row.map(v => v.toFixed(3))),
                texttemplate: "%{text}",
                textfont: { size: result.concepts.length > 12 ? 8 : 10 },
                hoverinfo: "z",
                showscale: true,
                colorbar: {
                  title: { text: "Cosine Similarity", font: { size: 10 } },
                  tickfont: { size: 9 },
                  len: 0.8,
                },
              }]}
              layout={{
                height: Math.max(400, result.concepts.length * 30 + 120),
                margin: { t: 30, r: 80, b: Math.max(80, result.concepts.length * 6), l: Math.max(80, result.concepts.length * 6) },
                paper_bgcolor: bgColor,
                plot_bgcolor: bgColor,
                xaxis: { side: "bottom", tickangle: -45, tickfont: { size: result.concepts.length > 12 ? 9 : 11 } },
                yaxis: { autorange: "reversed", tickfont: { size: result.concepts.length > 12 ? 9 : 11 } },
              }}
              config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
              style={{ width: "100%", height: `${Math.max(400, result.concepts.length * 30 + 120)}px` }}
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
                <div className="font-sans text-caption text-muted-foreground">{result.concepts.length} concepts, {result.concepts.length * (result.concepts.length - 1) / 2} pairs</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Cross-model Deep Dive for Distance Matrix. Reports agreement on the
 * most-similar / least-similar pair across enabled models, the spread
 * of average similarities, and a per-model summary table.
 */
function DistanceMatrixDeepDive({ result }: { result: DistanceMatrixResult }) {
  const models = result.models;
  const n = models.length;
  if (n === 0) return null;

  const avgs = models.map(m => m.avgSimilarity);
  const mean = avgs.reduce((s, x) => s + x, 0) / n;
  const minAvg = Math.min(...avgs);
  const maxAvg = Math.max(...avgs);
  const range = maxAvg - minAvg;

  const mostSims = models.map(m => `${m.mostSimilar.a}↔${m.mostSimilar.b}`);
  const distinctMost = new Set(mostSims);
  const allAgreeMost = distinctMost.size === 1;
  const leastSims = models.map(m => `${m.leastSimilar.a}↔${m.leastSimilar.b}`);
  const distinctLeast = new Set(leastSims);
  const allAgreeLeast = distinctLeast.size === 1;

  const reading = allAgreeMost && allAgreeLeast
    ? "Models agree on both extremes. The matrix's geometric story is structural — the manifold ranks these concepts the same way regardless of model."
    : allAgreeMost
    ? "Models agree on the most-similar pair but diverge on the least-similar. The shared neighbourhood is structural; the periphery is contingent."
    : allAgreeLeast
    ? "Models agree on the least-similar pair but disagree on the most-similar. The far edge of the manifold is structural; the near neighbourhood depends on training."
    : `Models disagree on both extremes (${distinctMost.size} distinct most-similar pairs, ${distinctLeast.size} distinct least-similar pairs). The matrix is contingent across the whole concept set — see the Contested Geometry table for which pairs drive the disagreement.`;

  return (
    <DeepDivePanel tagline="cross-model extremes · spread · per-model summary">
      <DeepDiveSection title="Cross-model summary" tip="Do enabled models agree on which pairs are closest and farthest? Convergence here means the matrix's geometry is structural; divergence means contingent.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} hint="enabled" />
          <DeepDiveStat label="Mean avg sim" value={mean.toFixed(4)} hint={`range ${range.toFixed(3)}`} tone={range < 0.05 ? "success" : range < 0.15 ? "warning" : "error"} />
          <DeepDiveStat label="Top-pair agreement" value={allAgreeMost ? "all agree" : `${distinctMost.size} answers`} hint={allAgreeMost ? mostSims[0] : "models disagree"} tone={allAgreeMost ? "success" : "error"} />
          <DeepDiveStat label="Bottom-pair agreement" value={allAgreeLeast ? "all agree" : `${distinctLeast.size} answers`} hint={allAgreeLeast ? leastSims[0] : "models disagree"} tone={allAgreeLeast ? "success" : "error"} />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{reading}</p>
      </DeepDiveSection>

      <DeepDiveSection title="Per-model summary">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead>
              <tr className="border-b border-parchment">
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Avg cosine</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Most similar</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cos</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Least similar</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {models.map((m: DistanceMatrixModelResult) => (
                <tr key={m.modelId}>
                  <td className="px-2 py-1 font-medium">{m.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.avgSimilarity.toFixed(4)}</td>
                  <td className="px-2 py-1">{m.mostSimilar.a} ↔ {m.mostSimilar.b}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.mostSimilar.sim.toFixed(4)}</td>
                  <td className="px-2 py-1">{m.leastSimilar.a} ↔ {m.leastSimilar.b}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.leastSimilar.sim.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}

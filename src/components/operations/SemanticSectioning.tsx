"use client";

import { useState } from "react";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";
import { Loader2, GitBranch, Download, ChevronRight, ChevronDown } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { similarityColor } from "@/lib/similarity-scale";
import { ResetButton } from "@/components/shared/ResetButton";
import {
  computeSemanticSectioning,
  semanticSectioningTextList,
  type SemanticSectioningModelResult,
} from "@/lib/operations/semantic-sectioning";

const DEFAULT_A = "solidarity";
const DEFAULT_B = "compliance";

interface SemanticSectioningProps {
  onQueryTime: (time: number) => void;
}

export function SemanticSectioning({ onQueryTime }: SemanticSectioningProps) {
  const [anchorA, setAnchorA] = useState("");
  const [anchorB, setAnchorB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<SemanticSectioningModelResult[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async (overrideA?: string, overrideB?: string) => {
    const effectiveA = overrideA || anchorA.trim() || DEFAULT_A;
    const effectiveB = overrideB || anchorB.trim() || DEFAULT_B;
    if (!anchorA.trim() && !overrideA) setAnchorA(DEFAULT_A);
    if (!anchorB.trim() && !overrideB) setAnchorB(DEFAULT_B);

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const inputs = { anchorA: effectiveA, anchorB: effectiveB };
      const allTexts = semanticSectioningTextList(inputs);
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const computed = computeSemanticSectioning(inputs, modelVectors, enabledModels);
      setResults(computed.models);
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
          <h2 className="font-display text-display-md font-bold">Semantic Sectioning</h2>
          <ResetButton onReset={() => { setAnchorA(""); setAnchorB(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Where does one concept shade into another? This tool interpolates between two anchor
          concepts in the embedding space and identifies what real concepts populate the boundary
          region. The path reveals the manifold&apos;s implicit theory of how domains connect.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={anchorA}
            onChange={e => setAnchorA(e.target.value)}
            placeholder={DEFAULT_A}
            className="input-editorial flex-1"
            onKeyDown={e => e.key === "Enter" && handleCompute()}
          />
          <GitBranch size={20} className="text-slate flex-shrink-0" />
          <input
            type="text"
            value={anchorB}
            onChange={e => setAnchorB(e.target.value)}
            placeholder={DEFAULT_B}
            className="input-editorial flex-1"
            onKeyDown={e => e.key === "Enter" && handleCompute()}
          />
          <button
            onClick={() => handleCompute()}
            disabled={loading}
            className="btn-editorial-primary flex-shrink-0 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Section"}
          </button>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={() => handleCompute()} />}

      {results.map(r => (
        <div key={r.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-sans text-body-sm font-semibold">{r.modelName}</span>
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Anchor distance */}
          <div className="px-5 py-4">
            <SimilarityBridge
              nameA={r.anchorA}
              nameB={r.anchorB}
              similarity={r.anchorSimilarity}
            />
          </div>

          <div className="thin-rule mx-5" />

          {/* Path visualization */}
          <div className="px-5 py-5">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              Interpolation Path
            </h4>
            <p className="font-sans text-caption text-muted-foreground mb-4">
              Moving through the embedding space from &ldquo;{r.anchorA}&rdquo; to &ldquo;{r.anchorB}&rdquo;.
              At each point, the nearest real concept from the reference vocabulary is shown.
              Watch where one domain shades into another.
            </p>

            {/* Path as a gradient bar with concept labels */}
            <div className="relative">
              {/* Gradient bar */}
              <div className="flex h-10 rounded-sm overflow-hidden border border-parchment">
                {r.path.map((point, i) => {
                  const color = similarityColor(point.nearestSimilarity);
                  return (
                    <div
                      key={i}
                      className="flex-1 relative group"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                        <div className="bg-card border border-parchment shadow-editorial-md rounded-sm px-2 py-1 whitespace-nowrap">
                          <div className="font-sans text-caption font-semibold">{point.nearestConcept}</div>
                          <div className="font-sans text-[9px] text-muted-foreground tabular-nums">
                            sim: {point.nearestSimilarity.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Anchor labels */}
              <div className="flex justify-between mt-1">
                <span className="font-sans text-caption font-semibold text-foreground">{r.anchorA}</span>
                <span className="font-sans text-caption font-semibold text-foreground">{r.anchorB}</span>
              </div>
            </div>

            {/* Concept sequence */}
            <div className="mt-4">
              <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Concept Sequence
              </h4>
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-sans text-body-sm font-bold text-burgundy">{r.anchorA}</span>
                {(() => {
                  // Deduplicate consecutive concepts
                  const sequence: string[] = [];
                  let lastConcept = "";
                  for (const point of r.path) {
                    if (point.nearestConcept !== lastConcept && point.nearestConcept !== r.anchorA && point.nearestConcept !== r.anchorB) {
                      sequence.push(point.nearestConcept);
                      lastConcept = point.nearestConcept;
                    }
                  }
                  return sequence.map((concept, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="font-sans text-body-sm">{concept}</span>
                    </span>
                  ));
                })()}
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-sans text-body-sm font-bold text-burgundy">{r.anchorB}</span>
              </div>
              <p className="font-sans text-caption text-muted-foreground mt-2 italic">
                This is the manifold&apos;s path between these concepts. The sequence reveals
                which intermediate meanings the geometry encodes, and where one domain
                transitions into another.
              </p>
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Technical Detail */}
          <div className="px-5 py-3">
            <button
              onClick={() => setDetailOpen(!detailOpen)}
              className="flex items-center gap-1.5 font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors"
            >
              {detailOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Technical Detail
            </button>
          </div>

          {detailOpen && (
            <div className="px-5 pb-5 space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-caption">
                  <thead>
                    <tr className="border-b border-parchment">
                      <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Step</th>
                      <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Position</th>
                      <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Nearest Concept</th>
                      <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Similarity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment">
                    {r.path.map((point, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 tabular-nums">{i}</td>
                        <td className="px-2 py-1 tabular-nums">{point.position.toFixed(2)}</td>
                        <td className="px-2 py-1 font-medium">{point.nearestConcept}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{point.nearestSimilarity.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const rows = ["step,position,nearest_concept,cosine_similarity"];
                    r.path.forEach((p, i) => rows.push(`${i},${p.position.toFixed(4)},"${p.nearestConcept}",${p.nearestSimilarity.toFixed(6)}`));
                    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `semantic-sectioning-${r.anchorA}-${r.anchorB}-${r.modelId}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-editorial-ghost text-caption px-3 py-1.5"
                >
                  <Download size={14} className="mr-1" />Export CSV
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <SemanticSectioningDeepDive results={results} />
    </div>
  );
}

/** Cross-model Deep Dive for Semantic Sectioning. Per-model anchor
 * cosine, mean nearest-neighbour similarity along the path,
 * agreement on intermediate concepts (Jaccard overlap). */
function SemanticSectioningDeepDive({ results }: { results: SemanticSectioningModelResult[] }) {
  if (results.length === 0) return null;
  const n = results.length;

  const perModel = results.map(r => {
    const sims = r.path.map(p => p.nearestSimilarity);
    const meanNearest = sims.reduce((s, x) => s + x, 0) / Math.max(1, sims.length);
    return {
      modelId: r.modelId,
      modelName: r.modelName,
      anchorSim: r.anchorSimilarity,
      meanNearest,
      conceptSet: new Set(r.path.map(p => p.nearestConcept)),
      conceptCount: new Set(r.path.map(p => p.nearestConcept)).size,
    };
  });

  // Pairwise Jaccard on intermediate concept sets.
  let jSum = 0;
  let jPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = perModel[i].conceptSet;
      const b = perModel[j].conceptSet;
      const inter = [...a].filter(x => b.has(x)).length;
      const uni = new Set([...a, ...b]).size;
      if (uni > 0) {
        jSum += inter / uni;
        jPairs += 1;
      }
    }
  }
  const meanJaccard = jPairs > 0 ? jSum / jPairs : 1;

  const reading = n === 1
    ? "Only one model enabled. Add more to test whether the interpolation path is structural or contingent."
    : meanJaccard >= 0.6
    ? "Models walk through similar intermediate concepts. The semantic path between the two anchors is structural across the embedding ecosystem."
    : meanJaccard >= 0.3
    ? "Models share some intermediate concepts but diverge in detail. The high-level trajectory is robust; the specific stops along the way are contingent."
    : "Models traverse different intermediate concepts. The path between these anchors is contingent on which model you ask — different geometries pass through different territory.";

  return (
    <DeepDivePanel tagline="path agreement · per-model anchor cosine">
      <DeepDiveSection title="Cross-model summary" tip="Do enabled models walk through the same intermediate concepts when interpolating between the two anchors? High Jaccard overlap = the semantic path is structural; low = contingent on training.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} />
          <DeepDiveStat label="Path Jaccard" value={meanJaccard.toFixed(2)} hint="mean across model pairs" tone={meanJaccard >= 0.6 ? "success" : meanJaccard >= 0.3 ? "warning" : "error"} />
          <DeepDiveStat label="Mean anchor cos" value={(perModel.reduce((s, p) => s + p.anchorSim, 0) / n).toFixed(4)} hint="across models" />
          <DeepDiveStat label="Mean step cos" value={(perModel.reduce((s, p) => s + p.meanNearest, 0) / n).toFixed(4)} hint="nearest concept similarity" />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{reading}</p>
      </DeepDiveSection>
      <DeepDiveSection title="Per-model summary">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead><tr className="border-b border-parchment">
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Anchor cosine</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Mean step</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Distinct concepts</th>
            </tr></thead>
            <tbody className="divide-y divide-parchment">
              {perModel.map(p => (
                <tr key={p.modelId}>
                  <td className="px-2 py-1 font-medium">{p.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.anchorSim.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.meanNearest.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.conceptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}

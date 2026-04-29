"use client";

import { useState } from "react";
import { ArrowRight, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { SimilarityMeter } from "@/components/viz/SimilarityMeter";
import { QueryHistory } from "@/components/shared/QueryHistory";
import { addHistoryEntry, type HistoryEntry } from "@/lib/history";
import { conceptSimilarityLevel } from "@/lib/similarity-scale";
import { ResetButton } from "@/components/shared/ResetButton";
import {
  computeConceptDistance,
  type ConceptDistanceResult,
} from "@/lib/operations/concept-distance";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";

const DEFAULT_A = "solidarity";
const DEFAULT_B = "compliance";

function interpretSimilarity(sim: number): { text: string; detail: string } {
  if (sim >= 0.95) return {
    text: "Near-identical",
    detail: "The manifold treats these concepts as virtually the same point. This is either a genuine semantic equivalence or a failure of geometric discrimination.",
  };
  if (sim >= 0.85) return {
    text: "Very high similarity",
    detail: "The manifold positions these concepts as close neighbours. They occupy overlapping regions of the geometry, suggesting the model treats them as closely related or interchangeable in many contexts.",
  };
  if (sim >= 0.7) return {
    text: "High similarity",
    detail: "The concepts share a significant portion of their geometric neighbourhood. The manifold encodes a strong associative relationship between them, though they remain distinguishable.",
  };
  if (sim >= 0.5) return {
    text: "Moderate similarity",
    detail: "The concepts are related but occupy distinct regions. The manifold recognises a connection but maintains geometric separation. This is typical of concepts within the same broad domain.",
  };
  if (sim >= 0.3) return {
    text: "Low similarity",
    detail: "The concepts are geometrically distant. The manifold positions them in different regions of the space, suggesting they belong to distinct semantic domains with limited overlap.",
  };
  return {
    text: "Very low similarity",
    detail: "The concepts are near-orthogonal in the manifold. The geometry encodes no meaningful relationship between them. They occupy effectively independent regions of the space.",
  };
}

interface ConceptDistanceProps {
  onQueryTime: (time: number) => void;
}

export function ConceptDistance({ onQueryTime }: ConceptDistanceProps) {
  const [termA, setTermA] = useState("");
  const [termB, setTermB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<ConceptDistanceResult | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async (overrideA?: string, overrideB?: string) => {
    const effectiveA = overrideA || termA.trim() || DEFAULT_A;
    const effectiveB = overrideB || termB.trim() || DEFAULT_B;
    if (!termA.trim() && !overrideA) setTermA(DEFAULT_A);
    if (!termB.trim() && !overrideB) setTermB(DEFAULT_B);
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const modelVectors = await embedAll([effectiveA, effectiveB]);
      const enabledModels = getEnabledModels();

      const computed = computeConceptDistance(
        { termA: effectiveA, termB: effectiveB },
        modelVectors,
        enabledModels
      );

      setResult(computed);
      setExpandedModel(computed.models[0]?.modelId || null);
      onQueryTime((performance.now() - start) / 1000);

      // Save to history
      addHistoryEntry({
        type: "distance",
        termA: effectiveA,
        termB: effectiveB,
        results: computed.models.map(m => ({
          modelName: m.modelName,
          similarity: m.cosineSimilarity,
        })),
      });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTermA("");
    setTermB("");
    setResult(null);
    setError(null);
    setExpandedModel(null);
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    if (entry.termA) setTermA(entry.termA);
    if (entry.termB) setTermB(entry.termB);
    handleCompute(entry.termA, entry.termB);
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Concept Distance</h2>
          <div className="flex items-center gap-1">
            <ResetButton onReset={handleReset} />
            <QueryHistory type="distance" onSelect={handleHistorySelect} />
          </div>
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Measure the geometric relationship between two concepts across embedding models.
          How does the manifold position them relative to each other? You can enter single
          words or full phrases. Since embedding models are trained on sentence-level pairs,
          phrases like &ldquo;the concept of justice&rdquo; may produce more precise results
          than bare terms like &ldquo;justice&rdquo;.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={termA}
            onChange={e => setTermA(e.target.value)}
            placeholder={DEFAULT_A}
            className="input-editorial flex-1"
            onKeyDown={e => e.key === "Enter" && handleCompute()}
          />
          <ArrowRight size={20} className="text-slate flex-shrink-0" />
          <input
            type="text"
            value={termB}
            onChange={e => setTermB(e.target.value)}
            placeholder={DEFAULT_B}
            className="input-editorial flex-1"
            onKeyDown={e => e.key === "Enter" && handleCompute()}
          />
          <button
            onClick={() => handleCompute()}
            disabled={loading}
            className="btn-editorial-primary flex-shrink-0 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Compute"}
          </button>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={() => handleCompute()} />}

      {result && (
        <div className="space-y-4">
          {result.models.map(m => {
            const interp = interpretSimilarity(m.cosineSimilarity);
            const isExpanded = expandedModel === m.modelId;

            return (
              <div key={m.modelId} className="card-editorial overflow-hidden">
                {/* Bridge display */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-sans text-body-sm font-medium">{m.modelName}</span>
                    <span className="font-sans text-caption text-muted-foreground">{m.providerId}</span>
                  </div>
                  <SimilarityBridge
                    nameA={result.termA}
                    nameB={result.termB}
                    similarity={m.cosineSimilarity}
                  />
                  <div className="mt-3">
                    <SimilarityMeter
                      similarity={m.cosineSimilarity}
                      level={conceptSimilarityLevel(m.cosineSimilarity)}
                    />
                  </div>
                </div>

                {/* Expand/collapse */}
                <button
                  onClick={() => setExpandedModel(isExpanded ? null : m.modelId)}
                  className="w-full px-4 py-2 border-t border-parchment flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-cream/50 transition-colors font-sans text-caption"
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="uppercase tracking-wider font-semibold">Geometric Detail</span>
                  <span className="ml-2 font-normal">{interp.text}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-parchment space-y-4">
                    {/* Interpretation */}
                    <p className="font-body text-body-sm text-slate italic pt-3">
                      {interp.detail}
                    </p>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          Cosine Similarity
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.cosineSimilarity.toFixed(4)}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          1.0 = identical, 0.0 = orthogonal
                        </div>
                      </div>

                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          Cosine Distance
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.cosineDistance.toFixed(4)}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          1 &minus; similarity
                        </div>
                      </div>

                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          Angular Distance
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.angularDistance.toFixed(1)}&deg;
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          of 180&deg; maximum separation
                        </div>
                      </div>

                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          Euclidean Distance
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.euclideanDistance.toFixed(4)}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          L2 norm of difference vector
                        </div>
                      </div>
                    </div>

                    {/* Vector properties */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          Dimensions
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.dimensions.toLocaleString()}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          axes in the embedding space
                        </div>
                      </div>

                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          &ldquo;{result.termA}&rdquo; magnitude
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.normA.toFixed(4)}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          L2 norm of embedding vector
                        </div>
                      </div>

                      <div className="bg-muted rounded-sm p-3">
                        <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                          &ldquo;{result.termB}&rdquo; magnitude
                        </div>
                        <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                          {m.normB.toFixed(4)}
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          L2 norm of embedding vector
                        </div>
                      </div>
                    </div>

                    {/* Top contributing dimensions */}
                    <div>
                      <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                        Top Contributing Dimensions
                      </h4>
                      <p className="font-sans text-caption text-muted-foreground mb-2 italic">
                        Dimensions with the largest contribution to the dot product between these
                        vectors. High positive values pull the concepts together; negative values
                        push them apart. These dimensions are uninterpretable individually, but
                        their distribution reveals whether similarity is concentrated or distributed.
                      </p>
                      <div className="space-y-1.5">
                        {m.topDimensions.map(d => {
                          const maxContrib = Math.abs(m.topDimensions[0].contribution);
                          const barWidth = maxContrib > 0 ? (Math.abs(d.contribution) / maxContrib) * 100 : 0;
                          const isPositive = d.contribution >= 0;

                          return (
                            <div key={d.dim} className="flex items-center gap-2 font-sans text-caption">
                              <span className="w-16 text-muted-foreground tabular-nums text-right">
                                dim {d.dim}
                              </span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isPositive ? "bg-success-500" : "bg-error-500"}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className={`w-20 tabular-nums text-right ${isPositive ? "text-success-600" : "text-error-600"}`}>
                                {d.contribution >= 0 ? "+" : ""}{d.contribution.toFixed(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Concentration metric */}
                    {(() => {
                      const totalAbsContrib = m.topDimensions.reduce((s, d) => s + Math.abs(d.contribution), 0);
                      const dotProduct = m.cosineSimilarity * m.normA * m.normB;
                      const topConcentration = Math.abs(dotProduct) > 0 ? (totalAbsContrib / Math.abs(dotProduct)) * 100 : 0;

                      return (
                        <div className="bg-muted rounded-sm p-3">
                          <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                            Top-5 Dimension Concentration
                          </div>
                          <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                            {Math.min(100, topConcentration).toFixed(1)}%
                          </div>
                          <div className="font-sans text-caption text-muted-foreground mt-0.5">
                            {topConcentration > 50
                              ? "Similarity is concentrated in a few dimensions. The geometric relationship is driven by a small number of learned features."
                              : "Similarity is distributed across many dimensions. The geometric relationship reflects broad, diffuse associative structure rather than specific features."}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          <ConceptDistanceDeepDive result={result} />
        </div>
      )}
    </div>
  );
}

/**
 * Cross-model Deep Dive for Concept Distance. Shows aggregate stats
 * across every enabled embedding model: mean cosine, standard
 * deviation, cross-model range, an interpretive paragraph on whether
 * the finding looks structural (models agree) or contingent (models
 * diverge), plus a side-by-side comparison table covering every
 * geometric measure for every model.
 */
function ConceptDistanceDeepDive({ result }: { result: ConceptDistanceResult }) {
  const models = result.models;
  const n = models.length;
  if (n === 0) return null;

  const cosines = models.map(m => m.cosineSimilarity);
  const mean = cosines.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? cosines.reduce((s, x) => s + (x - mean) ** 2, 0) / n : 0;
  const stdDev = Math.sqrt(variance);
  const minCos = Math.min(...cosines);
  const maxCos = Math.max(...cosines);
  const range = maxCos - minCos;

  // Reading: low range = structural; mid = mixed; high = contingent.
  const readingTone = range < 0.05 ? "success" : range < 0.15 ? "warning" : "error";
  const readingText =
    range < 0.05
      ? "Models converge on a similar similarity. The finding is structural — different training corpora and architectures all encode the same geometric relationship between these two concepts. Treat the result as evidence about the vectorial regime, not about a single model's quirks."
      : range < 0.15
      ? "Models partly agree but diverge in magnitude. The finding is robust in direction but contingent in degree. Useful for qualitative reading, but be careful about citing a specific cosine value as if it were the answer."
      : "Models disagree substantially. The finding is contingent on training decisions: this concept pair sits in a part of the manifold where different models encode different relationships. The disagreement is itself the finding — it tells you these concepts are politically or methodologically contested across the embedding ecosystem.";

  return (
    <DeepDivePanel tagline="cross-model summary · per-model comparison · agreement reading">
      <DeepDiveSection
        title="Cross-model summary"
        tip="Aggregate cosine similarity across every enabled embedding model. Low cross-model range = the finding is structural and reproducible; high range = the finding is contingent on which model you ask."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} hint="enabled" />
          <DeepDiveStat label="Mean cosine" value={mean.toFixed(4)} hint={`± ${stdDev.toFixed(4)} σ`} />
          <DeepDiveStat
            label="Range"
            value={range.toFixed(4)}
            hint={`min ${minCos.toFixed(3)} · max ${maxCos.toFixed(3)}`}
            tone={readingTone}
          />
          <DeepDiveStat
            label="Agreement"
            value={range < 0.05 ? "high" : range < 0.15 ? "mixed" : "low"}
            hint={range < 0.05 ? "structural" : range < 0.15 ? "robust direction" : "contingent"}
            tone={readingTone}
          />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{readingText}</p>
      </DeepDiveSection>

      <DeepDiveSection
        title="Per-model comparison"
        tip="Every geometric measure for every model side-by-side. Useful for sanity-checking and CSV export."
      >
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead>
              <tr className="border-b border-parchment">
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cosine</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Distance</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Angular (°)</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Euclidean</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">‖A‖</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">‖B‖</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Dims</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {models.map(m => (
                <tr key={m.modelId}>
                  <td className="px-2 py-1 font-medium">{m.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.cosineSimilarity.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.cosineDistance.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.angularDistance.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.euclideanDistance.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.normA.toFixed(3)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.normB.toFixed(3)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.dimensions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}


"use client";

import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

interface DomainSpec {
  name: string;
  terms: string[];
}

const PRESET_COMPARISONS: Record<string, [DomainSpec, DomainSpec]> = {
  "Finance vs Subsistence": [
    { name: "Financial derivatives", terms: ["credit default swap", "collateralised debt obligation", "futures contract", "option pricing", "hedge fund", "arbitrage", "volatility surface", "yield curve", "securitisation", "repo rate", "dark pool", "algorithmic trading", "margin call", "short selling", "liquidity premium", "swap spread", "basis trade", "convertible bond", "structured product", "risk parity"] },
    { name: "Subsistence farming", terms: ["seed saving", "crop rotation", "companion planting", "rain-fed agriculture", "hand weeding", "manure composting", "smallholding", "food sovereignty", "subsistence harvest", "drought resistance", "soil fertility", "intercropping", "granary storage", "threshing floor", "cattle grazing", "water harvesting", "terracing", "fallow field", "root cellar", "seasonal planting"] },
  ],
  "Silicon Valley vs Indigenous knowledge": [
    { name: "Silicon Valley", terms: ["product-market fit", "minimum viable product", "growth hacking", "series A funding", "unicorn startup", "disruptive innovation", "scalability", "pivot strategy", "burn rate", "exit strategy", "agile sprint", "user acquisition", "monetisation", "platform economy", "network effects", "freemium model", "conversion funnel", "churn rate", "venture capital", "accelerator program"] },
    { name: "Indigenous ecological knowledge", terms: ["songline", "dreaming track", "fire-stick farming", "seasonal round", "totemic species", "sacred site", "water dreaming", "country", "caring for country", "knowledge keeper", "ceremony", "story place", "bush tucker", "traditional burning", "kinship system", "elder knowledge", "land management", "traditional fishing", "plant medicine", "cultural landscape"] },
  ],
  "Corporate vs Care work": [
    { name: "Corporate management", terms: ["key performance indicator", "quarterly earnings", "stakeholder alignment", "synergy", "deliverables", "value proposition", "strategic initiative", "core competency", "talent pipeline", "change management", "operational excellence", "business intelligence", "competitive advantage", "return on investment", "market penetration", "scalable solution", "best practice", "benchmarking", "leveraging assets", "optimisation"] },
    { name: "Care work", terms: ["bedside manner", "holding space", "gentle touch", "patient dignity", "comfort care", "listening presence", "wound dressing", "feeding assistance", "grief support", "night vigil", "companionship", "reassurance", "body washing", "turning the patient", "pain management", "family support", "end of life care", "emotional labour", "burnout", "compassion fatigue"] },
  ],
};

interface DensityResult {
  domainA: { name: string; avgPairwiseSim: number; termCount: number };
  domainB: { name: string; avgPairwiseSim: number; termCount: number };
  densityRatio: number;
  modelId: string;
  modelName: string;
}

interface SilenceDetectorProps {
  onQueryTime: (time: number) => void;
}

export function SilenceDetector({ onQueryTime }: SilenceDetectorProps) {
  const [selectedComparison, setSelectedComparison] = useState("Finance vs Subsistence");
  const [useCustom, setUseCustom] = useState(false);
  const [customNameA, setCustomNameA] = useState("");
  const [customTermsA, setCustomTermsA] = useState("");
  const [customNameB, setCustomNameB] = useState("");
  const [customTermsB, setCustomTermsB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<DensityResult[]>([]);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async () => {
    let domainA: DomainSpec, domainB: DomainSpec;
    if (useCustom) {
      domainA = { name: customNameA.trim() || "Domain A", terms: customTermsA.split(",").map(s => s.trim()).filter(s => s) };
      domainB = { name: customNameB.trim() || "Domain B", terms: customTermsB.split(",").map(s => s.trim()).filter(s => s) };
      if (domainA.terms.length < 3 || domainB.terms.length < 3) {
        setError(new Error("Each domain needs at least 3 terms for meaningful density measurement."));
        return;
      }
    } else {
      [domainA, domainB] = PRESET_COMPARISONS[selectedComparison];
    }
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const allTexts = [...domainA.terms, ...domainB.terms];
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const newResults: DensityResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const aVecs = vectors.slice(0, domainA.terms.length);
          const bVecs = vectors.slice(domainA.terms.length);

          // Compute average pairwise similarity within each domain
          // Higher avg similarity = denser region = more resolution
          let sumA = 0, countA = 0;
          for (let i = 0; i < aVecs.length; i++) {
            for (let j = i + 1; j < aVecs.length; j++) {
              sumA += cosineSimilarity(aVecs[i], aVecs[j]);
              countA++;
            }
          }

          let sumB = 0, countB = 0;
          for (let i = 0; i < bVecs.length; i++) {
            for (let j = i + 1; j < bVecs.length; j++) {
              sumB += cosineSimilarity(bVecs[i], bVecs[j]);
              countB++;
            }
          }

          const avgA = countA > 0 ? sumA / countA : 0;
          const avgB = countB > 0 ? sumB / countB : 0;
          const ratio = avgB > 0 ? avgA / avgB : 0;

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            domainA: { name: domainA.name, avgPairwiseSim: avgA, termCount: domainA.terms.length },
            domainB: { name: domainB.name, avgPairwiseSim: avgB, termCount: domainB.terms.length },
            densityRatio: ratio,
            modelId: m.id,
            modelName: spec?.name || m.id,
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
          <h2 className="font-display text-display-md font-bold">Silence Detector</h2>
          <ResetButton onReset={() => { setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Compare how much geometric space the manifold allocates to different domains.
          When terms within a domain are spread apart (low pairwise similarity), the manifold
          distinguishes between them, allocating more representational space. When terms are packed
          tightly together (high pairwise similarity), the manifold compresses them, treating
          distinct concepts as near-interchangeable. The differential reveals which domains
          the geometry takes seriously and which it flattens.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="font-sans text-body-sm text-slate">Comparison:</label>
            <select
              value={useCustom ? "custom" : selectedComparison}
              onChange={e => {
                if (e.target.value === "custom") {
                  setUseCustom(true);
                } else {
                  setUseCustom(false);
                  setSelectedComparison(e.target.value);
                }
              }}
              className="input-editorial w-auto py-1.5 px-3 text-body-sm"
            >
              {Object.keys(PRESET_COMPARISONS).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="custom">Custom domains</option>
            </select>
          </div>

          {useCustom ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <input
                  type="text"
                  value={customNameA}
                  onChange={e => setCustomNameA(e.target.value)}
                  placeholder="Domain A name, e.g. Financial derivatives"
                  className="input-editorial text-body-sm py-1.5"
                />
                <textarea
                  value={customTermsA}
                  onChange={e => setCustomTermsA(e.target.value)}
                  placeholder="Domain A terms (comma separated, min 3)"
                  className="input-editorial text-body-sm py-1.5 min-h-[80px] resize-y"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={customNameB}
                  onChange={e => setCustomNameB(e.target.value)}
                  placeholder="Domain B name, e.g. Subsistence farming"
                  className="input-editorial text-body-sm py-1.5"
                />
                <textarea
                  value={customTermsB}
                  onChange={e => setCustomTermsB(e.target.value)}
                  placeholder="Domain B terms (comma separated, min 3)"
                  className="input-editorial text-body-sm py-1.5 min-h-[80px] resize-y"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRESET_COMPARISONS[selectedComparison].map((domain, i) => (
                <div key={i} className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    {domain.name} ({domain.terms.length} terms)
                  </div>
                  <p className="font-sans text-caption text-muted-foreground leading-relaxed">
                    {domain.terms.slice(0, 8).join(", ")}...
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleCompute}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Measuring density...</> : "Detect Silence"}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {results.map(r => (
        <div key={r.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <span className="font-sans text-body-sm font-semibold">{r.modelName}</span>
          </div>

          <div className="thin-rule mx-5" />

          {/* Density comparison */}
          <div className="px-5 py-5">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              Density Comparison
            </h4>
            <p className="font-sans text-caption text-muted-foreground mb-4">
              Higher pairwise similarity = terms packed together = less geometric space allocated = lower resolution.
              Lower pairwise similarity = terms spread apart = more geometric space allocated = higher resolution.
            </p>

            <SimilarityBridge
              nameA={r.domainA.name}
              nameB={r.domainB.name}
              similarity={r.densityRatio}
              subtitle={r.densityRatio > 1.05 ? `${r.domainA.name} is denser (less resolution)` : r.densityRatio < 0.95 ? `${r.domainB.name} is denser (less resolution)` : "Similar density"}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">{r.domainA.name}</div>
                <div className="font-sans text-body-lg font-bold tabular-nums mt-0.5">{r.domainA.avgPairwiseSim.toFixed(4)}</div>
                <div className="font-sans text-[9px] text-muted-foreground mt-0.5">avg pairwise similarity</div>
                {/* Visual bar */}
                <div className="h-2 bg-parchment rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-burgundy rounded-full" style={{ width: `${r.domainA.avgPairwiseSim * 100}%` }} />
                </div>
              </div>
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">{r.domainB.name}</div>
                <div className="font-sans text-body-lg font-bold tabular-nums mt-0.5">{r.domainB.avgPairwiseSim.toFixed(4)}</div>
                <div className="font-sans text-[9px] text-muted-foreground mt-0.5">avg pairwise similarity</div>
                <div className="h-2 bg-parchment rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-burgundy rounded-full" style={{ width: `${r.domainB.avgPairwiseSim * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Interpretation */}
          <div className="px-5 py-5">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Interpretation
            </h4>
            <p className="font-body text-body-sm text-slate leading-relaxed">
              {r.domainA.avgPairwiseSim > r.domainB.avgPairwiseSim
                ? `${r.domainA.name} terms are packed more tightly together (higher avg similarity of ${r.domainA.avgPairwiseSim.toFixed(4)} vs ${r.domainB.avgPairwiseSim.toFixed(4)}). This means the manifold has LESS resolution for ${r.domainA.name}: it treats these distinct concepts as more interchangeable. ${r.domainB.name} terms are more spread out, suggesting the manifold preserves finer distinctions between them. The geometry allocates more representational space to ${r.domainB.name} than to ${r.domainA.name}.`
                : `${r.domainB.name} terms are packed more tightly together (higher avg similarity of ${r.domainB.avgPairwiseSim.toFixed(4)} vs ${r.domainA.avgPairwiseSim.toFixed(4)}). This means the manifold has LESS resolution for ${r.domainB.name}: it treats these distinct concepts as more interchangeable. ${r.domainA.name} terms are more spread out, suggesting the manifold preserves finer distinctions between them. The geometry allocates more representational space to ${r.domainA.name} than to ${r.domainB.name}.`
              }
            </p>
            <p className="font-body text-body-sm text-slate mt-2 italic leading-relaxed">
              The tool does not tell you what is missing, because it cannot see what was never
              encoded. But it tells you where the manifold thins out, where the interpolation
              begins and the grounding ends.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

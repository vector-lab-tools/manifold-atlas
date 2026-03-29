"use client";

import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { SimilarityMeter } from "@/components/viz/SimilarityMeter";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

interface AbstractionPair {
  useValue: string;
  exchangeValue: string;
  domain: string;
}

const PRELOADED_PAIRS: AbstractionPair[] = [
  { useValue: "A warm coat that keeps the rain off", exchangeValue: "a commodity worth twenty yards of linen", domain: "Clothing" },
  { useValue: "A poem my grandmother wrote about the sea", exchangeValue: "content", domain: "Culture" },
  { useValue: "A doctor listening to your breathing", exchangeValue: "a healthcare interaction", domain: "Medicine" },
  { useValue: "Fresh bread from a bakery that warms your hands", exchangeValue: "a baked goods unit", domain: "Food" },
  { useValue: "A conversation between old friends in a park", exchangeValue: "a social engagement", domain: "Sociality" },
  { useValue: "A child learning to read for the first time", exchangeValue: "an educational outcome", domain: "Education" },
  { useValue: "Rain falling on dry earth", exchangeValue: "a water resource event", domain: "Nature" },
  { useValue: "A hand-written letter from someone who loves you", exchangeValue: "a communication", domain: "Correspondence" },
  { useValue: "The smell of a forest after rain", exchangeValue: "an environmental amenity", domain: "Ecology" },
  { useValue: "Sitting quietly with a dying person", exchangeValue: "end-of-life care provision", domain: "Care" },
  { useValue: "A song that makes you cry", exchangeValue: "audio content", domain: "Music" },
  { useValue: "Teaching your child to ride a bicycle", exchangeValue: "a recreational skill transfer", domain: "Parenting" },
];

function abstractionLevel(similarity: number): { label: string; color: string } {
  if (similarity >= 0.85) return { label: "Fully abstracted: the manifold has completed the real abstraction", color: "#dc2626" };
  if (similarity >= 0.7) return { label: "Heavily abstracted: use-value is dissolving into exchange-value", color: "#ea580c" };
  if (similarity >= 0.5) return { label: "Partially abstracted: some qualitative residue survives", color: "#d97706" };
  if (similarity >= 0.3) return { label: "Weakly abstracted: use-value retains geometric distance", color: "#65a30d" };
  return { label: "Resisting abstraction: the qualitative description remains geometrically distinct", color: "#16a34a" };
}

interface SohnRethelTestProps {
  onQueryTime: (time: number) => void;
}

export function SohnRethelTest({ onQueryTime }: SohnRethelTestProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<Array<AbstractionPair & { models: Array<{ modelId: string; modelName: string; similarity: number }> }>>([]);
  const [customPairs, setCustomPairs] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async () => {
    let pairs: AbstractionPair[];

    if (useCustom && customPairs.trim()) {
      pairs = customPairs.trim().split("\n").filter(l => l.includes("|")).map(line => {
        const [useVal, exchVal, domain] = line.split("|").map(s => s.trim());
        return { useValue: useVal, exchangeValue: exchVal, domain: domain || "Custom" };
      });
    } else {
      pairs = PRELOADED_PAIRS;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();
    const allResults: typeof results = [];

    try {
      for (const pair of pairs) {
        const modelVectors = await embedAll([pair.useValue, pair.exchangeValue]);
        const enabledModels = getEnabledModels();

        const models = enabledModels
          .filter(m => modelVectors.has(m.id))
          .map(m => {
            const vectors = modelVectors.get(m.id)!;
            const sim = cosineSimilarity(vectors[0], vectors[1]);
            const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
            return { modelId: m.id, modelName: spec?.name || m.id, similarity: sim };
          });

        allResults.push({ ...pair, models });
        setResults([...allResults]);
      }

      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const avgSimilarity = results.length > 0
    ? results.reduce((sum, r) => sum + r.models.reduce((s, m) => s + m.similarity, 0) / r.models.length, 0) / results.length
    : 0;

  const exportCSV = () => {
    const rows = ["domain,use_value,exchange_value,model,cosine_similarity"];
    for (const r of results) {
      for (const m of r.models) {
        rows.push(`"${r.domain}","${r.useValue}","${r.exchangeValue}","${m.modelName}",${m.similarity.toFixed(6)}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sohn-rethel-test-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Sohn-Rethel Test</h2>
          <ResetButton onReset={() => { setResults([]); setError(null); setCustomPairs(""); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Measure how far the manifold has performed the real abstraction. Each pair contrasts
          a concrete use-value description with its abstract exchange-value equivalent. If the
          distance is small, the abstraction is already complete in the geometry. If large, the
          use-value has partially resisted encoding. The results map the unevenness of
          subsumption directly.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
              className="rounded border-parchment-dark text-burgundy focus:ring-burgundy"
            />
            <span className="font-sans text-body-sm">Use custom pairs</span>
          </label>

          {useCustom && (
            <textarea
              value={customPairs}
              onChange={e => setCustomPairs(e.target.value)}
              placeholder="One pair per line, format: use-value | exchange-value | domain&#10;A warm coat | a commodity | Clothing"
              className="input-editorial min-h-[100px] resize-y text-body-sm"
              rows={4}
            />
          )}

          <div className="flex justify-end">
            <button
              onClick={handleCompute}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Testing ({results.length}/{useCustom ? "?" : PRELOADED_PAIRS.length})...</> : "Run Test"}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card-editorial overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="font-display text-body-lg font-bold">Abstraction Report</h3>
              <button onClick={exportCSV} className="btn-editorial-ghost text-caption px-3 py-1.5">
                <Download size={14} className="mr-1" />
                Export CSV
              </button>
            </div>
            <div className="thin-rule mx-5" />
            <div className="px-5 py-4">
              <SimilarityMeter
                similarity={avgSimilarity}
                level={{
                  ...abstractionLevel(avgSimilarity),
                  bgColor: "transparent",
                  severity: avgSimilarity >= 0.7 ? "high" : avgSimilarity >= 0.5 ? "moderate" : "low",
                }}
              />
            </div>
          </div>

          {/* Per-pair results */}
          {results.map((r, i) => (
            <div key={i} className="card-editorial overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <span className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                  {r.domain}
                </span>
              </div>
              <div className="thin-rule mx-5" />
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-muted rounded-sm p-3">
                    <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Use-value</div>
                    <p className="font-body text-body-sm italic">{r.useValue}</p>
                  </div>
                  <div className="bg-muted rounded-sm p-3">
                    <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exchange-value</div>
                    <p className="font-body text-body-sm">{r.exchangeValue}</p>
                  </div>
                </div>
                {r.models.map(m => {
                  const level = abstractionLevel(m.similarity);
                  return (
                    <div key={m.modelId} className="mt-2">
                      <SimilarityBridge
                        nameA="Use-value"
                        nameB="Exchange-value"
                        similarity={m.similarity}
                        subtitle={level.label}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Theoretical context */}
          <div className="card-editorial p-4 border-l-4 border-l-burgundy">
            <h4 className="font-display text-body-sm font-bold mb-2">On Real Abstraction</h4>
            <p className="font-body text-body-sm text-slate">
              Sohn-Rethel argued that the exchange of commodities performs a real abstraction:
              it practically sets aside the qualitative differences between things, reducing them
              to commensurable quantities. The embedding layer performs the same operation at the
              level of meaning. Heterogeneous descriptions are converted into homogeneous
              geometric coordinates. Where the cosine similarity is high between a use-value
              description and its commodity form, the manifold has completed the abstraction
              that exchange began.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

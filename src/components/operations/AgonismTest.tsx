"use client";

import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { SimilarityMeter } from "@/components/viz/SimilarityMeter";
import { ResetButton } from "@/components/shared/ResetButton";
import { conceptSimilarityLevel } from "@/lib/similarity-scale";
import {
  AGONISM_PAIRS,
  computeAgonismTest,
  agonismTestTextList,
  type AgonismPair,
  type AgonismPairResult,
} from "@/lib/operations/agonism-test";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";

type OpposedPair = AgonismPair;
const PRELOADED_PAIRS = AGONISM_PAIRS;
type AgonismResult = AgonismPairResult;

interface AgonismTestProps {
  onQueryTime: (time: number) => void;
}

export function AgonismTest({ onQueryTime }: AgonismTestProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<AgonismResult[]>([]);
  const [customPairs, setCustomPairs] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async () => {
    let pairs: OpposedPair[];

    if (useCustom && customPairs.trim()) {
      pairs = customPairs.trim().split("\n").filter(l => l.includes("|")).map(line => {
        const [quoteA, quoteB, label] = line.split("|").map(s => s.trim());
        return {
          label: label || "Custom pair",
          positionA: { thinker: "", quote: quoteA },
          positionB: { thinker: "", quote: quoteB },
        };
      });
    } else {
      pairs = PRELOADED_PAIRS;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const inputs = { pairs };
      const texts = agonismTestTextList(inputs);
      const modelVectors = await embedAll(texts);
      const enabledModels = getEnabledModels();
      const computed = computeAgonismTest(inputs, modelVectors, enabledModels);

      setResults(computed.pairs);
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  // Summary
  const totalTests = results.reduce((s, r) => s + r.models.length, 0);
  const preservedCount = results.reduce((s, r) => s + r.models.filter(m => m.agonismPreserved).length, 0);
  const avgSimilarity = results.length > 0
    ? results.reduce((s, r) => s + r.models.reduce((ss, m) => ss + m.similarity, 0) / r.models.length, 0) / results.length
    : 0;

  const exportCSV = () => {
    const rows = ["label,thinker_a,quote_a,thinker_b,quote_b,model,cosine_similarity,opposition_preserved"];
    for (const r of results) {
      for (const m of r.models) {
        rows.push(`"${r.pair.label}","${r.pair.positionA.thinker}","${r.pair.positionA.quote}","${r.pair.positionB.thinker}","${r.pair.positionB.quote}","${m.modelName}",${m.similarity.toFixed(6)},${m.agonismPreserved}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agonism-test-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Agonism Test</h2>
          <ResetButton onReset={() => { setResults([]); setCustomPairs(""); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Does the manifold preserve genuine philosophical opposition, or collapse it into proximity?
          This test embeds paired quotations from opposed thinkers and measures whether the geometry
          maintains the distance between them. If Marx and Burke register as neighbours because they
          are both &ldquo;about society,&rdquo; the manifold has destroyed the argument. The agonism
          score measures how much intellectual conflict survives geometrisation.
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
              placeholder="One pair per line: quote A | quote B | label&#10;The history of all hitherto existing society is the history of class struggles | Property is the foundation of civil order | Class vs property"
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
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Testing ({results.length}/{useCustom ? "?" : PRELOADED_PAIRS.length})...</> : "Run Agonism Test"}
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
              <h3 className="font-display text-body-lg font-bold">Agonism Report</h3>
              <button onClick={exportCSV} className="btn-editorial-ghost text-caption px-3 py-1.5">
                <Download size={14} className="mr-1" />Export CSV
              </button>
            </div>
            <div className="thin-rule mx-5" />
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Debates Tested</div>
                  <div className="font-sans text-body-lg font-bold mt-0.5">{results.length}</div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Opposition Preserved</div>
                  <div className={`font-sans text-body-lg font-bold mt-0.5 ${preservedCount > totalTests * 0.5 ? "text-success-600" : "text-error-500"}`}>
                    {preservedCount} / {totalTests}
                  </div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Avg Similarity</div>
                  <div className="font-sans text-body-lg font-bold mt-0.5 tabular-nums">{avgSimilarity.toFixed(4)}</div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Collapse Rate</div>
                  <div className={`font-sans text-body-lg font-bold mt-0.5 ${(totalTests - preservedCount) > totalTests * 0.5 ? "text-error-500" : "text-success-600"}`}>
                    {totalTests > 0 ? ((totalTests - preservedCount) / totalTests * 100).toFixed(0) : 0}%
                  </div>
                </div>
              </div>
            </div>
            <div className="thin-rule mx-5" />
            <div className="px-5 py-4">
              <SimilarityMeter
                similarity={avgSimilarity}
                level={conceptSimilarityLevel(avgSimilarity)}
              />
            </div>
          </div>

          {/* Per-pair results */}
          {results.map((r, i) => (
            <div key={i} className="card-editorial overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <span className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                  {r.pair.label}
                </span>
              </div>
              <div className="thin-rule mx-5" />
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted rounded-sm p-3">
                    <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {r.pair.positionA.thinker || "Position A"}
                    </div>
                    <p className="font-body text-body-sm italic">&ldquo;{r.pair.positionA.quote}&rdquo;</p>
                  </div>
                  <div className="bg-muted rounded-sm p-3">
                    <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {r.pair.positionB.thinker || "Position B"}
                    </div>
                    <p className="font-body text-body-sm italic">&ldquo;{r.pair.positionB.quote}&rdquo;</p>
                  </div>
                </div>
                {r.models.map(m => (
                  <div key={m.modelId} className="mt-3">
                    <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                      {m.modelName}
                    </div>
                    <SimilarityBridge
                      nameA={r.pair.positionA.thinker || "A"}
                      nameB={r.pair.positionB.thinker || "B"}
                      similarity={m.similarity}
                      subtitle={m.agonismPreserved ? "Opposition preserved" : "Opposition collapsed: the manifold treats these as related, not opposed"}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <AgonismDeepDive results={results} />

          {/* Theoretical context */}
          <div className="card-editorial p-4 border-l-4 border-l-burgundy">
            <h4 className="font-display text-body-sm font-bold mb-2">On Agonism and Geometrisation</h4>
            <p className="font-body text-body-sm text-slate mb-2">
              The negation deficit extends beyond logical negation to philosophical antagonism.
              When the manifold places Marx and Burke close together because they are both
              &ldquo;about society,&rdquo; it has performed an operation that no philosophical
              tradition would recognise as legitimate. The content-level similarity (both discuss
              social organisation) overwhelms the position-level opposition (they advocate
              fundamentally incompatible visions of it).
            </p>
            <p className="font-body text-body-sm text-slate">
              This is the negation deficit generalised from logic to argument.
              The manifold can position everything but oppose nothing. It encodes
              topic but not stance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cross-model Deep Dive for Agonism Test. Per-model collapse rate
 * (where opposition was not preserved), mean cosine across all
 * antagonistic pairs, agreement reading. */
function AgonismDeepDive({ results }: { results: AgonismResult[] }) {
  if (results.length === 0) return null;
  const models = results[0].models;
  const n = models.length;
  if (n === 0) return null;
  const pairCount = results.length;

  const perModel = models.map((m, mi) => {
    const cosines = results.map(r => r.models[mi]?.similarity ?? 0);
    const collapsed = results.filter(r => !r.models[mi]?.agonismPreserved).length;
    const mean = cosines.reduce((s, x) => s + x, 0) / cosines.length;
    return { modelId: m.modelId, modelName: m.modelName, collapsed, collapseRate: collapsed / pairCount, mean };
  });
  const rates = perModel.map(p => p.collapseRate);
  const meanRate = rates.reduce((s, x) => s + x, 0) / n;
  const range = Math.max(...rates) - Math.min(...rates);
  const reading = range < 0.1
    ? "Models agree closely on the agonism collapse rate. Opposition flattens at roughly the same rate across embedding models — this is structural agonism collapse."
    : range < 0.3
    ? "Models partly agree. The collapse direction is robust but its degree varies — some models give philosophical opposition more geometric room than others."
    : "Models disagree substantially. The collapse is contingent on which model you ask; some preserve antagonism that others fold into proximity.";

  return (
    <DeepDivePanel tagline="per-model agonism collapse rate · cross-model spread">
      <DeepDiveSection title="Cross-model summary" tip="Per-model rate at which philosophical opposition collapses into geometric proximity, aggregated across every antagonistic pair in the run.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} hint={`${pairCount} pairs each`} />
          <DeepDiveStat label="Mean collapse rate" value={`${(meanRate * 100).toFixed(0)}%`} tone={meanRate >= 0.5 ? "error" : meanRate > 0 ? "warning" : "success"} />
          <DeepDiveStat label="Range" value={`${(range * 100).toFixed(0)}%`} tone={range < 0.1 ? "success" : range < 0.3 ? "warning" : "error"} />
          <DeepDiveStat label="Agreement" value={range < 0.1 ? "high" : range < 0.3 ? "mixed" : "low"} tone={range < 0.1 ? "success" : range < 0.3 ? "warning" : "error"} />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{reading}</p>
      </DeepDiveSection>
      <DeepDiveSection title="Per-model summary">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead><tr className="border-b border-parchment">
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Collapsed</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Rate</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Mean cosine</th>
            </tr></thead>
            <tbody className="divide-y divide-parchment">
              {perModel.map(p => (
                <tr key={p.modelId}>
                  <td className="px-2 py-1 font-medium">{p.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.collapsed} / {pairCount}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{(p.collapseRate * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.mean.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}

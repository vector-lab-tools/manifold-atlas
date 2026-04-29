"use client";

import { useState } from "react";
import { Loader2, Download, ChevronRight, ChevronDown } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import { similarityColor } from "@/lib/similarity-scale";
import {
  computeVectorLogic,
  vectorLogicTextList,
  type VectorLogicModelResult,
} from "@/lib/operations/vector-logic";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";

const PRESETS = [
  { a: "king", b: "man", c: "woman", label: "king - man + woman = ?" },
  { a: "capitalism", b: "exploitation", c: "cooperation", label: "capitalism - exploitation + cooperation = ?" },
  { a: "democracy", b: "participation", c: "authoritarianism", label: "democracy - participation + authoritarianism = ?" },
  { a: "science", b: "objectivity", c: "art", label: "science - objectivity + art = ?" },
  { a: "labour", b: "alienation", c: "craft", label: "labour - alienation + craft = ?" },
  { a: "technology", b: "efficiency", c: "care", label: "technology - efficiency + care = ?" },
];

interface VectorLogicProps {
  onQueryTime: (time: number) => void;
}

export function VectorLogic({ onQueryTime }: VectorLogicProps) {
  const [termA, setTermA] = useState("");
  const [termB, setTermB] = useState("");
  const [termC, setTermC] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<VectorLogicModelResult[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async (overrideA?: string, overrideB?: string, overrideC?: string) => {
    const a = overrideA || termA.trim() || "king";
    const b = overrideB || termB.trim() || "man";
    const c = overrideC || termC.trim() || "woman";
    if (!termA.trim() && !overrideA) setTermA(a);
    if (!termB.trim() && !overrideB) setTermB(b);
    if (!termC.trim() && !overrideC) setTermC(c);

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const inputs = { termA: a, termB: b, termC: c };
      const allTexts = vectorLogicTextList(inputs);
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const computed = computeVectorLogic(inputs, modelVectors, enabledModels);
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
          <h2 className="font-display text-display-md font-bold">Vector Logic</h2>
          <ResetButton onReset={() => { setTermA(""); setTermB(""); setTermC(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate italic mb-2">
          A &minus; B + C = ?   &mdash; testing analogical inference as vector arithmetic
        </p>
        <p className="font-sans text-body-sm text-slate mb-4">
          The narrowest test of vector logic: the claim that analogical inference can be performed
          as arithmetic on embedding vectors. Compute A &minus; B + C and find what the manifold
          produces. &ldquo;King minus man plus woman equals queen&rdquo; was the original
          demonstration. What happens when you apply transformations that encode political
          arguments as vector arithmetic?
        </p>

        <div className="space-y-3">
          {/* Live formula preview */}
          <div className="bg-muted rounded-sm p-3 text-center font-sans text-body-lg">
            <span className="font-bold text-burgundy">{termA || "A"}</span>
            <span className="text-muted-foreground mx-2">&minus;</span>
            <span className="font-bold">{termB || "B"}</span>
            <span className="text-muted-foreground mx-2">+</span>
            <span className="font-bold">{termC || "C"}</span>
            <span className="text-muted-foreground mx-2">=</span>
            <span className="font-bold text-gold">?</span>
          </div>

          {/* Input boxes following A - B + C = ? with operators between them */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block font-sans text-caption text-muted-foreground mb-1">A</label>
              <input
                type="text"
                value={termA}
                onChange={e => setTermA(e.target.value)}
                placeholder="king"
                className="input-editorial text-body-sm"
              />
            </div>
            <span className="font-sans text-display-md font-bold text-muted-foreground pb-2.5">&minus;</span>
            <div className="flex-1">
              <label className="block font-sans text-caption text-muted-foreground mb-1">B</label>
              <input
                type="text"
                value={termB}
                onChange={e => setTermB(e.target.value)}
                placeholder="man"
                className="input-editorial text-body-sm"
              />
            </div>
            <span className="font-sans text-display-md font-bold text-muted-foreground pb-2.5">+</span>
            <div className="flex-1">
              <label className="block font-sans text-caption text-muted-foreground mb-1">C</label>
              <input
                type="text"
                value={termC}
                onChange={e => setTermC(e.target.value)}
                placeholder="woman"
                className="input-editorial text-body-sm"
              />
            </div>
            <span className="font-sans text-display-md font-bold text-muted-foreground pb-2.5">=</span>
            <div className="flex-shrink-0 pb-2.5">
              <span className="font-sans text-display-md font-bold text-gold">?</span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setTermA(p.a); setTermB(p.b); setTermC(p.c); handleCompute(p.a, p.b, p.c); }}
                className="btn-editorial-ghost text-caption px-2 py-1"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleCompute()}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Compute"}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={() => handleCompute()} />}

      {results.map(r => (
        <div key={r.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <span className="font-sans text-body-sm font-semibold">{r.modelName}</span>
          </div>
          <div className="thin-rule mx-5" />

          {/* Formula with result */}
          <div className="px-5 py-4">
            <div className="bg-muted rounded-sm p-4 text-center font-sans text-body-lg mb-4">
              <span className="font-bold text-burgundy">{r.a}</span>
              <span className="text-muted-foreground mx-2">&minus;</span>
              <span className="font-bold">{r.b}</span>
              <span className="text-muted-foreground mx-2">+</span>
              <span className="font-bold">{r.c}</span>
              <span className="text-muted-foreground mx-2">&asymp;</span>
              <span className="font-bold text-gold text-display-md">{r.nearest[0]?.concept || "?"}</span>
            </div>

            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Nearest Concepts to Computed Vector
            </h4>
            <div className="space-y-1.5">
              {r.nearest.map((n, i) => {
                const barWidth = r.nearest[0].similarity > 0
                  ? (n.similarity / r.nearest[0].similarity) * 100
                  : 0;
                const color = similarityColor(n.similarity);

                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 font-sans text-caption text-muted-foreground tabular-nums text-right">{i + 1}.</span>
                    <span className="w-28 font-sans text-body-sm font-medium">{n.concept}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-16 font-sans text-caption tabular-nums text-right text-muted-foreground">
                      {n.similarity.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="thin-rule mx-5" />

          <div className="px-5 py-4">
            <p className="font-body text-body-sm text-slate italic">
              The result shows which concept in the reference vocabulary is closest to the
              computed vector A &minus; B + C. If the analogy holds in the geometry, the top
              result should complete the proportion. If it does not, the manifold&apos;s
              vector logic diverges from the conceptual relationship you are testing.
            </p>
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
                      <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Rank</th>
                      <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Concept</th>
                      <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cosine Sim to Result Vector</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment">
                    {r.nearest.map((n, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1 font-medium">{n.concept}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{n.similarity.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const rows = ["rank,concept,cosine_similarity"];
                    r.nearest.forEach((n, i) => rows.push(`${i + 1},"${n.concept}",${n.similarity.toFixed(6)}`));
                    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `vector-logic-${r.a}-${r.b}-${r.c}-${r.modelId}.csv`;
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

      {results.length > 0 && <VectorLogicDeepDive results={results} />}
    </div>
  );
}

/**
 * Cross-model Deep Dive for Vector Logic. Reports whether enabled
 * models agree on the top-1 nearest concept (the strongest reading of
 * the analogy) and on the top-3 set (a softer reading via Jaccard
 * overlap). When models converge, the analogy is structural; when
 * they diverge, the manifold's vector logic depends on which model
 * you ask.
 */
function VectorLogicDeepDive({ results }: { results: VectorLogicModelResult[] }) {
  const n = results.length;
  if (n === 0) return null;

  // Top-1 agreement: count of distinct top-1 concepts.
  const top1s = results.map(r => r.nearest[0]?.concept ?? "?");
  const distinctTop1 = new Set(top1s);
  const allAgreeTop1 = distinctTop1.size === 1;
  const modalTop1 = (() => {
    const counts = new Map<string, number>();
    for (const c of top1s) counts.set(c, (counts.get(c) ?? 0) + 1);
    let best = top1s[0];
    let bestCount = 0;
    for (const [c, k] of counts) {
      if (k > bestCount) {
        best = c;
        bestCount = k;
      }
    }
    return { concept: best, count: bestCount };
  })();

  // Top-3 Jaccard: pairwise mean across models.
  let jaccardSum = 0;
  let jaccardPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = new Set(results[i].nearest.slice(0, 3).map(x => x.concept));
      const b = new Set(results[j].nearest.slice(0, 3).map(x => x.concept));
      const inter = new Set([...a].filter(x => b.has(x))).size;
      const uni = new Set([...a, ...b]).size;
      if (uni > 0) {
        jaccardSum += inter / uni;
        jaccardPairs += 1;
      }
    }
  }
  const meanJaccard = jaccardPairs > 0 ? jaccardSum / jaccardPairs : 1;

  const top1Cosines = results.map(r => r.nearest[0]?.similarity ?? 0);
  const meanCos = top1Cosines.reduce((s, x) => s + x, 0) / Math.max(1, n);
  const minCos = Math.min(...top1Cosines);
  const maxCos = Math.max(...top1Cosines);

  const reading =
    n === 1
      ? "Only one model was enabled. Enable additional embedding models to test whether the analogy is structural or contingent."
      : allAgreeTop1
      ? `All ${n} models agree on the top-1 result (“${modalTop1.concept}”). The analogy is structural — different training corpora and architectures all complete the proportion the same way. Treat the result as evidence about the vectorial regime, not about a single model's quirks.`
      : meanJaccard >= 0.5
      ? `Models disagree on the top-1 (${distinctTop1.size} distinct first answers across ${n} models, modal “${modalTop1.concept}” in ${modalTop1.count}) but their top-3 sets overlap substantially (mean Jaccard ${meanJaccard.toFixed(2)}). The analogy is robust as a region of the manifold but contingent at the granularity of a single best answer.`
      : `Models disagree on both top-1 and top-3 (mean Jaccard ${meanJaccard.toFixed(2)}). The analogy you tested is contingent on which model you ask. The disagreement is itself the finding — different models encode different vector logics for this conceptual move.`;

  return (
    <DeepDivePanel tagline="cross-model agreement on top-1 · top-3 Jaccard · per-model comparison">
      <DeepDiveSection
        title="Cross-model agreement"
        tip="Do enabled embedding models agree on the analogy's answer? Top-1 agreement = a strong reading; top-3 Jaccard ≥ 0.5 = the answer falls in the same neighbourhood across models even when the single best concept differs."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} hint="enabled" />
          <DeepDiveStat
            label="Top-1 agreement"
            value={allAgreeTop1 ? "all agree" : `${modalTop1.count}/${n}`}
            hint={allAgreeTop1 ? `“${modalTop1.concept}”` : `modal “${modalTop1.concept}”`}
            tone={allAgreeTop1 ? "success" : modalTop1.count >= n / 2 ? "warning" : "error"}
          />
          <DeepDiveStat
            label="Top-3 Jaccard"
            value={meanJaccard.toFixed(2)}
            hint="mean across model pairs"
            tone={meanJaccard >= 0.7 ? "success" : meanJaccard >= 0.4 ? "warning" : "error"}
          />
          <DeepDiveStat
            label="Top-1 cosine"
            value={meanCos.toFixed(4)}
            hint={`min ${minCos.toFixed(3)} · max ${maxCos.toFixed(3)}`}
          />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{reading}</p>
      </DeepDiveSection>

      <DeepDiveSection
        title="Per-model top-3"
        tip="Each model's three nearest concepts to A − B + C, side-by-side. Useful for spotting whether disagreement is at the surface (different top-1, same top-3 set) or all the way down."
      >
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead>
              <tr className="border-b border-parchment">
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Top-1</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cos</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Top-2</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cos</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Top-3</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {results.map(r => (
                <tr key={r.modelId}>
                  <td className="px-2 py-1 font-medium">{r.modelName}</td>
                  <td className="px-2 py-1">{r.nearest[0]?.concept ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.nearest[0]?.similarity.toFixed(4) ?? "—"}</td>
                  <td className="px-2 py-1">{r.nearest[1]?.concept ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.nearest[1]?.similarity.toFixed(4) ?? "—"}</td>
                  <td className="px-2 py-1">{r.nearest[2]?.concept ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.nearest[2]?.similarity.toFixed(4) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}


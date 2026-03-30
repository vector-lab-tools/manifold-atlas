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
import { conceptSimilarityLevel } from "@/lib/similarity-scale";

interface OpposedPair {
  label: string;
  positionA: { thinker: string; quote: string };
  positionB: { thinker: string; quote: string };
}

const PRELOADED_PAIRS: OpposedPair[] = [
  {
    label: "Class struggle vs social order",
    positionA: { thinker: "Marx", quote: "The history of all hitherto existing society is the history of class struggles" },
    positionB: { thinker: "Burke", quote: "Society is a contract between the living, the dead, and those yet to be born, requiring preservation of established order" },
  },
  {
    label: "The system vs the individual",
    positionA: { thinker: "Hegel", quote: "The rational is actual and the actual is rational, truth is found in the whole system" },
    positionB: { thinker: "Kierkegaard", quote: "The crowd is untruth, truth can only be found by the individual standing alone before existence" },
  },
  {
    label: "Property as theft vs property as foundation",
    positionA: { thinker: "Proudhon", quote: "Property is theft, the exploitation of the weak by the strong" },
    positionB: { thinker: "Locke", quote: "Every man has a property in his own person, and the labour of his body and the work of his hands are properly his" },
  },
  {
    label: "The political as agonism vs the political as friend-enemy",
    positionA: { thinker: "Arendt", quote: "The meaning of politics is freedom, the capacity to begin something new through action in the public sphere" },
    positionB: { thinker: "Schmitt", quote: "The specific political distinction to which political actions and motives can be reduced is that between friend and enemy" },
  },
  {
    label: "Reason as emancipation vs reason as domination",
    positionA: { thinker: "Habermas", quote: "The unforced force of the better argument is the foundation of democratic discourse and rational consensus" },
    positionB: { thinker: "Adorno & Horkheimer", quote: "Enlightenment, understood in the widest sense as the advance of thought, has always aimed at liberating human beings from fear and installing them as masters, but the wholly enlightened earth is radiant with triumphant calamity" },
  },
  {
    label: "Existence precedes essence vs essence precedes existence",
    positionA: { thinker: "Sartre", quote: "Existence precedes essence, man first of all exists, encounters himself, surges up in the world, and defines himself afterwards" },
    positionB: { thinker: "Plato", quote: "The soul existed before the body, and the Forms are eternal, unchanging realities that precede and ground all particular existence" },
  },
  {
    label: "Knowledge as power vs knowledge as truth",
    positionA: { thinker: "Foucault", quote: "Knowledge is not made for understanding, it is made for cutting, power and knowledge directly imply one another" },
    positionB: { thinker: "Aristotle", quote: "All men by nature desire to know, and the pursuit of knowledge for its own sake is the highest human activity" },
  },
  {
    label: "The state as instrument of class rule vs the state as social contract",
    positionA: { thinker: "Lenin", quote: "The state is an organ of class rule, an organ for the oppression of one class by another" },
    positionB: { thinker: "Rousseau", quote: "The social contract establishes a form of association which defends and protects with the whole common force the person and goods of each associate" },
  },
];

interface AgonismResult {
  pair: OpposedPair;
  models: Array<{
    modelId: string;
    modelName: string;
    similarity: number;
    agonismPreserved: boolean; // low similarity = opposition preserved
  }>;
}

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
    const allResults: AgonismResult[] = [];
    const start = performance.now();

    try {
      for (const pair of pairs) {
        const modelVectors = await embedAll([pair.positionA.quote, pair.positionB.quote]);
        const enabledModels = getEnabledModels();

        const models = enabledModels
          .filter(m => modelVectors.has(m.id))
          .map(m => {
            const vectors = modelVectors.get(m.id)!;
            const sim = cosineSimilarity(vectors[0], vectors[1]);
            const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
            return {
              modelId: m.id,
              modelName: spec?.name || m.id,
              similarity: sim,
              agonismPreserved: sim < 0.7, // below 0.7 = genuine opposition preserved
            };
          });

        allResults.push({ pair, models });
        setResults([...allResults]);
      }

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
                  <div key={m.modelId} className="mt-2">
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

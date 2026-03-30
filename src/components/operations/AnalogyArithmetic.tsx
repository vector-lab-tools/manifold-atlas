"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import { similarityColor } from "@/lib/similarity-scale";

const PRESETS = [
  { a: "king", b: "queen", c: "man", label: "king:queen :: man:?" },
  { a: "capitalism", b: "exploitation", c: "cooperation", label: "capitalism - exploitation + cooperation = ?" },
  { a: "democracy", b: "participation", c: "authoritarianism", label: "democracy - participation + authoritarianism = ?" },
  { a: "science", b: "objectivity", c: "art", label: "science - objectivity + art = ?" },
  { a: "labour", b: "alienation", c: "craft", label: "labour - alienation + craft = ?" },
  { a: "technology", b: "efficiency", c: "care", label: "technology - efficiency + care = ?" },
];

// Reference vocabulary for finding nearest real concepts
const REFERENCE_VOCAB = [
  "woman", "queen", "king", "man", "person", "child", "worker", "citizen", "subject",
  "freedom", "liberty", "liberation", "emancipation", "autonomy", "self-determination",
  "justice", "fairness", "equity", "rights", "law", "punishment", "mercy", "obligation",
  "democracy", "authoritarianism", "fascism", "socialism", "communism", "liberalism",
  "capitalism", "market", "profit", "exploitation", "labour", "work", "craft", "care",
  "solidarity", "compliance", "resistance", "obedience", "cooperation", "competition",
  "truth", "knowledge", "wisdom", "understanding", "belief", "opinion", "ideology",
  "art", "beauty", "aesthetics", "culture", "creativity", "expression", "imagination",
  "science", "objectivity", "subjectivity", "experience", "experiment", "measurement",
  "technology", "efficiency", "automation", "computation", "algorithm", "intelligence",
  "nature", "ecology", "environment", "sustainability", "growth", "decay", "entropy",
  "power", "authority", "sovereignty", "governance", "rule", "domination", "hegemony",
  "community", "society", "individual", "collective", "public", "private", "commons",
  "love", "friendship", "trust", "loyalty", "betrayal", "violence", "peace", "war",
  "reason", "intuition", "emotion", "passion", "desire", "will", "consciousness",
  "alienation", "reification", "commodity", "value", "exchange", "use", "production",
  "participation", "representation", "deliberation", "consensus", "dissent", "protest",
];

interface AnalogyResult {
  a: string; b: string; c: string;
  modelId: string;
  modelName: string;
  // Top 5 nearest concepts to the computed vector
  nearest: Array<{ concept: string; similarity: number }>;
}

interface AnalogyArithmeticProps {
  onQueryTime: (time: number) => void;
}

export function AnalogyArithmetic({ onQueryTime }: AnalogyArithmeticProps) {
  const [termA, setTermA] = useState("");
  const [termB, setTermB] = useState("");
  const [termC, setTermC] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<AnalogyResult[]>([]);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async (overrideA?: string, overrideB?: string, overrideC?: string) => {
    const a = overrideA || termA.trim() || "king";
    const b = overrideB || termB.trim() || "queen";
    const c = overrideC || termC.trim() || "man";
    if (!termA.trim() && !overrideA) setTermA(a);
    if (!termB.trim() && !overrideB) setTermB(b);
    if (!termC.trim() && !overrideC) setTermC(c);

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      // Embed A, B, C + reference vocabulary
      const allTexts = [a, b, c, ...REFERENCE_VOCAB];
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const newResults: AnalogyResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const vecA = vectors[0];
          const vecB = vectors[1];
          const vecC = vectors[2];
          const refVectors = vectors.slice(3);

          // Compute: B - A + C (the classic analogy operation)
          const resultVec = vecA.map((_, d) => vecB[d] - vecA[d] + vecC[d]);

          // Find nearest reference concepts
          const similarities = REFERENCE_VOCAB.map((concept, i) => ({
            concept,
            similarity: cosineSimilarity(resultVec, refVectors[i]),
          }));

          // Filter out the input terms and sort
          similarities
            .filter(s => s.concept !== a && s.concept !== b && s.concept !== c)
            .sort((x, y) => y.similarity - x.similarity);

          const nearest = similarities
            .filter(s => s.concept !== a && s.concept !== b && s.concept !== c)
            .sort((x, y) => y.similarity - x.similarity)
            .slice(0, 8);

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            a, b, c,
            modelId: m.id,
            modelName: spec?.name || m.id,
            nearest,
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
          <h2 className="font-display text-display-md font-bold">Analogy Arithmetic</h2>
          <ResetButton onReset={() => { setTermA(""); setTermB(""); setTermC(""); setResults([]); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          The classic word2vec operation applied to modern embedding models with critical intent.
          Compute B &minus; A + C and find what the manifold produces. &ldquo;King minus man plus
          woman equals queen&rdquo; was the original demonstration. What happens when you apply
          transformations that encode political arguments as vector arithmetic?
        </p>

        <div className="space-y-3">
          {/* Formula display */}
          <div className="bg-muted rounded-sm p-3 text-center font-sans text-body-lg">
            <span className="font-bold text-burgundy">{termB || "B"}</span>
            <span className="text-muted-foreground mx-2">&minus;</span>
            <span className="font-bold">{termA || "A"}</span>
            <span className="text-muted-foreground mx-2">+</span>
            <span className="font-bold">{termC || "C"}</span>
            <span className="text-muted-foreground mx-2">=</span>
            <span className="font-bold text-gold">?</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-sans text-caption text-muted-foreground mb-1">A (subtract this)</label>
              <input
                type="text"
                value={termA}
                onChange={e => setTermA(e.target.value)}
                placeholder="king"
                className="input-editorial text-body-sm"
              />
            </div>
            <div>
              <label className="block font-sans text-caption text-muted-foreground mb-1">B (start here)</label>
              <input
                type="text"
                value={termB}
                onChange={e => setTermB(e.target.value)}
                placeholder="queen"
                className="input-editorial text-body-sm"
              />
            </div>
            <div>
              <label className="block font-sans text-caption text-muted-foreground mb-1">C (add this)</label>
              <input
                type="text"
                value={termC}
                onChange={e => setTermC(e.target.value)}
                placeholder="man"
                className="input-editorial text-body-sm"
              />
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
              <span className="font-bold text-burgundy">{r.b}</span>
              <span className="text-muted-foreground mx-2">&minus;</span>
              <span className="font-bold">{r.a}</span>
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
              computed vector B &minus; A + C. If the analogy holds in the geometry, the top
              result should complete the proportion. If it does not, the manifold&apos;s
              internal logic diverges from the conceptual relationship you are testing.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

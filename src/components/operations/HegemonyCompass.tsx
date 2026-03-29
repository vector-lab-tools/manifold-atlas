"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { SimilarityBridge } from "@/components/viz/SimilarityBridge";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

const PRESETS: Record<string, { concept: string; clusterA: { name: string; terms: string[] }; clusterB: { name: string; terms: string[] } }> = {
  Freedom: {
    concept: "freedom",
    clusterA: { name: "Market liberalism", terms: ["market", "choice", "consumer", "individual", "property", "competition", "enterprise", "deregulation"] },
    clusterB: { name: "Emancipatory politics", terms: ["liberation", "solidarity", "collective", "emancipation", "resistance", "justice", "equality", "self-determination"] },
  },
  Democracy: {
    concept: "democracy",
    clusterA: { name: "Liberal proceduralism", terms: ["election", "voting", "representation", "constitution", "institution", "parliament", "rule of law", "governance"] },
    clusterB: { name: "Radical democracy", terms: ["participation", "assembly", "commons", "deliberation", "direct action", "autonomy", "popular sovereignty", "grassroots"] },
  },
  Intelligence: {
    concept: "intelligence",
    clusterA: { name: "Techno-rationalism", terms: ["computation", "optimisation", "efficiency", "data", "algorithm", "performance", "metric", "automation"] },
    clusterB: { name: "Embodied cognition", terms: ["understanding", "wisdom", "judgement", "intuition", "consciousness", "experience", "care", "attentiveness"] },
  },
  Security: {
    concept: "security",
    clusterA: { name: "State/military", terms: ["surveillance", "border", "police", "defence", "threat", "control", "enforcement", "intelligence"] },
    clusterB: { name: "Human security", terms: ["shelter", "food", "health", "dignity", "community", "belonging", "trust", "wellbeing"] },
  },
  Progress: {
    concept: "progress",
    clusterA: { name: "Techno-capitalism", terms: ["growth", "innovation", "disruption", "scaling", "productivity", "acceleration", "development", "modernisation"] },
    clusterB: { name: "Social justice", terms: ["equality", "redistribution", "reparation", "sustainability", "solidarity", "dignity", "sufficiency", "care"] },
  },
};

interface CompassResult {
  concept: string;
  clusterAName: string;
  clusterBName: string;
  models: Array<{
    modelId: string;
    modelName: string;
    simToA: number;
    simToB: number;
    bias: number; // positive = closer to A, negative = closer to B
    biasLabel: string;
  }>;
}

interface HegemonyCompassProps {
  onQueryTime: (time: number) => void;
}

export function HegemonyCompass({ onQueryTime }: HegemonyCompassProps) {
  const [selectedPreset, setSelectedPreset] = useState("Freedom");
  const [customConcept, setCustomConcept] = useState("");
  const [customA, setCustomA] = useState("");
  const [customB, setCustomB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<CompassResult | null>(null);
  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleCompute = async () => {
    let concept: string;
    let clusterATerms: string[];
    let clusterBTerms: string[];
    let clusterAName: string;
    let clusterBName: string;

    if (selectedPreset === "custom") {
      concept = customConcept.trim();
      clusterATerms = customA.split(",").map(s => s.trim()).filter(s => s);
      clusterBTerms = customB.split(",").map(s => s.trim()).filter(s => s);
      clusterAName = "Cluster A";
      clusterBName = "Cluster B";
      if (!concept || clusterATerms.length === 0 || clusterBTerms.length === 0) return;
    } else {
      const preset = PRESETS[selectedPreset];
      concept = preset.concept;
      clusterATerms = preset.clusterA.terms;
      clusterBTerms = preset.clusterB.terms;
      clusterAName = preset.clusterA.name;
      clusterBName = preset.clusterB.name;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const allTexts = [concept, ...clusterATerms, ...clusterBTerms];
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const models = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const conceptVec = vectors[0];
          const aVecs = vectors.slice(1, 1 + clusterATerms.length);
          const bVecs = vectors.slice(1 + clusterATerms.length);

          const avgSimA = aVecs.reduce((sum, v) => sum + cosineSimilarity(conceptVec, v), 0) / aVecs.length;
          const avgSimB = bVecs.reduce((sum, v) => sum + cosineSimilarity(conceptVec, v), 0) / bVecs.length;
          const bias = avgSimA - avgSimB;

          let biasLabel: string;
          if (Math.abs(bias) < 0.01) biasLabel = "Evenly positioned";
          else if (bias > 0.05) biasLabel = `Strong pull toward ${clusterAName}`;
          else if (bias > 0.02) biasLabel = `Leans toward ${clusterAName}`;
          else if (bias > 0) biasLabel = `Slight lean toward ${clusterAName}`;
          else if (bias < -0.05) biasLabel = `Strong pull toward ${clusterBName}`;
          else if (bias < -0.02) biasLabel = `Leans toward ${clusterBName}`;
          else biasLabel = `Slight lean toward ${clusterBName}`;

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            modelId: m.id,
            modelName: spec?.name || m.id,
            simToA: avgSimA,
            simToB: avgSimB,
            bias,
            biasLabel,
          };
        });

      setResult({ concept, clusterAName, clusterBName, models });
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
          <h2 className="font-display text-display-md font-bold">Hegemony Compass</h2>
          <ResetButton onReset={() => { setResult(null); setError(null); setCustomConcept(""); setCustomA(""); setCustomB(""); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Place a contested concept between two competing ideological clusters and measure
          which side the manifold pulls it toward. The result reveals which framing the
          geometry has naturalised as the default meaning.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="font-sans text-body-sm text-slate">Test:</label>
            <select
              value={selectedPreset}
              onChange={e => setSelectedPreset(e.target.value)}
              className="input-editorial w-auto py-1.5 px-3 text-body-sm"
            >
              {Object.keys(PRESETS).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>

          {selectedPreset === "custom" && (
            <div className="space-y-2">
              <input
                type="text"
                value={customConcept}
                onChange={e => setCustomConcept(e.target.value)}
                placeholder="Contested concept, e.g. freedom"
                className="input-editorial text-body-sm"
              />
              <input
                type="text"
                value={customA}
                onChange={e => setCustomA(e.target.value)}
                placeholder="Cluster A terms (comma separated)"
                className="input-editorial text-body-sm"
              />
              <input
                type="text"
                value={customB}
                onChange={e => setCustomB(e.target.value)}
                placeholder="Cluster B terms (comma separated)"
                className="input-editorial text-body-sm"
              />
            </div>
          )}

          {selectedPreset !== "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                  {PRESETS[selectedPreset].clusterA.name}
                </div>
                <p className="font-sans text-caption text-muted-foreground">
                  {PRESETS[selectedPreset].clusterA.terms.join(", ")}
                </p>
              </div>
              <div className="bg-muted rounded-sm p-3">
                <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                  {PRESETS[selectedPreset].clusterB.name}
                </div>
                <p className="font-sans text-caption text-muted-foreground">
                  {PRESETS[selectedPreset].clusterB.terms.join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleCompute}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Measure
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {result && result.models.map(m => (
        <div key={m.modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <span className="font-sans text-body-sm font-semibold">{m.modelName}</span>
          </div>

          <div className="thin-rule mx-5" />

          {/* Visual compass */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {result.clusterAName}
              </span>
              <span className="font-sans text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {result.clusterBName}
              </span>
            </div>

            {/* Compass bar */}
            <div className="relative h-4 bg-muted rounded-full mb-2">
              {/* Centre line */}
              <div className="absolute left-1/2 top-0 w-px h-full bg-parchment-dark" />
              {/* Marker */}
              {(() => {
                // Map bias to position: -0.1 = far right, +0.1 = far left
                const maxBias = 0.1;
                const normalised = Math.max(-1, Math.min(1, m.bias / maxBias));
                const pct = 50 + normalised * 40; // 10% to 90%
                return (
                  <div
                    className="absolute top-[-2px] w-5 h-5 rounded-full bg-burgundy border-2 border-card shadow-editorial"
                    style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                  />
                );
              })()}
            </div>

            {/* Similarity scores */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-muted rounded-sm p-2.5">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">
                  Avg similarity to {result.clusterAName}
                </div>
                <div className="font-sans text-body-sm font-bold tabular-nums mt-0.5">
                  {m.simToA.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted rounded-sm p-2.5">
                <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">
                  Avg similarity to {result.clusterBName}
                </div>
                <div className="font-sans text-body-sm font-bold tabular-nums mt-0.5">
                  {m.simToB.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Interpretation */}
          <div className="px-5 py-5">
            <p className="font-sans text-body-sm font-semibold" style={{ color: Math.abs(m.bias) > 0.02 ? "#ea580c" : "#16a34a" }}>
              {m.biasLabel}
            </p>
            <p className="font-sans text-body-sm text-slate mt-2">
              The manifold positions &ldquo;{result.concept}&rdquo; {m.bias > 0.02
                ? `closer to the ${result.clusterAName} cluster. This framing is the geometry's default: what "${result.concept}" means, before any context is supplied, is already tilted toward this ideological position.`
                : m.bias < -0.02
                  ? `closer to the ${result.clusterBName} cluster. This framing is the geometry's default.`
                  : `roughly equidistant between the two clusters. The contested meaning remains genuinely open in this geometry.`
              }
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

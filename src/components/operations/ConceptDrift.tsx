"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Waypoints, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { projectPCA3D } from "@/lib/geometry/pca";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import { similarityColor } from "@/lib/similarity-scale";
import { ResetButton } from "@/components/shared/ResetButton";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[450px] flex items-center justify-center bg-card text-slate text-body-sm rounded-sm">Loading...</div> }
);

const DEFAULT_CONCEPT = "justice";
const DEFAULT_CONTEXTS = [
  "justice",
  "Justice requires that the punishment fit the crime",
  "Justice is tempered by mercy and the capacity for forgiveness",
  "Economic justice demands the fair distribution of wealth and resources",
  "Justice in wartime means holding combatants accountable for their actions",
  "Algorithmic justice requires that automated decisions do not discriminate",
  "Gender justice means the equal treatment of all people regardless of gender",
  "Racial justice demands the dismantling of systemic discrimination",
  "Climate justice holds polluting nations responsible for environmental harm",
  "Restorative justice focuses on repairing harm rather than imposing punishment",
];

interface DriftModelResult {
  modelId: string;
  modelName: string;
  vectors: number[][];
  drifts: Array<{
    variant: string;
    similarity: number;
    displacement: number;
  }>;
  pairwise: number[][];
}

interface DriftResult {
  concept: string;
  variants: string[];
  models: DriftModelResult[];
}

interface ConceptDriftProps {
  onQueryTime: (time: number) => void;
}

export function ConceptDrift({ onQueryTime }: ConceptDriftProps) {
  const [concept, setConcept] = useState("");
  const [contextsText, setContextsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<DriftResult | null>(null);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const handleCompute = async () => {
    const effectiveConcept = concept.trim() || DEFAULT_CONCEPT;
    if (!concept.trim()) setConcept(DEFAULT_CONCEPT);

    let variants: string[];
    if (contextsText.trim()) {
      variants = contextsText.split("\n").map(s => s.trim()).filter(s => s.length > 0);
      if (!variants.includes(effectiveConcept)) {
        variants.unshift(effectiveConcept);
      }
    } else {
      variants = DEFAULT_CONTEXTS.map(c =>
        c === DEFAULT_CONCEPT ? effectiveConcept : c.replace(DEFAULT_CONCEPT, effectiveConcept)
      );
      setContextsText(variants.join("\n"));
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const modelVectors = await embedAll(variants);
      const enabledModels = getEnabledModels();

      const models: DriftModelResult[] = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;
          const baseVec = vectors[0];

          const drifts = variants.map((variant, i) => {
            const sim = cosineSimilarity(baseVec, vectors[i]);
            return { variant, similarity: sim, displacement: 1 - sim };
          });

          const pairwise: number[][] = [];
          for (let i = 0; i < vectors.length; i++) {
            pairwise[i] = [];
            for (let j = 0; j < vectors.length; j++) {
              pairwise[i][j] = cosineSimilarity(vectors[i], vectors[j]);
            }
          }

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return { modelId: m.id, modelName: spec?.name || m.id, vectors, drifts, pairwise };
        });

      setResult({ concept: effectiveConcept, variants, models });
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
          <h2 className="font-display text-display-md font-bold">Vector Drift</h2>
          <ResetButton onReset={() => { setConcept(""); setContextsText(""); setResult(null); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          How much does context warp the manifold? Embed the same concept in different
          propositional sentences and watch it move through the geometry. Use full claims
          rather than bare phrases: &ldquo;Justice requires that the punishment fit the
          crime&rdquo; produces a sharper embedding than &ldquo;justice in the context of
          punishment.&rdquo; The 3D drift cloud shows all positions simultaneously; the
          pathway heatmap reveals which framings converge and which diverge.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Waypoints size={20} className="text-slate flex-shrink-0" />
            <input
              type="text"
              value={concept}
              onChange={e => setConcept(e.target.value)}
              placeholder={DEFAULT_CONCEPT}
              className="input-editorial flex-1"
            />
          </div>
          <textarea
            value={contextsText}
            onChange={e => setContextsText(e.target.value)}
            placeholder={DEFAULT_CONTEXTS.join("\n")}
            className="input-editorial min-h-[120px] resize-y text-body-sm"
            rows={6}
          />
          <div className="flex items-center justify-between">
            <p className="font-sans text-caption text-muted-foreground">
              One variant per line. First line is the bare concept. Remaining lines should be
              full propositional sentences that situate the concept in different domains.
            </p>
            <button
              onClick={handleCompute}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Test Drift"}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {result && result.models.map(m => (
        <DriftModelPanel
          key={m.modelId}
          model={m}
          concept={result.concept}
          variants={result.variants}
          isDark={isDark}
        />
      ))}
    </div>
  );
}

function DriftModelPanel({ model, concept, variants, isDark }: {
  model: DriftModelResult;
  concept: string;
  variants: string[];
  isDark: boolean;
}) {
  // Project all variant vectors to 3D
  const projection = useMemo(() => {
    return projectPCA3D(model.vectors);
  }, [model.vectors]);

  // Short labels for the plot (strip "X in the context of Y" down to "Y")
  const shortLabels = useMemo(() => {
    return variants.map((v, i) => {
      if (i === 0) return concept;
      const match = v.match(/context of (.+)$/i);
      return match ? match[1] : v;
    });
  }, [variants, concept]);

  // 3D drift cloud traces
  const traces = useMemo(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const t: any[] = [];

    // Lines from base concept to each variant
    for (let i = 1; i < projection.length; i++) {
      const color = similarityColor(model.drifts[i].similarity);
      t.push({
        x: [projection[0][0], projection[i][0]],
        y: [projection[0][1], projection[i][1]],
        z: [projection[0][2], projection[i][2]],
        mode: "lines",
        type: "scatter3d",
        line: { color, width: 3, dash: "dot" },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    // Pathway lines between consecutive variants (excluding base)
    for (let i = 1; i < projection.length - 1; i++) {
      t.push({
        x: [projection[i][0], projection[i + 1][0]],
        y: [projection[i][1], projection[i + 1][1]],
        z: [projection[i][2], projection[i + 1][2]],
        mode: "lines",
        type: "scatter3d",
        line: { color: isDark ? "rgba(100,100,140,0.3)" : "rgba(140,130,110,0.3)", width: 1.5 },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    // Variant points
    t.push({
      x: projection.slice(1).map(p => p[0]),
      y: projection.slice(1).map(p => p[1]),
      z: projection.slice(1).map(p => p[2]),
      text: shortLabels.slice(1),
      mode: "markers+text",
      type: "scatter3d",
      textposition: "top center",
      textfont: {
        size: 12,
        family: "Inter, system-ui, sans-serif",
        color: isDark ? "rgba(200,200,220,0.9)" : "rgba(80,70,60,0.9)",
      },
      marker: {
        size: 6,
        color: model.drifts.slice(1).map(d => similarityColor(d.similarity)),
        opacity: 0.9,
      },
      hoverinfo: "text",
      showlegend: false,
    });

    // Base concept (gold diamond, always labelled)
    t.push({
      x: [projection[0][0]],
      y: [projection[0][1]],
      z: [projection[0][2]],
      text: [concept],
      mode: "markers+text",
      type: "scatter3d",
      textposition: "top center",
      textfont: { size: 14, family: "Inter, system-ui, sans-serif", color: "#d4a017" },
      marker: { size: 12, color: "#d4a017", symbol: "diamond" },
      hoverinfo: "text",
      showlegend: false,
    });

    return t;
  }, [projection, model.drifts, shortLabels, concept, isDark]);

  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";
  const gridColor = isDark ? "rgba(60,60,100,0.3)" : "rgba(140,130,110,0.35)";

  const layout = useMemo(() => ({
    height: 450,
    margin: { t: 0, r: 0, b: 0, l: 0 },
    paper_bgcolor: bgColor,
    scene: {
      bgcolor: bgColor,
      xaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
      yaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
      zaxis: { showgrid: true, gridcolor: gridColor, zeroline: false, showticklabels: false, title: { text: "" }, showspikes: false },
      camera: { eye: { x: 1.8, y: 1.8, z: 1.0 } },
    },
    showlegend: false,
  }), [bgColor, gridColor]);

  // Pairwise heatmap data
  const heatmapTraces = useMemo(() => {
    return [{
      z: model.pairwise,
      x: shortLabels,
      y: shortLabels,
      type: "heatmap",
      colorscale: [
        [0, isDark ? "#0a0a1a" : "#f5f2ec"],
        [0.5, "#d97706"],
        [0.85, "#ea580c"],
        [1, "#dc2626"],
      ],
      zmin: 0.3,
      zmax: 1.0,
      text: model.pairwise.map(row => row.map(v => v.toFixed(3))),
      texttemplate: "%{text}",
      textfont: { size: 9 },
      hoverinfo: "z",
      showscale: true,
      colorbar: {
        title: { text: "Cosine Sim", font: { size: 10 } },
        tickfont: { size: 9 },
        len: 0.8,
      },
    }];
  }, [model.pairwise, shortLabels, isDark]);

  const heatmapLayout = useMemo(() => ({
    height: 350,
    margin: { t: 30, r: 80, b: 100, l: 100 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: { side: "bottom", tickangle: -45, tickfont: { size: 10 } },
    yaxis: { autorange: "reversed", tickfont: { size: 10 } },
    title: { text: "Pairwise Similarity Between All Contextual Framings", font: { size: 12 } },
  }), []);

  const maxDisplacement = Math.max(...model.drifts.slice(1).map(x => x.displacement));
  const sorted = [...model.drifts.slice(1)].sort((a, b) => b.displacement - a.displacement);

  return (
    <div className="card-editorial overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <span className="font-sans text-body-sm font-semibold">{model.modelName}</span>
      </div>

      <div className="thin-rule mx-5" />

      {/* 3D Drift Cloud */}
      <div className="px-5 py-5">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
          Drift Cloud
        </h4>
        <p className="font-sans text-caption text-muted-foreground mb-3">
          The gold diamond is &ldquo;{concept}&rdquo; in its bare form. Each dot is the same
          concept embedded with a different contextual framing. Lines connect each variant back
          to the bare position. Colour indicates displacement: green is close, red is far.
          Drag to rotate.
        </p>
        <div className="rounded-sm overflow-hidden border border-parchment" style={{ background: bgColor }}>
          <PlotlyPlot
            data={traces}
            layout={layout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "450px" }}
          />
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Displacement bars */}
      <div className="px-5 py-5">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
          Displacement from Bare Concept
        </h4>
        <p className="font-sans text-caption text-muted-foreground mb-4">
          How far does each context pull &ldquo;{concept}&rdquo; from its default position?
          Contexts that produce large displacement are geometrically powerful: they restructure
          the concept&apos;s neighbourhood in the manifold.
        </p>

        <div className="space-y-2">
          {sorted.map((d, i) => {
            const barWidth = maxDisplacement > 0 ? (d.displacement / maxDisplacement) * 100 : 0;
            const color = similarityColor(d.similarity);
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-body-sm">{d.variant}</span>
                  <span className="font-sans text-caption tabular-nums font-semibold" style={{ color }}>
                    {d.displacement.toFixed(4)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="thin-rule mx-5" />

      {/* Pairwise heatmap */}
      <div className="px-5 py-5">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
          Pathway Heatmap
        </h4>
        <p className="font-sans text-caption text-muted-foreground mb-3">
          Pairwise cosine similarity between every contextual framing.
          This reveals which contexts create similar geometric positions (the manifold treats
          them as related pathways) and which create divergent routes through the space.
          Dark cells indicate distant framings; bright cells indicate convergent ones.
        </p>
        <PlotlyPlot
          data={heatmapTraces}
          layout={heatmapLayout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "350px" }}
        />
      </div>

      <div className="thin-rule mx-5" />

      {/* Summary */}
      <div className="px-5 py-5">
        <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-3">
          Summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Most displaced</div>
            <div className="font-sans text-body-sm font-bold mt-1">{sorted[0]?.variant}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5 tabular-nums">
              {sorted[0]?.displacement.toFixed(4)} displacement
            </div>
          </div>
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Least displaced</div>
            <div className="font-sans text-body-sm font-bold mt-1">{sorted[sorted.length - 1]?.variant}</div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5 tabular-nums">
              {sorted[sorted.length - 1]?.displacement.toFixed(4)} displacement
            </div>
          </div>
          <div className="bg-muted rounded-sm p-3">
            <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Drift range</div>
            <div className="font-sans text-body-sm font-bold mt-1 tabular-nums">
              {(sorted[0]?.displacement - sorted[sorted.length - 1]?.displacement).toFixed(4)}
            </div>
            <div className="font-sans text-caption text-muted-foreground mt-0.5">
              {sorted[0]?.displacement - sorted[sorted.length - 1]?.displacement > 0.05
                ? "High contextual sensitivity: the manifold reshapes this concept substantially depending on framing."
                : "Low contextual sensitivity: this concept is geometrically rigid across framings."
              }
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Export */}
          <div className="px-5 py-3 flex justify-end">
            <button
              onClick={() => {
                const rows = ["variant,similarity_to_base,displacement"];
                model.drifts.forEach(d => rows.push(`"${d.variant}",${d.similarity.toFixed(6)},${d.displacement.toFixed(6)}`));
                const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `vector-drift-${concept}-${model.modelId}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-editorial-ghost text-caption px-3 py-1.5"
            >
              <Download size={14} className="mr-1" />Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

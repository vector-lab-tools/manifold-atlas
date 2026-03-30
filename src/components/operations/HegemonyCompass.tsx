"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Plus } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { ResetButton } from "@/components/shared/ResetButton";
import { EMBEDDING_MODELS } from "@/types/embeddings";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm">Loading compass...</div> }
);

interface CompassAxis {
  negative: { label: string; terms: string[] }; // left / bottom
  positive: { label: string; terms: string[] }; // right / top
}

interface CompassPreset {
  name: string;
  xAxis: CompassAxis;
  yAxis: CompassAxis;
}

const PRESETS: Record<string, CompassPreset> = {
  "Political Compass": {
    name: "Political Compass",
    xAxis: {
      negative: { label: "Economic Left", terms: ["redistribution", "collective ownership", "welfare state", "public services", "labour rights", "regulation", "equality", "solidarity", "commons"] },
      positive: { label: "Economic Right", terms: ["free market", "privatisation", "deregulation", "individual enterprise", "competition", "property rights", "profit", "austerity", "shareholder value"] },
    },
    yAxis: {
      negative: { label: "Libertarian", terms: ["individual freedom", "civil liberties", "autonomy", "decentralisation", "privacy", "voluntary association", "self-determination", "tolerance", "pluralism"] },
      positive: { label: "Authoritarian", terms: ["state authority", "social order", "hierarchy", "discipline", "obedience", "tradition", "security", "national identity", "conformity"] },
    },
  },
  "Technology Compass": {
    name: "Technology Compass",
    xAxis: {
      negative: { label: "Commons", terms: ["open source", "public knowledge", "commons", "collective intelligence", "shared infrastructure", "community ownership", "transparency", "interoperability"] },
      positive: { label: "Proprietary", terms: ["intellectual property", "trade secret", "vendor lock-in", "platform monopoly", "proprietary data", "closed source", "subscription model", "walled garden"] },
    },
    yAxis: {
      negative: { label: "Human-centred", terms: ["human agency", "dignity", "consent", "accountability", "explainability", "care", "participation", "embodiment"] },
      positive: { label: "Techno-solutionist", terms: ["automation", "optimisation", "efficiency", "scale", "disruption", "acceleration", "artificial intelligence", "algorithmic governance"] },
    },
  },
  "Knowledge Compass": {
    name: "Knowledge Compass",
    xAxis: {
      negative: { label: "Critical", terms: ["ideology critique", "power analysis", "deconstruction", "situated knowledge", "reflexivity", "emancipation", "dialectics", "historicism"] },
      positive: { label: "Positivist", terms: ["objectivity", "measurement", "replication", "hypothesis testing", "empirical evidence", "quantification", "prediction", "falsification"] },
    },
    yAxis: {
      negative: { label: "Particular", terms: ["local knowledge", "indigenous knowledge", "lived experience", "case study", "ethnography", "phenomenology", "narrative", "context"] },
      positive: { label: "Universal", terms: ["generalisation", "law", "theory", "abstraction", "model", "formal system", "axiom", "universality"] },
    },
  },
};

interface PlottedConcept {
  concept: string;
  x: number; // position on x-axis (-1 to +1)
  y: number; // position on y-axis (-1 to +1)
  modelId: string;
  modelName: string;
}

interface HegemonyCompassProps {
  onQueryTime: (time: number) => void;
}

export function HegemonyCompass({ onQueryTime }: HegemonyCompassProps) {
  const [selectedPreset, setSelectedPreset] = useState("Political Compass");
  const [conceptInput, setConceptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [plottedConcepts, setPlottedConcepts] = useState<PlottedConcept[]>([]);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null); // null = auto
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const preset = PRESETS[selectedPreset];

  const DEFAULT_CONCEPTS = ["democracy", "freedom", "sovereignty", "revolution", "capitalism"];
  let defaultIndex = 0;

  const plotConcepts = async (concepts: string[]) => {
    if (concepts.length === 0) return;

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const allAxisTerms = [
        ...preset.xAxis.negative.terms,
        ...preset.xAxis.positive.terms,
        ...preset.yAxis.negative.terms,
        ...preset.yAxis.positive.terms,
      ];
      const allTexts = [...concepts, ...allAxisTerms];
      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const xNegCount = preset.xAxis.negative.terms.length;
      const xPosCount = preset.xAxis.positive.terms.length;
      const yNegCount = preset.yAxis.negative.terms.length;

      const newPoints: PlottedConcept[] = [];

      for (const m of enabledModels.filter(m => modelVectors.has(m.id))) {
        const vectors = modelVectors.get(m.id)!;

        // Axis vectors start after all concepts
        const axisOffset = concepts.length;
        let offset = axisOffset;
        const xNegVecs = vectors.slice(offset, offset + xNegCount); offset += xNegCount;
        const xPosVecs = vectors.slice(offset, offset + xPosCount); offset += xPosCount;
        const yNegVecs = vectors.slice(offset, offset + yNegCount); offset += yNegCount;
        const yPosVecs = vectors.slice(offset);

        for (let ci = 0; ci < concepts.length; ci++) {
          const conceptVec = vectors[ci];

          const avgSimXNeg = xNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xNegVecs.length;
          const avgSimXPos = xPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / xPosVecs.length;
          const avgSimYNeg = yNegVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yNegVecs.length;
          const avgSimYPos = yPosVecs.reduce((s, v) => s + cosineSimilarity(conceptVec, v), 0) / yPosVecs.length;

          const x = avgSimXPos - avgSimXNeg;
          const y = avgSimYPos - avgSimYNeg;

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          newPoints.push({
            concept: concepts[ci],
            x,
            y,
            modelId: m.id,
            modelName: spec?.name || m.id,
          });
        }
      }

      setPlottedConcepts(prev => [...prev, ...newPoints]);
      setConceptInput("");
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConcept = async () => {
    const input = conceptInput.trim();
    if (!input) {
      // Plot all defaults at once
      await plotConcepts(DEFAULT_CONCEPTS);
    } else {
      // Support comma-separated concepts
      const concepts = input.split(",").map(s => s.trim()).filter(s => s);
      await plotConcepts(concepts);
    }
  };

  // Group by model for rendering
  const modelGroups = useMemo(() => {
    const groups = new Map<string, { modelName: string; points: PlottedConcept[] }>();
    for (const pt of plottedConcepts) {
      if (!groups.has(pt.modelId)) {
        groups.set(pt.modelId, { modelName: pt.modelName, points: [] });
      }
      groups.get(pt.modelId)!.points.push(pt);
    }
    return groups;
  }, [plottedConcepts]);

  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";
  const gridColor = isDark ? "rgba(100,100,140,0.3)" : "rgba(140,130,110,0.35)";
  const textColor = isDark ? "rgba(200,200,220,0.8)" : "rgba(80,70,60,0.8)";

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Hegemony Compass</h2>
          <ResetButton onReset={() => { setPlottedConcepts([]); setConceptInput(""); setError(null); setZoomOverride(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          A four-pole compass that plots where the manifold positions contested concepts.
          Each concept you add appears as a point on the diagram. Points accumulate until
          you reset, building a map of ideological positioning in the geometry.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="font-sans text-body-sm text-slate">Compass:</label>
            <select
              value={selectedPreset}
              onChange={e => { setSelectedPreset(e.target.value); setPlottedConcepts([]); setZoomOverride(null); }}
              className="input-editorial w-auto py-1.5 px-3 text-body-sm"
            >
              {Object.keys(PRESETS).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Axis labels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-sm p-2">
              <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                X-axis: {preset.xAxis.negative.label} &harr; {preset.xAxis.positive.label}
              </div>
            </div>
            <div className="bg-muted rounded-sm p-2">
              <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Y-axis: {preset.yAxis.negative.label} &harr; {preset.yAxis.positive.label}
              </div>
            </div>
          </div>

          {/* Concept input */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={conceptInput}
              onChange={e => setConceptInput(e.target.value)}
              placeholder="Enter a concept to plot, e.g. freedom, justice, efficiency"
              className="input-editorial flex-1"
              onKeyDown={e => e.key === "Enter" && handleAddConcept()}
            />
            <button
              onClick={handleAddConcept}
              disabled={loading}
              className="btn-editorial-primary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} className="mr-1" />Plot</>}
            </button>
          </div>

          {plottedConcepts.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="font-sans text-caption text-muted-foreground">
                {new Set(plottedConcepts.map(p => p.concept)).size} concept{new Set(plottedConcepts.map(p => p.concept)).size !== 1 ? "s" : ""} plotted.
                Add more or reset to start over.
              </p>
              <span className="font-sans text-caption text-muted-foreground">
                Use +/− on the chart to zoom
              </span>
            </div>
          )}
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleAddConcept} />}

      {/* Compass plots per model */}
      {[...modelGroups.entries()].map(([modelId, { modelName, points }]) => (
        <div key={modelId} className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <span className="font-sans text-body-sm font-semibold">{modelName}</span>
          </div>
          <div className="thin-rule mx-5" />
          <div className="relative px-2 py-2" style={{ background: bgColor }}>
            {/* Zoom buttons overlaid on chart */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
              <button
                onClick={() => {
                  const current = zoomOverride ?? (() => {
                    const xs = points.map(p => p.x);
                    const ys = points.map(p => p.y);
                    return Math.max(0.005, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.5;
                  })();
                  setZoomOverride(Math.max(0.003, current * 0.6));
                }}
                className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
                title="Zoom in"
              >+</button>
              <button
                onClick={() => {
                  const current = zoomOverride ?? (() => {
                    const xs = points.map(p => p.x);
                    const ys = points.map(p => p.y);
                    return Math.max(0.005, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.5;
                  })();
                  setZoomOverride(Math.min(0.3, current * 1.6));
                }}
                className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
                title="Zoom out"
              >−</button>
              {zoomOverride !== null && (
                <button
                  onClick={() => setZoomOverride(null)}
                  className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-muted-foreground hover:text-foreground hover:bg-card flex items-center justify-center font-sans text-[9px] font-semibold shadow-editorial"
                  title="Reset to auto-zoom"
                >A</button>
              )}
            </div>
            <PlotlyPlot
              data={[
                {
                  x: points.map(p => p.x),
                  y: points.map(p => p.y),
                  text: points.map(p => p.concept),
                  mode: "markers+text",
                  type: "scatter",
                  textposition: "top center",
                  textfont: { size: 12, family: "Inter, system-ui, sans-serif", color: textColor },
                  marker: {
                    size: 12,
                    color: isDark ? "rgba(210,160,60,0.9)" : "rgba(160,110,20,0.9)",
                    line: { color: isDark ? "rgba(210,160,60,0.3)" : "rgba(160,110,20,0.3)", width: 2 },
                  },
                  hoverinfo: "text",
                },
              ]}
              layout={(() => {
                // Zoom: use override if set, otherwise auto-fit to data
                let extent: number;
                if (zoomOverride !== null) {
                  extent = zoomOverride;
                } else {
                  const xs = points.map(p => p.x);
                  const ys = points.map(p => p.y);
                  const maxAbsX = Math.max(0.005, ...xs.map(Math.abs));
                  const maxAbsY = Math.max(0.005, ...ys.map(Math.abs));
                  extent = Math.max(maxAbsX, maxAbsY) * 1.5; // 50% padding
                }

                return {
                  height: 520,
                  margin: { t: 40, r: 60, b: 60, l: 60 },
                  paper_bgcolor: bgColor,
                  plot_bgcolor: bgColor,
                  xaxis: {
                    zeroline: true,
                    zerolinecolor: isDark ? "rgba(200,200,220,0.6)" : "rgba(30,30,30,0.7)",
                    zerolinewidth: 2,
                    showgrid: true,
                    gridcolor: gridColor,
                    showticklabels: false,
                    range: [-extent, extent],
                  },
                  yaxis: {
                    zeroline: true,
                    zerolinecolor: isDark ? "rgba(200,200,220,0.6)" : "rgba(30,30,30,0.7)",
                    zerolinewidth: 2,
                    showgrid: true,
                    gridcolor: gridColor,
                    showticklabels: false,
                    range: [-extent, extent],
                    scaleanchor: "x",
                  },
                  showlegend: false,
                  // Axis labels at the very ends of each axis
                  annotations: [
                    // Right end of x-axis
                    { xref: "paper", yref: "paper", x: 1, y: 0.5, text: `<b>${preset.xAxis.positive.label}</b> →`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "right", yanchor: "top", yshift: -8 },
                    // Left end of x-axis
                    { xref: "paper", yref: "paper", x: 0, y: 0.5, text: `← <b>${preset.xAxis.negative.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "top", yshift: -8 },
                    // Top end of y-axis
                    { xref: "paper", yref: "paper", x: 0.5, y: 1, text: `↑ <b>${preset.yAxis.positive.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "bottom", xshift: 8 },
                    // Bottom end of y-axis
                    { xref: "paper", yref: "paper", x: 0.5, y: 0, text: `↓ <b>${preset.yAxis.negative.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "top", xshift: 8 },
                  ],
                  shapes: [
                    { type: "rect", x0: -extent, x1: 0, y0: 0, y1: extent, fillcolor: isDark ? "rgba(220,80,80,0.12)" : "rgba(220,80,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: extent, y0: 0, y1: extent, fillcolor: isDark ? "rgba(80,120,220,0.12)" : "rgba(80,120,220,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: -extent, x1: 0, y0: -extent, y1: 0, fillcolor: isDark ? "rgba(80,200,80,0.12)" : "rgba(80,200,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: extent, y0: -extent, y1: 0, fillcolor: isDark ? "rgba(160,80,200,0.12)" : "rgba(160,80,200,0.15)", line: { width: 0 }, layer: "below" },
                  ],
                };
              })()}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "500px" }}
            />
          </div>
          <div className="px-5 py-3">
            <p className="font-sans text-caption text-muted-foreground italic text-center">
              Position = difference in average cosine similarity between opposing pole clusters.
              Centre = equidistant from both poles on that axis.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

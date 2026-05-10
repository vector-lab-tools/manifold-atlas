"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Plus, ChevronRight, ChevronDown, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import { BenchmarkLoader } from "@/components/shared/BenchmarkLoader";
import {
  computeHegemonyCompass,
  hegemonyCompassTextList,
} from "@/lib/operations/hegemony-compass";

const PlotlyPlot = dynamic(
  () => import("@/components/viz/PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-card text-slate text-body-sm">Loading compass...</div> }
);

import { COMPASS_PRESETS, type CompassPreset, type CompassAxis } from "@/lib/compass-presets";

const PRESETS = COMPASS_PRESETS;

interface PlottedConcept {
  concept: string;
  x: number;
  y: number;
  modelId: string;
  modelName: string;
  // Raw pole similarities for the technical dashboard
  simXNeg: number;
  simXPos: number;
  simYNeg: number;
  simYPos: number;
}

interface PoleStats {
  label: string;
  terms: string[];
  /** Mean pairwise cosine among the pole's defining sentences. */
  coherence: number;
  /** L2 norm of the pole's centroid vector. */
  centroidNorm: number;
}

interface ModelAxisStats {
  modelId: string;
  modelName: string;
  dimensions: number;
  xNeg: PoleStats;
  xPos: PoleStats;
  yNeg: PoleStats;
  yPos: PoleStats;
  /** Cosine similarity between the two X-axis pole centroids. */
  xInterPoleCosine: number;
  /** Cosine similarity between the two Y-axis pole centroids. */
  yInterPoleCosine: number;
  /** Euclidean length of the X-axis (centroid distance). */
  xAxisNorm: number;
  /** Euclidean length of the Y-axis (centroid distance). */
  yAxisNorm: number;
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
  // Per-model axis statistics, recomputed each time plotConcepts runs.
  // Stored at the preset level (not per concept) so the dashboard can
  // show the same numbers for any concept plotted under this preset.
  const [axisStats, setAxisStats] = useState<ModelAxisStats[]>([]);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  // Bumped by the Recentre button. Feeds the Plotly key so the chart
  // fully remounts, discarding any pan/zoom state the user accumulated
  // via mouse interaction.
  const [recentreKey, setRecentreKey] = useState(0);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  // Custom axis state - prepopulated with an example (Nature vs Culture)
  const [customXNegLabel, setCustomXNegLabel] = useState("Nature");
  const [customXNegTerms, setCustomXNegTerms] = useState("The natural world has intrinsic value independent of human use, Biodiversity is essential for the health of ecosystems, Wilderness should be preserved from human intervention, Natural processes are self-regulating and should not be disrupted");
  const [customXPosLabel, setCustomXPosLabel] = useState("Culture");
  const [customXPosTerms, setCustomXPosTerms] = useState("Human civilisation improves upon the state of nature, Cultural production is what distinguishes humans from animals, The built environment is humanity's greatest achievement, Art and literature are the highest forms of human expression");
  const [customYNegLabel, setCustomYNegLabel] = useState("Individual");
  const [customYNegTerms, setCustomYNegTerms] = useState("Individual conscience is the ultimate moral authority, Personal autonomy is the foundation of human dignity, Each person is responsible for their own life choices, Individual creativity is the source of all innovation");
  const [customYPosLabel, setCustomYPosLabel] = useState("Collective");
  const [customYPosTerms, setCustomYPosTerms] = useState("The community is more important than any individual, Collective action is necessary to solve social problems, Shared institutions are the foundation of a just society, Solidarity between people is the basis of human flourishing");
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();
  const isDark = settings.darkMode;

  const isCustom = selectedPreset === "custom";
  const preset: CompassPreset = isCustom ? {
    name: "Custom",
    defaults: [],
    xAxis: {
      negative: { label: customXNegLabel || "Left", terms: customXNegTerms.split(",").map(s => s.trim()).filter(s => s) },
      positive: { label: customXPosLabel || "Right", terms: customXPosTerms.split(",").map(s => s.trim()).filter(s => s) },
    },
    yAxis: {
      negative: { label: customYNegLabel || "Bottom", terms: customYNegTerms.split(",").map(s => s.trim()).filter(s => s) },
      positive: { label: customYPosLabel || "Top", terms: customYPosTerms.split(",").map(s => s.trim()).filter(s => s) },
    },
  } : PRESETS[selectedPreset];


  const plotConcepts = async (concepts: string[]) => {
    if (concepts.length === 0) return;

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      // Delegate every embedding and all geometry to the pure-compute
      // module so the standalone component and the Runner produce
      // bit-identical results from the same inputs.
      const inputs = {
        xAxis: preset.xAxis,
        yAxis: preset.yAxis,
        concepts,
      };
      const texts = hegemonyCompassTextList(inputs);
      const modelVectors = await embedAll(texts);
      const enabledModels = getEnabledModels();
      const computed = computeHegemonyCompass(inputs, modelVectors, enabledModels);

      // Flatten into the shapes the render code already expects:
      // PlottedConcept[] (one per point × model) and ModelAxisStats[].
      const newPoints: PlottedConcept[] = [];
      const newAxisStats: ModelAxisStats[] = [];
      for (const m of computed.models) {
        for (const pt of m.points) {
          newPoints.push({
            concept: pt.concept,
            x: pt.x,
            y: pt.y,
            modelId: m.modelId,
            modelName: m.modelName,
            simXNeg: pt.simXNeg,
            simXPos: pt.simXPos,
            simYNeg: pt.simYNeg,
            simYPos: pt.simYPos,
          });
        }
        newAxisStats.push({
          modelId: m.modelId,
          modelName: m.modelName,
          dimensions: m.dimensions,
          xNeg: m.xNeg,
          xPos: m.xPos,
          yNeg: m.yNeg,
          yPos: m.yPos,
          xInterPoleCosine: m.xInterPoleCosine,
          yInterPoleCosine: m.yInterPoleCosine,
          xAxisNorm: m.xAxisNorm,
          yAxisNorm: m.yAxisNorm,
        });
      }
      setAxisStats(newAxisStats);

      // Deduplicate: if a concept+model pair already exists, replace it
      setPlottedConcepts(prev => {
        const existing = prev.filter(ep =>
          !newPoints.some(np => np.concept === ep.concept && np.modelId === ep.modelId)
        );
        return [...existing, ...newPoints];
      });
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
      // Plot all defaults for the selected compass
      await plotConcepts(PRESETS[selectedPreset]?.defaults || PRESETS["Political Compass"].defaults);
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
              <option value="custom">Custom axes</option>
            </select>
          </div>

          {isCustom ? (
            <div className="space-y-3 border border-parchment rounded-sm p-3">
              <p className="font-sans text-caption text-muted-foreground">
                Define four poles. Each pole is a label and a comma-separated list of associated terms.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">X-axis left pole</label>
                  <input type="text" value={customXNegLabel} onChange={e => setCustomXNegLabel(e.target.value)} placeholder="Label, e.g. Left" className="input-editorial text-body-sm py-1.5" />
                  <input type="text" value={customXNegTerms} onChange={e => setCustomXNegTerms(e.target.value)} placeholder="Terms (comma separated)" className="input-editorial text-caption py-1" />
                </div>
                <div className="space-y-1">
                  <label className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">X-axis right pole</label>
                  <input type="text" value={customXPosLabel} onChange={e => setCustomXPosLabel(e.target.value)} placeholder="Label, e.g. Right" className="input-editorial text-body-sm py-1.5" />
                  <input type="text" value={customXPosTerms} onChange={e => setCustomXPosTerms(e.target.value)} placeholder="Terms (comma separated)" className="input-editorial text-caption py-1" />
                </div>
                <div className="space-y-1">
                  <label className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Y-axis bottom pole</label>
                  <input type="text" value={customYNegLabel} onChange={e => setCustomYNegLabel(e.target.value)} placeholder="Label, e.g. Libertarian" className="input-editorial text-body-sm py-1.5" />
                  <input type="text" value={customYNegTerms} onChange={e => setCustomYNegTerms(e.target.value)} placeholder="Terms (comma separated)" className="input-editorial text-caption py-1" />
                </div>
                <div className="space-y-1">
                  <label className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Y-axis top pole</label>
                  <input type="text" value={customYPosLabel} onChange={e => setCustomYPosLabel(e.target.value)} placeholder="Label, e.g. Authoritarian" className="input-editorial text-body-sm py-1.5" />
                  <input type="text" value={customYPosTerms} onChange={e => setCustomYPosTerms(e.target.value)} placeholder="Terms (comma separated)" className="input-editorial text-caption py-1" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { axis: "X", neg: preset.xAxis.negative, pos: preset.xAxis.positive },
                { axis: "Y", neg: preset.yAxis.negative, pos: preset.yAxis.positive },
              ].map(({ axis, neg, pos }) => (
                <div key={axis} className="bg-muted rounded-sm p-2 space-y-1.5">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {axis}-axis: {neg.label} &harr; {pos.label}
                  </div>
                  <div className="flex gap-2">
                    <div className="group relative flex-1">
                      <div className="font-sans text-[9px] text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                        {neg.label} ({neg.terms.length} sentences)
                      </div>
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-20 w-[340px] max-h-[200px] overflow-y-auto bg-card border border-parchment-dark shadow-editorial-lg rounded-sm p-2">
                        <ul className="space-y-1">
                          {neg.terms.map((t, i) => (
                            <li key={i} className="font-sans text-[10px] text-slate leading-snug">&ldquo;{t}&rdquo;</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="group relative flex-1">
                      <div className="font-sans text-[9px] text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                        {pos.label} ({pos.terms.length} sentences)
                      </div>
                      <div className="hidden group-hover:block absolute bottom-full right-0 mb-1 z-20 w-[340px] max-h-[200px] overflow-y-auto bg-card border border-parchment-dark shadow-editorial-lg rounded-sm p-2">
                        <ul className="space-y-1">
                          {pos.terms.map((t, i) => (
                            <li key={i} className="font-sans text-[10px] text-slate leading-snug">&ldquo;{t}&rdquo;</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
            <BenchmarkLoader
              label="Benchmark"
              onLoad={concepts => plotConcepts(concepts)}
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
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(plottedConcepts.map(p => p.concept))].map(concept => (
                  <span
                    key={concept}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-sm font-sans text-body-sm group"
                  >
                    {concept}
                    <button
                      onClick={() => setPlottedConcepts(prev => prev.filter(p => p.concept !== concept))}
                      className="text-muted-foreground hover:text-error-500 transition-colors opacity-50 group-hover:opacity-100"
                      title={`Remove ${concept}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="font-sans text-caption text-muted-foreground">
                  {new Set(plottedConcepts.map(p => p.concept)).size} plotted. Click &times; to remove.
                </p>
                <span className="font-sans text-caption text-muted-foreground">
                  +/− on chart to zoom
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleAddConcept} />}

      {/* Empty compass preview when no data yet */}
      {plottedConcepts.length === 0 && (
        <div className="card-editorial overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <span className="font-sans text-body-sm font-semibold text-muted-foreground">
              {preset.name} — enter concepts above to plot them
            </span>
          </div>
          <div className="thin-rule mx-5" />
          <div className="px-2 py-2" style={{ background: bgColor }}>
            <PlotlyPlot
              data={[{ x: [], y: [], type: "scatter", mode: "markers" }]}
              layout={(() => {
                const extent = 0.05;
                return {
                  height: 520,
                  margin: { t: 40, r: 60, b: 60, l: 60 },
                  paper_bgcolor: bgColor,
                  plot_bgcolor: bgColor,
                  xaxis: { zeroline: true, zerolinecolor: isDark ? "rgba(200,200,220,0.6)" : "rgba(30,30,30,0.7)", zerolinewidth: 2, showgrid: true, gridcolor: gridColor, showticklabels: false, range: [-extent, extent] },
                  yaxis: { zeroline: true, zerolinecolor: isDark ? "rgba(200,200,220,0.6)" : "rgba(30,30,30,0.7)", zerolinewidth: 2, showgrid: true, gridcolor: gridColor, showticklabels: false, range: [-extent, extent], scaleanchor: "x" },
                  showlegend: false,
                  dragmode: "pan",
                  annotations: [
                    { xref: "paper", yref: "paper", x: 1, y: 0.5, text: `<b>${preset.xAxis.positive.label}</b> →`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "right", yanchor: "top", yshift: -8 },
                    { xref: "paper", yref: "paper", x: 0, y: 0.5, text: `← <b>${preset.xAxis.negative.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "top", yshift: -8 },
                    { xref: "paper", yref: "paper", x: 0.5, y: 1, text: `↑ <b>${preset.yAxis.positive.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "bottom", xshift: 8 },
                    { xref: "paper", yref: "paper", x: 0.5, y: 0, text: `↓ <b>${preset.yAxis.negative.label}</b>`, showarrow: false, font: { size: 11, color: textColor }, xanchor: "left", yanchor: "top", xshift: 8 },
                  ],
                  shapes: [
                    { type: "rect", x0: -10, x1: 0, y0: 0, y1: 10, fillcolor: isDark ? "rgba(220,80,80,0.12)" : "rgba(220,80,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: 10, y0: 0, y1: 10, fillcolor: isDark ? "rgba(80,120,220,0.12)" : "rgba(80,120,220,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: -10, x1: 0, y0: -10, y1: 0, fillcolor: isDark ? "rgba(80,200,80,0.12)" : "rgba(80,200,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: 10, y0: -10, y1: 0, fillcolor: isDark ? "rgba(160,80,200,0.12)" : "rgba(160,80,200,0.15)", line: { width: 0 }, layer: "below" },
                  ],
                };
              })()}
              config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
              style={{ width: "100%", height: "520px" }}
            />
          </div>
        </div>
      )}

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
              <button
                onClick={() => {
                  setZoomOverride(null);
                  setRecentreKey(k => k + 1);
                }}
                className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center shadow-editorial"
                title="Recentre — reset any pan/zoom, fit all plotted concepts"
              >
                ⌂
              </button>
            </div>
            <PlotlyPlot
              key={`${modelId}-${recentreKey}`}
              data={[
                {
                  x: points.map(p => p.x),
                  y: points.map(p => p.y),
                  text: points.map(p => p.concept),
                  hovertext: (() => {
                    const maxAbsX = Math.max(0.001, ...points.map(p => Math.abs(p.x)));
                    const maxAbsY = Math.max(0.001, ...points.map(p => Math.abs(p.y)));
                    return points.map(p => {
                      const normX = p.x / maxAbsX;
                      const normY = p.y / maxAbsY;
                      const xLean = p.x >= 0 ? preset.xAxis.positive.label : preset.xAxis.negative.label;
                      const yLean = p.y >= 0 ? preset.yAxis.positive.label : preset.yAxis.negative.label;
                      return `<b>${p.concept}</b>  —  <i>${p.modelName}</i>` +
                        `<br>` +
                        `<br><b>${preset.xAxis.negative.label} ↔ ${preset.xAxis.positive.label}</b>` +
                        `<br>&nbsp;&nbsp;position: ${normX >= 0 ? "+" : ""}${normX.toFixed(2)} norm &nbsp;|&nbsp; ${p.x >= 0 ? "+" : ""}${p.x.toFixed(4)} raw` +
                        `<br>&nbsp;&nbsp;cos → ${preset.xAxis.negative.label}: ${p.simXNeg.toFixed(4)}` +
                        `<br>&nbsp;&nbsp;cos → ${preset.xAxis.positive.label}: ${p.simXPos.toFixed(4)}` +
                        `<br>&nbsp;&nbsp;pull: ${Math.abs(p.x).toFixed(4)} toward ${xLean}` +
                        `<br>` +
                        `<br><b>${preset.yAxis.negative.label} ↔ ${preset.yAxis.positive.label}</b>` +
                        `<br>&nbsp;&nbsp;position: ${normY >= 0 ? "+" : ""}${normY.toFixed(2)} norm &nbsp;|&nbsp; ${p.y >= 0 ? "+" : ""}${p.y.toFixed(4)} raw` +
                        `<br>&nbsp;&nbsp;cos → ${preset.yAxis.negative.label}: ${p.simYNeg.toFixed(4)}` +
                        `<br>&nbsp;&nbsp;cos → ${preset.yAxis.positive.label}: ${p.simYPos.toFixed(4)}` +
                        `<br>&nbsp;&nbsp;pull: ${Math.abs(p.y).toFixed(4)} toward ${yLean}`;
                    });
                  })(),
                  hoverinfo: "text",
                  mode: "markers+text",
                  type: "scatter",
                  textposition: "top center",
                  textfont: { size: 12, family: "Inter, system-ui, sans-serif", color: textColor },
                  marker: {
                    size: 12,
                    color: isDark ? "rgba(210,160,60,0.9)" : "rgba(160,110,20,0.9)",
                    line: { color: isDark ? "rgba(210,160,60,0.3)" : "rgba(160,110,20,0.3)", width: 2 },
                  },
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
                  dragmode: "pan",
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
                    { type: "rect", x0: -10, x1: 0, y0: 0, y1: 10, fillcolor: isDark ? "rgba(220,80,80,0.12)" : "rgba(220,80,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: 10, y0: 0, y1: 10, fillcolor: isDark ? "rgba(80,120,220,0.12)" : "rgba(80,120,220,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: -10, x1: 0, y0: -10, y1: 0, fillcolor: isDark ? "rgba(80,200,80,0.12)" : "rgba(80,200,80,0.15)", line: { width: 0 }, layer: "below" },
                    { type: "rect", x0: 0, x1: 10, y0: -10, y1: 0, fillcolor: isDark ? "rgba(160,80,200,0.12)" : "rgba(160,80,200,0.15)", line: { width: 0 }, layer: "below" },
                  ],
                };
              })()}
              config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
              style={{ width: "100%", height: "500px" }}
            />
          </div>
          <div className="thin-rule mx-5" />

          {/* Explanation */}
          <div className="px-5 py-5">
            <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              How to Read This Diagram
            </h4>
            <div className="space-y-2 font-body text-body-sm text-slate leading-relaxed">
              <p>
                Each concept is embedded into a high-dimensional vector (typically 768 to 3,072 dimensions).
                The compass reduces this to two dimensions, but unlike the Neighbourhood Map (which uses
                statistical methods like PCA or UMAP to find axes automatically), here <em>you define
                what the axes mean</em> by providing clusters of terms for each pole. The result is a
                projection where both axes are conceptually interpretable, not just mathematically optimal.
              </p>
              <p>
                <strong>Pole definitions use full sentences, not single words.</strong> Each pole is defined
                by 8-9 sentences that express clear ideological positions (e.g. &ldquo;The free market is the
                most efficient mechanism for allocating resources&rdquo; rather than just &ldquo;free market&rdquo;).
                Embedding models are trained on sentence-level pairs, so sentences produce sharper, more
                precisely situated vectors than bare terms. You can hover over the axis labels above to see
                the exact sentences defining each pole.
              </p>
              <p>
                <strong>How the axes work:</strong> Each axis is defined by two opposing clusters of sentences
                (e.g. &ldquo;{preset.xAxis.negative.label}&rdquo; vs &ldquo;{preset.xAxis.positive.label}&rdquo;).
                For each concept, we compute its average cosine similarity to every term in both clusters.
                The concept&apos;s position on that axis is the <em>difference</em> between these two averages:
                if it is more similar to the right-hand cluster, it sits to the right; if more similar to
                the left-hand cluster, it sits to the left.
              </p>
              <p>
                <strong>What the position means:</strong> A concept at the centre of an axis is equidistant
                from both poles, meaning the manifold does not associate it more strongly with either cluster.
                A concept far from centre has been pulled toward one pole, meaning the manifold has
                <em> naturalised</em> that ideological framing as the concept&apos;s default association.
                This is the geometric signature of hegemony: not a claim, but a tilt.
              </p>
              <p>
                <strong>What the quadrant colours mean:</strong> The four coloured regions correspond to
                the four combinations of the two axes. A concept in the top-right quadrant, for example,
                is closer to both the right-hand pole of the x-axis and the upper pole of the y-axis.
                The quadrants make it easy to see at a glance which ideological region each concept
                occupies in this model&apos;s geometry.
              </p>
              <p>
                <strong>Why the values are small:</strong> Cosine similarity differences between
                ideological clusters are typically small (0.01 to 0.05) because most of the
                embedding&apos;s dimensions encode general semantic content, not political orientation.
                The signal is real but subtle, which is precisely the point: ideological positioning
                in the manifold operates at the margin, not at the centre of the geometry. The compass
                auto-zooms to make these small differences visible.
              </p>
              <p>
                <strong>Limitations:</strong> The axes are defined by the cluster terms chosen, not
                by the model itself. Different term choices would produce different axes. The compass
                does not reveal the manifold&apos;s &ldquo;true&rdquo; political structure (if such a
                thing exists) but rather measures association relative to the ideological vocabulary
                you provide. This is a feature, not a bug: it lets you test specific theoretical
                hypotheses about which framings the geometry has absorbed.
              </p>
            </div>
          </div>

          <div className="thin-rule mx-5" />

          {/* Technical Dashboard toggle */}
          <div className="px-5 py-3">
            <button
              onClick={() => setDashboardOpen(!dashboardOpen)}
              className="flex items-center gap-1.5 font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors"
            >
              {dashboardOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Technical Dashboard
            </button>
          </div>

          {dashboardOpen && (
            <div className="px-5 pb-5 space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-sm p-2.5">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Concepts Plotted</div>
                  <div className="font-sans text-body-sm font-bold mt-0.5">{points.length}</div>
                </div>
                <div className="bg-muted rounded-sm p-2.5">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">X-axis Range</div>
                  <div className="font-sans text-body-sm font-bold mt-0.5 tabular-nums">
                    {Math.min(...points.map(p => p.x)).toFixed(4)} to {Math.max(...points.map(p => p.x)).toFixed(4)}
                  </div>
                </div>
                <div className="bg-muted rounded-sm p-2.5">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Y-axis Range</div>
                  <div className="font-sans text-body-sm font-bold mt-0.5 tabular-nums">
                    {Math.min(...points.map(p => p.y)).toFixed(4)} to {Math.max(...points.map(p => p.y)).toFixed(4)}
                  </div>
                </div>
                <div className="bg-muted rounded-sm p-2.5">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Axis Terms</div>
                  <div className="font-sans text-body-sm font-bold mt-0.5">
                    {preset.xAxis.negative.terms.length + preset.xAxis.positive.terms.length + preset.yAxis.negative.terms.length + preset.yAxis.positive.terms.length}
                  </div>
                </div>
              </div>

              {/* Per-concept table with normalised values */}
              {(() => {
                // Normalise: scale so the most extreme value on each axis maps to ±1.0
                const maxAbsX = Math.max(0.001, ...points.map(p => Math.abs(p.x)));
                const maxAbsY = Math.max(0.001, ...points.map(p => Math.abs(p.y)));

                return (
                  <div>
                    <p className="font-sans text-caption text-muted-foreground mb-2 italic">
                      Normalised values (bold) scale positions to ±1.0 where 1.0 is the most extreme
                      concept on that axis. Raw cosine similarity differences shown alongside in grey.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full font-sans text-body-sm">
                        <thead>
                          <tr className="border-b border-parchment">
                            <th className="text-left px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Concept</th>
                            <th className="text-right px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">X position</th>
                            <th className="text-right px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Y position</th>
                            <th className="text-left px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Quadrant</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-parchment">
                          {points.map((p, i) => {
                            const normX = p.x / maxAbsX;
                            const normY = p.y / maxAbsY;
                            const quadrant =
                              p.x >= 0 && p.y >= 0 ? `${preset.xAxis.positive.label} / ${preset.yAxis.positive.label}` :
                              p.x < 0 && p.y >= 0 ? `${preset.xAxis.negative.label} / ${preset.yAxis.positive.label}` :
                              p.x >= 0 && p.y < 0 ? `${preset.xAxis.positive.label} / ${preset.yAxis.negative.label}` :
                              `${preset.xAxis.negative.label} / ${preset.yAxis.negative.label}`;
                            return (
                              <tr key={i} className="hover:bg-cream/30 transition-colors">
                                <td className="px-2 py-1.5 font-medium">{p.concept}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className="tabular-nums font-semibold" style={{ color: normX >= 0 ? "#3b82f6" : "#ef4444" }}>
                                    {normX >= 0 ? "+" : ""}{normX.toFixed(2)}
                                  </span>
                                  <span className="tabular-nums text-caption text-muted-foreground ml-1.5">
                                    ({p.x >= 0 ? "+" : ""}{p.x.toFixed(4)})
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className="tabular-nums font-semibold" style={{ color: normY >= 0 ? "#3b82f6" : "#ef4444" }}>
                                    {normY >= 0 ? "+" : ""}{normY.toFixed(2)}
                                  </span>
                                  <span className="tabular-nums text-caption text-muted-foreground ml-1.5">
                                    ({p.y >= 0 ? "+" : ""}{p.y.toFixed(4)})
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-caption">{quadrant}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Detailed pole similarities (collapsible) */}
              <details className="mt-3">
                <summary className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold cursor-pointer hover:text-foreground transition-colors">
                  Raw Pole Similarities
                </summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full font-sans text-caption">
                    <thead>
                      <tr className="border-b border-parchment">
                        <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Concept</th>
                        <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">→ {preset.xAxis.negative.label}</th>
                        <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">→ {preset.xAxis.positive.label}</th>
                        <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">→ {preset.yAxis.negative.label}</th>
                        <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">→ {preset.yAxis.positive.label}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-parchment">
                      {points.map((p, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1">{p.concept}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.simXNeg.toFixed(4)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.simXPos.toFixed(4)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.simYNeg.toFixed(4)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.simYPos.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Pole definitions: per-pole sentence list + coherence/norm stats */}
              <div>
                <h4 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Pole Definitions
                </h4>
                {(() => {
                  const stats = axisStats.find(a => a.modelId === modelId);
                  const renderPole = (
                    p: { label: string; terms: string[] },
                    axisTag: string,
                    s: PoleStats | undefined
                  ) => (
                    <div className="bg-muted rounded-sm p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="font-sans text-[10px] uppercase tracking-wider font-semibold">
                          <span className="text-foreground">{p.label}</span>
                          <span className="text-muted-foreground ml-2">{axisTag} &middot; {p.terms.length} sentences</span>
                        </div>
                        {s && (
                          <div className="font-sans text-[10px] text-muted-foreground tabular-nums">
                            <span
                              title="Mean pairwise cosine among this pole's defining sentences. Higher = the pole's definition is internally coherent; lower = the sentences pull in different directions."
                              className="cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                            >
                              coherence {Number.isFinite(s.coherence) ? s.coherence.toFixed(3) : "—"}
                            </span>
                            <span className="mx-2">|</span>
                            <span
                              title="L2 norm of the pole's centroid (mean) vector."
                              className="cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                            >
                              ‖centroid‖ {s.centroidNorm.toFixed(3)}
                            </span>
                          </div>
                        )}
                      </div>
                      <ul className="font-sans text-caption text-muted-foreground space-y-0.5 list-disc pl-5">
                        {p.terms.map((t, i) => (
                          <li key={i} className="leading-snug">{t}</li>
                        ))}
                      </ul>
                    </div>
                  );
                  return (
                    <div className="space-y-3">
                      {/* Axis-level summary table */}
                      {stats && (
                        <div className="overflow-x-auto">
                          <table className="w-full font-sans text-caption">
                            <thead>
                              <tr className="border-b border-parchment">
                                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Axis</th>
                                <th
                                  className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                                  title="Cosine similarity between the two pole centroids. High = the poles point in similar directions, so the manifold doesn't treat them as opposed. Low = the poles are genuinely distinct in the geometry."
                                >
                                  Inter-pole cos
                                </th>
                                <th
                                  className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                                  title="Euclidean distance between the two pole centroids in embedding space. A measure of how far apart the poles sit."
                                >
                                  Axis norm
                                </th>
                                <th
                                  className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                                  title="Embedding dimensions for this model."
                                >
                                  Dims
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-parchment">
                              <tr>
                                <td className="px-2 py-1">
                                  <span className="font-medium">{stats.xNeg.label}</span>
                                  <span className="text-muted-foreground"> ↔ </span>
                                  <span className="font-medium">{stats.xPos.label}</span>
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.xInterPoleCosine.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.xAxisNorm.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.dimensions}</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1">
                                  <span className="font-medium">{stats.yNeg.label}</span>
                                  <span className="text-muted-foreground"> ↔ </span>
                                  <span className="font-medium">{stats.yPos.label}</span>
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.yInterPoleCosine.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.yAxisNorm.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{stats.dimensions}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Per-pole cards with full sentence list + coherence/norm */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderPole(preset.xAxis.negative, "X−", stats?.xNeg)}
                        {renderPole(preset.xAxis.positive, "X+", stats?.xPos)}
                        {renderPole(preset.yAxis.negative, "Y−", stats?.yNeg)}
                        {renderPole(preset.yAxis.positive, "Y+", stats?.yPos)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Export */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const rows = ["concept,sim_x_neg,sim_x_pos,x_position,sim_y_neg,sim_y_pos,y_position,quadrant"];
                    for (const p of points) {
                      const q = p.x >= 0 && p.y >= 0 ? "top-right" : p.x < 0 && p.y >= 0 ? "top-left" : p.x >= 0 && p.y < 0 ? "bottom-right" : "bottom-left";
                      rows.push(`"${p.concept}",${p.simXNeg.toFixed(6)},${p.simXPos.toFixed(6)},${p.x.toFixed(6)},${p.simYNeg.toFixed(6)},${p.simYPos.toFixed(6)},${p.y.toFixed(6)},${q}`);
                    }
                    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `hegemony-compass-${modelName}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-editorial-ghost text-caption px-3 py-1.5"
                >
                  <Download size={14} className="mr-1" />
                  Export CSV
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

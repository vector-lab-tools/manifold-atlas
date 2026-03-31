"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Play, Pause, Camera } from "lucide-react";
import type { NeighbourhoodPoint } from "@/types/embeddings";
import type { PlotlyPlotHandle } from "./PlotlyPlot";
import { AnalysisPanel } from "./AnalysisPanel";
import { useSettings } from "@/context/SettingsContext";

const PlotlyPlot = dynamic(
  () => import("./PlotlyPlot").then(mod => ({ default: mod.PlotlyPlot })),
  { ssr: false, loading: () => <div className="h-[550px] flex items-center justify-center bg-card text-slate text-body-sm rounded-sm">Loading manifold...</div> }
);

// Cluster colours for dark and light modes
const CLUSTER_COLORS_DARK = [
  { marker: "rgba(210, 160, 60, 0.9)", line: "rgba(210, 160, 60, 0.15)", glow: "rgba(210, 160, 60, 0.3)", name: "gold" },
  { marker: "rgba(120, 160, 255, 0.9)", line: "rgba(120, 160, 255, 0.15)", glow: "rgba(120, 160, 255, 0.3)", name: "blue" },
  { marker: "rgba(200, 100, 180, 0.9)", line: "rgba(200, 100, 180, 0.15)", glow: "rgba(200, 100, 180, 0.3)", name: "rose" },
  { marker: "rgba(100, 220, 180, 0.9)", line: "rgba(100, 220, 180, 0.15)", glow: "rgba(100, 220, 180, 0.3)", name: "teal" },
  { marker: "rgba(255, 140, 80, 0.9)", line: "rgba(255, 140, 80, 0.15)", glow: "rgba(255, 140, 80, 0.3)", name: "amber" },
];

const CLUSTER_COLORS_LIGHT = [
  { marker: "rgba(160, 110, 20, 0.9)", line: "rgba(160, 110, 20, 0.12)", glow: "rgba(160, 110, 20, 0.25)", name: "gold" },
  { marker: "rgba(50, 90, 200, 0.9)", line: "rgba(50, 90, 200, 0.12)", glow: "rgba(50, 90, 200, 0.25)", name: "blue" },
  { marker: "rgba(160, 50, 130, 0.9)", line: "rgba(160, 50, 130, 0.12)", glow: "rgba(160, 50, 130, 0.25)", name: "rose" },
  { marker: "rgba(20, 150, 120, 0.9)", line: "rgba(20, 150, 120, 0.12)", glow: "rgba(20, 150, 120, 0.25)", name: "teal" },
  { marker: "rgba(200, 90, 30, 0.9)", line: "rgba(200, 90, 30, 0.12)", glow: "rgba(200, 90, 30, 0.25)", name: "amber" },
];

interface ScatterPlotProps {
  modelName: string;
  providerId: string;
  points: NeighbourhoodPoint[];
  method: "pca" | "umap";
  dimensions: 2 | 3;
  clusterAssignments?: number[];
  edges?: [number, number][];
  vectors?: number[][];
  modelId?: string;
  groupNames?: string[];
}

export function ScatterPlot({ modelName, providerId, points, method, dimensions, clusterAssignments, edges, vectors, modelId, groupNames }: ScatterPlotProps) {
  const { settings } = useSettings();
  const isDark = settings.darkMode;

  const [rotating, setRotating] = useState(false);
  const plotRef = useRef<PlotlyPlotHandle>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const startRotation = useCallback(() => {
    const step = () => {
      const plotHandle = plotRef.current;
      if (!plotHandle) { rafRef.current = requestAnimationFrame(step); return; }
      const div = plotHandle.getDiv();
      const Plotly = plotHandle.getPlotly();
      if (!div || !Plotly) { rafRef.current = requestAnimationFrame(step); return; }

      angleRef.current += 0.3;
      const radians = (angleRef.current * Math.PI) / 180;
      const r = 2.2;

      Plotly.relayout(div, {
        "scene.camera.eye": {
          x: r * Math.cos(radians),
          y: r * Math.sin(radians),
          z: 0.6 + 0.3 * Math.sin(radians * 0.3),
        },
      });

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const stopRotation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (rotating) startRotation();
    else stopRotation();
    return stopRotation;
  }, [rotating, startRotation, stopRotation]);

  const handleExportPNG = useCallback(() => {
    const plotHandle = plotRef.current;
    if (!plotHandle) return;
    const div = plotHandle.getDiv();
    const Plotly = plotHandle.getPlotly();
    if (!div || !Plotly) return;
    Plotly.downloadImage(div, {
      format: "png",
      width: 1920,
      height: 1080,
      filename: `manifold-atlas-${modelId || "plot"}`,
      scale: 2,
    });
  }, [modelId]);

  // Build 3D traces with clusters and edges
  const traces3D = useMemo(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const traces: any[] = [];
    const clusters = clusterAssignments || points.map(() => 0);
    const uniqueClusters = [...new Set(clusters)];
    const colors = isDark ? CLUSTER_COLORS_DARK : CLUSTER_COLORS_LIGHT;

    // Edge traces (connection mesh)
    if (edges && edges.length > 0) {
      // Group edges by cluster pair for colouring
      const edgesByColor = new Map<string, { x: number[]; y: number[]; z: number[] }>();

      for (const [i, j] of edges) {
        const ci = clusters[i];
        const colorKey = ci < colors.length ? colors[ci].line : "rgba(100,100,100,0.1)";

        if (!edgesByColor.has(colorKey)) {
          edgesByColor.set(colorKey, { x: [], y: [], z: [] });
        }
        const e = edgesByColor.get(colorKey)!;
        e.x.push(points[i].x, points[j].x, NaN);
        e.y.push(points[i].y, points[j].y, NaN);
        e.z.push(points[i].z ?? 0, points[j].z ?? 0, NaN);
      }

      for (const [color, coords] of edgesByColor) {
        traces.push({
          x: coords.x,
          y: coords.y,
          z: coords.z,
          mode: "lines",
          type: "scatter3d",
          line: { color, width: 1.5 },
          hoverinfo: "skip",
          showlegend: false,
        });
      }
    }

    // Large dataset mode: labels on hover only
    const isLarge = points.length > 40;
    const textMode = isLarge ? "markers" : "markers+text";
    const markerSize = isLarge ? 4 : 7;
    const seedMarkerSize = isLarge ? 8 : 14;
    const textSize = isLarge ? 11 : 14;

    // Point traces per cluster (regular + seed points, coloured by cluster)
    for (const clusterId of uniqueClusters) {
      const color = colors[clusterId % colors.length];

      // Regular (non-seed) points
      const regularPoints = points.filter((_, i) => clusters[i] === clusterId && !points[i].isSeed);
      if (regularPoints.length > 0) {
        traces.push({
          x: regularPoints.map(p => p.x),
          y: regularPoints.map(p => p.y),
          z: regularPoints.map(p => p.z ?? 0),
          text: regularPoints.map(p => p.label),
          mode: textMode,
          type: "scatter3d",
          textposition: "top center",
          textfont: { size: textSize, family: "Inter, system-ui, sans-serif", color: color.marker, weight: 400 },
          marker: {
            size: markerSize,
            color: color.marker,
            line: { color: color.glow, width: isLarge ? 0 : 2 },
            opacity: isLarge ? 0.7 : 0.9,
          },
          hoverinfo: "text",
          showlegend: false,
        });
      }

      // Seed points in this cluster (larger diamond, same cluster colour, always labelled)
      const clusterSeeds = points.filter((_, i) => clusters[i] === clusterId && points[i].isSeed);
      if (clusterSeeds.length > 0) {
        traces.push({
          x: clusterSeeds.map(p => p.x),
          y: clusterSeeds.map(p => p.y),
          z: clusterSeeds.map(p => p.z ?? 0),
          text: clusterSeeds.map(p => p.label),
          mode: "markers+text",
          type: "scatter3d",
          textposition: "top center",
          textfont: { size: 14, family: "Inter, system-ui, sans-serif", color: color.marker, weight: 700 },
          marker: {
            size: seedMarkerSize,
            color: color.marker,
            symbol: "diamond",
            line: { color: color.glow, width: 3 },
          },
          hoverinfo: "text",
          showlegend: false,
        });
      }
    }

    return traces;
  }, [points, clusterAssignments, edges, isDark]);

  // Theme-aware layout
  const bgColor = isDark ? "#0a0a1a" : "#f5f2ec";
  const gridColor = isDark ? "rgba(60,60,100,0.3)" : "rgba(140,130,110,0.35)";

  const layout3D = useMemo(() => ({
    height: 550,
    margin: { t: 0, r: 0, b: 0, l: 0 },
    paper_bgcolor: bgColor,
    scene: {
      bgcolor: bgColor,
      xaxis: {
        showgrid: true,
        gridcolor: gridColor,
        zeroline: false,
        showticklabels: false,
        title: { text: "" },
        showspikes: false,
      },
      yaxis: {
        showgrid: true,
        gridcolor: gridColor,
        zeroline: false,
        showticklabels: false,
        title: { text: "" },
        showspikes: false,
      },
      zaxis: {
        showgrid: true,
        gridcolor: gridColor,
        zeroline: false,
        showticklabels: false,
        title: { text: "" },
        showspikes: false,
      },
      camera: { eye: { x: 1.8, y: 1.8, z: 1.0 } },
    },
    showlegend: false,
  }), [bgColor, gridColor]);

  if (dimensions === 3) {
    return (
      <div className="rounded-sm overflow-hidden border border-parchment" style={{ background: bgColor }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="font-sans text-body-sm font-medium text-foreground">{modelName}</span>
            <span className="font-sans text-caption text-muted-foreground">{providerId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRotating(r => !r)}
              className="flex items-center gap-1 px-2 py-1 rounded-sm text-caption text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              title={rotating ? "Pause rotation" : "Auto-rotate"}
            >
              {rotating ? <Pause size={13} /> : <Play size={13} />}
              <span>{rotating ? "Pause" : "Rotate"}</span>
            </button>
            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1 px-2 py-1 rounded-sm text-caption text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              title="Export as PNG"
            >
              <Camera size={13} />
              <span>Export</span>
            </button>
            <span className="font-sans text-caption text-muted-foreground uppercase">{method} 3D</span>
          </div>
        </div>
        <PlotlyPlot
          ref={plotRef}
          data={traces3D}
          layout={layout3D}
          config={{
            displayModeBar: false,
            responsive: true,
            scrollZoom: true,
          }}
          style={{ width: "100%", height: "550px" }}
        />
        {/* Legend and key */}
        <div className="px-4 pb-3 pt-1 space-y-2">
          {/* Interaction hint */}
          <p className="font-sans text-caption text-muted-foreground text-center italic">
            Drag to rotate. Scroll to zoom. Right-drag to pan.
          </p>

          {/* Visual key */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 justify-center text-[11px] text-muted-foreground font-sans">
            {/* Cluster colours with seed indicator */}
            {clusterAssignments && [...new Set(clusterAssignments)].map(cId => {
              const legendColors = isDark ? CLUSTER_COLORS_DARK : CLUSTER_COLORS_LIGHT;
              const color = legendColors[cId % legendColors.length];
              return (
                <span key={cId} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: color.marker }}
                  />
                  <span
                    className="inline-block w-2.5 h-2.5 rotate-45 -ml-1"
                    style={{ backgroundColor: color.marker }}
                  />
                  <span>Sub-manifold {cId + 1}</span>
                </span>
              );
            })}

            {/* Connection lines */}
            {edges && edges.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-muted-foreground border-dashed" />
                <span>Connection (cosine sim &ge; 0.6)</span>
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center text-[10px] text-gray-600 font-sans">
            <span>{points.length} concepts embedded</span>
            <span>&middot;</span>
            <span>{edges?.length ?? 0} connections</span>
            <span>&middot;</span>
            <span>{clusterAssignments ? new Set(clusterAssignments).size : 1} cluster{(clusterAssignments ? new Set(clusterAssignments).size : 1) !== 1 ? "s" : ""} detected</span>
            <span>&middot;</span>
            <span>Projection: {method.toUpperCase()} to 3 dimensions</span>
          </div>
        </div>

        {/* Analysis panel */}
        {vectors && clusterAssignments && edges && (
          <AnalysisPanel
            points={points}
            clusterAssignments={clusterAssignments}
            edges={edges}
            vectors={vectors}
            modelId={modelId || "unknown"}
            groupNames={groupNames}
          />
        )}
      </div>
    );
  }

  // 2D fallback
  const seedPts = points.filter(p => p.isSeed);
  const otherPts = points.filter(p => !p.isSeed);

  return (
    <div className="card-editorial p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-sans text-body-sm font-medium">{modelName}</span>
          <span className="font-sans text-caption text-slate">{providerId}</span>
        </div>
        <span className="font-sans text-caption text-slate uppercase">{method} 2D</span>
      </div>
      <PlotlyPlot
        data={[
          {
            x: otherPts.map(p => p.x), y: otherPts.map(p => p.y),
            text: otherPts.map(p => p.label),
            mode: "markers+text", type: "scatter",
            textposition: "top center",
            textfont: { size: 10, family: "Inter, system-ui, sans-serif" },
            marker: { size: 8, color: "hsl(352, 47%, 33%)", opacity: 0.7 },
          },
          {
            x: seedPts.map(p => p.x), y: seedPts.map(p => p.y),
            text: seedPts.map(p => p.label),
            mode: "markers+text", type: "scatter",
            textposition: "top center",
            textfont: { size: 12, family: "Inter, system-ui, sans-serif", color: "hsl(43, 85%, 38%)" },
            marker: { size: 14, color: "hsl(43, 85%, 38%)", symbol: "diamond" },
          },
        ]}
        layout={{
          height: 350,
          margin: { t: 10, r: 20, b: 30, l: 30 },
          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: { showgrid: true, gridcolor: "hsl(40, 24%, 89%)", zeroline: false, showticklabels: false },
          yaxis: { showgrid: true, gridcolor: "hsl(40, 24%, 89%)", zeroline: false, showticklabels: false },
          showlegend: false, hovermode: "closest",
        }}
        config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
        style={{ width: "100%", height: "350px" }}
      />
    </div>
  );
}

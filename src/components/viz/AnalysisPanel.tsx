"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import { useSettings } from "@/context/SettingsContext";
import { SimilarityBridge } from "./SimilarityBridge";
import type { NeighbourhoodPoint } from "@/types/embeddings";

interface AnalysisPanelProps {
  points: NeighbourhoodPoint[];
  clusterAssignments: number[];
  edges: [number, number][];
  vectors: number[][];
  modelId: string;
  groupNames?: string[];
}

interface BorderConcept {
  concept: string;
  fromCluster: number;
  nearestConcept: string;
  nearestCluster: number;
  distance: number;
}

interface Bridge {
  conceptA: string;
  clusterA: number;
  conceptB: string;
  clusterB: number;
  similarity: number;
}

function similarityLabel(similarity: number): { text: string; color: string; barColor: string } {
  if (similarity >= 0.85) return { text: "geometrically collapsed: the manifold barely distinguishes these domains", color: "text-red-400", barColor: "#ef4444" };
  if (similarity >= 0.7) return { text: "high overlap: the manifold treats these domains as closely related", color: "text-orange-400", barColor: "#f97316" };
  if (similarity >= 0.5) return { text: "moderate separation: partially distinct regions", color: "text-yellow-400", barColor: "#eab308" };
  return { text: "well separated: the manifold recognises these as distinct domains", color: "text-green-400", barColor: "#22c55e" };
}

export function AnalysisPanel({ points, clusterAssignments, edges, vectors, modelId, groupNames }: AnalysisPanelProps) {
  const [bordersOpen, setBordersOpen] = useState(false);
  const [bridgesOpen, setBridgesOpen] = useState(false);

  const uniqueClusters = useMemo(() => [...new Set(clusterAssignments)], [clusterAssignments]);
  const hasMultipleClusters = uniqueClusters.length >= 2;
  // Cross-domain similarity bridges only make sense when the user
  // explicitly named two or more domains. With a single named group,
  // any auto-detected sub-clusters inside it are sub-divisions of the
  // *same* domain, not different ones — pairing them with "well
  // separated: distinct domains" verdicts is wrong. Border Concepts
  // and Bridges still surface useful internal structure, so they
  // stay; only the cross-domain bridges are gated.
  const namedGroupCount = groupNames?.filter(n => n.trim().length > 0).length ?? 0;
  const showCrossDomainBridges = namedGroupCount >= 2;

  // Pairwise cluster similarities
  const clusterPairs = useMemo(() => {
    if (!hasMultipleClusters) return [];

    const pairs: Array<{ clusterA: number; clusterB: number; nameA: string; nameB: string; similarity: number }> = [];

    for (let a = 0; a < uniqueClusters.length; a++) {
      for (let b = a + 1; b < uniqueClusters.length; b++) {
        const cA = uniqueClusters[a];
        const cB = uniqueClusters[b];
        let totalSim = 0;
        let count = 0;

        for (let i = 0; i < vectors.length; i++) {
          for (let j = i + 1; j < vectors.length; j++) {
            if (
              (clusterAssignments[i] === cA && clusterAssignments[j] === cB) ||
              (clusterAssignments[i] === cB && clusterAssignments[j] === cA)
            ) {
              totalSim += cosineSimilarity(vectors[i], vectors[j]);
              count++;
            }
          }
        }

        const sim = count > 0 ? totalSim / count : 0;
        const nameA = groupNames?.[cA] || `Group ${cA + 1}`;
        const nameB = groupNames?.[cB] || `Group ${cB + 1}`;
        pairs.push({ clusterA: cA, clusterB: cB, nameA, nameB, similarity: sim });
      }
    }

    return pairs;
  }, [vectors, clusterAssignments, hasMultipleClusters, uniqueClusters, groupNames]);

  // Border concepts: for each point, find the nearest point in a different cluster
  const borderConcepts = useMemo(() => {
    if (!hasMultipleClusters) return [];

    const borders: BorderConcept[] = [];

    for (let i = 0; i < vectors.length; i++) {
      let nearestIdx = -1;
      let nearestDist = Infinity;

      for (let j = 0; j < vectors.length; j++) {
        if (i === j || clusterAssignments[i] === clusterAssignments[j]) continue;
        const dist = 1 - cosineSimilarity(vectors[i], vectors[j]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = j;
        }
      }

      if (nearestIdx >= 0) {
        borders.push({
          concept: points[i].label,
          fromCluster: clusterAssignments[i],
          nearestConcept: points[nearestIdx].label,
          nearestCluster: clusterAssignments[nearestIdx],
          distance: nearestDist,
        });
      }
    }

    // Sort by distance ascending (closest to the border first)
    borders.sort((a, b) => a.distance - b.distance);
    return borders.slice(0, 8);
  }, [vectors, points, clusterAssignments, hasMultipleClusters]);

  // Bridges: cross-cluster connections from the edge list
  const bridges = useMemo(() => {
    if (!hasMultipleClusters) return [];

    const crossEdges: Bridge[] = [];
    for (const [i, j] of edges) {
      if (clusterAssignments[i] !== clusterAssignments[j]) {
        crossEdges.push({
          conceptA: points[i].label,
          clusterA: clusterAssignments[i],
          conceptB: points[j].label,
          clusterB: clusterAssignments[j],
          similarity: cosineSimilarity(vectors[i], vectors[j]),
        });
      }
    }

    crossEdges.sort((a, b) => b.similarity - a.similarity);
    return crossEdges;
  }, [edges, points, vectors, clusterAssignments, hasMultipleClusters]);

  // Export CSV
  const exportCSV = () => {
    const rows: string[] = [];
    rows.push("concept_a,concept_b,cosine_similarity,cluster_a,cluster_b,is_cross_cluster");

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const sim = cosineSimilarity(vectors[i], vectors[j]);
        const cross = clusterAssignments[i] !== clusterAssignments[j];
        rows.push(
          `"${points[i].label}","${points[j].label}",${sim.toFixed(6)},${clusterAssignments[i]},${clusterAssignments[j]},${cross}`
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifold-atlas-${modelId}-distances.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasMultipleClusters) {
    return (
      <div className="px-4 pb-3">
        <div className="flex justify-end">
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-2 font-sans text-[11px]">
      {/* Cross-domain similarity bridges — only meaningful when the
          user supplied two or more named groups. With one group, the
          auto-detected sub-clusters are intra-domain structure and
          their pairwise similarities don't carry the "distinct
          domains" reading similarityLabel implies. */}
      {showCrossDomainBridges &&
        clusterPairs.map((pair, idx) => {
          const label = similarityLabel(pair.similarity);
          return (
            <div key={idx} className="pt-2 border-t border-border">
              <SimilarityBridge
                nameA={pair.nameA}
                nameB={pair.nameB}
                similarity={pair.similarity}
                subtitle={label.text}
              />
            </div>
          );
        })}

      {/* Single-group note when auto-clustering found internal
          structure but no cross-domain reading applies. */}
      {!showCrossDomainBridges && clusterPairs.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-muted-foreground text-[10px] italic leading-relaxed">
            Only one named group in this run, so no cross-domain
            similarity bridges are shown. The {uniqueClusters.length}{" "}
            auto-detected sub-clusters below are subdivisions of the
            same input domain rather than separate domains. Add a
            second group to compare across domains.
          </p>
        </div>
      )}

      {/* Border concepts */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setBordersOpen(!bordersOpen)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-semibold text-[10px] w-full"
        >
          {bordersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Border Concepts ({borderConcepts.length})
        </button>
        {bordersOpen && (
          <div className="mt-2">
            <p className="text-muted-foreground/70 text-[10px] mb-2 italic">
              Concepts closest to the boundary between sub-manifolds. These are where the geometry&apos;s domain distinctions are thinnest.
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-1 pr-3 font-medium">Concept</th>
                  <th className="pb-1 pr-3 font-medium">Nearest across</th>
                  <th className="pb-1 font-medium text-right">Distance</th>
                </tr>
              </thead>
              <tbody>
                {borderConcepts.map((b, i) => (
                  <tr key={i} className="text-foreground">
                    <td className="py-0.5 pr-3">{b.concept}</td>
                    <td className="py-0.5 pr-3 text-muted-foreground">{b.nearestConcept}</td>
                    <td className="py-0.5 text-right tabular-nums text-muted-foreground">{b.distance.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bridges */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setBridgesOpen(!bridgesOpen)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-semibold text-[10px] w-full"
        >
          {bridgesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Bridges ({bridges.length} cross-group connection{bridges.length !== 1 ? "s" : ""})
        </button>
        {bridgesOpen && (
          <div className="mt-2">
            <p className="text-muted-foreground/70 text-[10px] mb-2 italic">
              Connections that cross between sub-manifolds. These are the geometry&apos;s implicit theory of how domains relate.
            </p>
            {bridges.length === 0 ? (
              <p className="text-muted-foreground text-[10px]">No cross-group connections at current threshold.</p>
            ) : (
              <div className="space-y-1">
                {bridges.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-foreground">
                    <span>{b.conceptA}</span>
                    <span className="text-muted-foreground/70">────</span>
                    <span>{b.conceptB}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">{b.similarity.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="border-t border-border pt-2 flex justify-end">
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>
    </div>
  );
}

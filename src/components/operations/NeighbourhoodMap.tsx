"use client";

import { useState } from "react";
import { Loader2, Plus, X, Zap } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { expandConcept, getExpansionProvider } from "@/lib/expand";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { projectPCA, projectPCA3D } from "@/lib/geometry/pca";
import { projectUMAP, projectUMAP3D } from "@/lib/geometry/umap-wrapper";
import { autoClusters, proximityEdges } from "@/lib/geometry/clusters";
import { ScatterPlot } from "@/components/viz/ScatterPlot";
import { PRESETS, type ConceptGroup } from "@/components/shared/ConceptPresets";
import { ResetButton } from "@/components/shared/ResetButton";
import { BenchmarkLoader } from "@/components/shared/BenchmarkLoader";
import { EMBEDDING_MODELS } from "@/types/embeddings";
import type { NeighbourhoodMapResult, NeighbourhoodPoint } from "@/types/embeddings";
import { DeepDivePanel, DeepDiveSection, DeepDiveStat } from "@/components/shared/DeepDivePanel";

interface ConceptGroupInput {
  id: number;
  name: string;
  terms: string;
}

let nextGroupId = 1;

interface NeighbourhoodMapProps {
  onQueryTime: (time: number) => void;
}

export function NeighbourhoodMap({ onQueryTime }: NeighbourhoodMapProps) {
  const [groups, setGroups] = useState<ConceptGroupInput[]>([
    { id: 0, name: "", terms: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<NeighbourhoodMapResult | null>(null);
  const [projectionMethod, setProjectionMethod] = useState<"pca" | "umap">("pca");
  const [dims, setDims] = useState<2 | 3>(3);
  const [clusterData, setClusterData] = useState<Map<string, number[]>>(new Map());
  const [edgeData, setEdgeData] = useState<Map<string, [number, number][]>>(new Map());
  const [vectorData, setVectorData] = useState<Map<string, number[][]>>(new Map());
  const [currentGroupNames, setCurrentGroupNames] = useState<string[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSeed, setScanSeed] = useState("");
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const addGroup = () => {
    setGroups(prev => [...prev, { id: nextGroupId++, name: "", terms: "" }]);
  };

  const removeGroup = (id: number) => {
    if (groups.length <= 1) return;
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const updateGroup = (id: number, field: "name" | "terms", value: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const loadPreset = (preset: ConceptGroup) => {
    // Check if there's an empty group to fill, otherwise add
    const emptyIdx = groups.findIndex(g => !g.name.trim() && !g.terms.trim());
    if (emptyIdx >= 0) {
      setGroups(prev => prev.map((g, i) =>
        i === emptyIdx
          ? { ...g, name: preset.name, terms: [preset.seed, ...preset.terms].join(", ") }
          : g
      ));
    } else {
      setGroups(prev => [
        ...prev,
        { id: nextGroupId++, name: preset.name, terms: [preset.seed, ...preset.terms].join(", ") },
      ]);
    }
    setShowPresets(false);
  };

  const handleScan = async () => {
    const seed = scanSeed.trim() || groups[0]?.terms.split(/[,\n]/)[0]?.trim() || "justice";
    if (!scanSeed.trim()) setScanSeed(seed);

    const expansionProvider = getExpansionProvider(settings);
    if (!expansionProvider) {
      setError(new Error("No chat-capable provider available for concept expansion. Enable OpenAI, Google, or Ollama in Settings."));
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const result = await expandConcept(
        seed,
        300,
        expansionProvider.provider,
        expansionProvider.model,
        expansionProvider.apiKey,
        expansionProvider.baseUrl
      );

      // Put all terms into a single group and compute immediately
      if (result.allTerms.length > 0) {
        const allTerms = [seed, ...result.allTerms].join(", ");
        const scanGroup: ConceptGroupInput = {
          id: nextGroupId++,
          name: seed,
          terms: allTerms,
        };
        setGroups([scanGroup]);
        setScanning(false);
        // Compute with the scan results directly
        await handleComputeWithGroups([scanGroup]);
        return;
      }
    } catch (e) {
      setError(e);
    } finally {
      setScanning(false);
    }
  };

  const handleComputeWithGroups = async (overrideGroups?: ConceptGroupInput[]) => {
    let effectiveGroups = overrideGroups || groups;
    // If all empty, load default presets
    const allEmpty = effectiveGroups.every(g => !g.terms.trim());
    if (allEmpty) {
      const defaults = [PRESETS[1], PRESETS[2]]; // Philosophy + Carpentry
      const newGroups = defaults.map((p, i) => ({
        id: nextGroupId++,
        name: p.name,
        terms: [p.seed, ...p.terms].join(", "),
      }));
      setGroups(newGroups);
      effectiveGroups = newGroups;
    }

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      // Collect all unique terms across groups
      const allTexts: string[] = [];
      const groupBoundaries: number[] = []; // track which group each term belongs to

      for (const group of effectiveGroups) {
        const terms = group.terms
          .split(/[,\n]/)
          .map(t => t.trim())
          .filter(t => t.length > 0);
        for (const term of terms) {
          if (!allTexts.includes(term)) {
            allTexts.push(term);
            groupBoundaries.push(effectiveGroups.indexOf(group));
          }
        }
      }

      const modelVectors = await embedAll(allTexts);
      const enabledModels = getEnabledModels();

      const newClusters = new Map<string, number[]>();
      const newEdges = new Map<string, [number, number][]>();
      const newVectors = new Map<string, number[][]>();

      const projections = enabledModels
        .filter(m => modelVectors.has(m.id))
        .map(m => {
          const vectors = modelVectors.get(m.id)!;

          // Use the user's group assignments as clusters if multiple groups,
          // otherwise auto-detect
          const clusters = effectiveGroups.length > 1
            ? groupBoundaries
            : autoClusters(vectors);

          const edges = proximityEdges(vectors, 0.6);
          newClusters.set(m.id, clusters);
          newEdges.set(m.id, edges);
          newVectors.set(m.id, vectors);

          let points: NeighbourhoodPoint[];

          if (dims === 3) {
            const coords = projectionMethod === "umap"
              ? projectUMAP3D(vectors)
              : projectPCA3D(vectors);
            points = allTexts.map((label, i) => ({
              label,
              x: coords[i][0],
              y: coords[i][1],
              z: coords[i][2],
              isSeed: false,
            }));
          } else {
            const coords = projectionMethod === "umap"
              ? projectUMAP(vectors)
              : projectPCA(vectors);
            points = allTexts.map((label, i) => ({
              label,
              x: coords[i][0],
              y: coords[i][1],
              isSeed: false,
            }));
          }

          // Mark the first term of each group as seed
          let idx = 0;
          for (const group of effectiveGroups) {
            const terms = group.terms
              .split(/[,\n]/)
              .map(t => t.trim())
              .filter(t => t.length > 0);
            if (terms.length > 0) {
              const seedIdx = allTexts.indexOf(terms[0]);
              if (seedIdx >= 0) points[seedIdx].isSeed = true;
            }
          }

          const spec = EMBEDDING_MODELS.find(s => s.id === m.id);
          return {
            modelId: m.id,
            modelName: spec?.name || m.id,
            providerId: m.providerId,
            points,
            method: projectionMethod,
            dimensions: dims,
          };
        });

      setClusterData(newClusters);
      setEdgeData(newEdges);
      setVectorData(newVectors);
      setCurrentGroupNames(effectiveGroups.map((g, i) => g.name.trim() || `Group ${i + 1}`));
      const seedLabel = allTexts[0] || "concepts";
      setResult({ seed: seedLabel, terms: allTexts.slice(1), projections });
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCompute = () => handleComputeWithGroups();

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Neighbourhood Map</h2>
          <ResetButton onReset={() => {
            setGroups([{ id: nextGroupId++, name: "", terms: "" }]);
            setScanSeed("");
            setResult(null);
            setError(null);
            setClusterData(new Map());
            setEdgeData(new Map());
            setVectorData(new Map());
          }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Map the structure of the manifold. Add concept groups to see how different domains
          cluster and connect. Use presets or enter your own terms.
        </p>

        {/* Concept groups */}
        <div className="space-y-3 mb-4">
          {groups.map((group, idx) => (
            <div key={group.id} className="relative border border-parchment rounded-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={group.name}
                  onChange={e => updateGroup(group.id, "name", e.target.value)}
                  placeholder={`Group ${idx + 1} name (optional)`}
                  className="input-editorial py-1.5 text-body-sm flex-1"
                />
                {groups.length > 1 && (
                  <button
                    onClick={() => removeGroup(group.id)}
                    className="btn-editorial-ghost px-1.5 py-1.5 text-slate hover:text-error-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <textarea
                value={group.terms}
                onChange={e => updateGroup(group.id, "terms", e.target.value)}
                placeholder="Terms (comma or newline separated)"
                className="input-editorial text-body-sm py-2 min-h-[60px] resize-y"
                rows={2}
              />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              onClick={addGroup}
              className="btn-editorial-secondary text-body-sm px-3 py-1.5"
            >
              <Plus size={14} className="mr-1" />
              Add Group
            </button>
            <BenchmarkLoader
              label="Benchmark"
              onLoad={concepts => {
                setGroups([{ id: nextGroupId++, name: "Benchmark", terms: concepts.join(", ") }]);
              }}
            />
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="btn-editorial-ghost text-body-sm px-3 py-1.5"
            >
              {showPresets ? "Hide Presets" : "Load Preset..."}
            </button>
          </div>

          {/* Manifold Scan */}
          <div className="border border-burgundy/30 bg-burgundy/5 dark:bg-burgundy/10 rounded-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-burgundy" />
              <span className="font-sans text-body-sm font-semibold text-burgundy">Manifold Scan</span>
              <span className="font-sans text-caption text-muted-foreground">
                Auto-generate ~300 related concepts and fire them all into the manifold
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scanSeed}
                onChange={e => setScanSeed(e.target.value)}
                placeholder="Seed concept, e.g. justice"
                className="input-editorial flex-1 py-1.5 text-body-sm"
                onKeyDown={e => e.key === "Enter" && handleScan()}
              />
              <button
                onClick={handleScan}
                disabled={scanning}
                className="btn-editorial-primary px-4 py-1.5 text-body-sm disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Expanding...
                  </>
                ) : (
                  <>
                    <Zap size={14} className="mr-1.5" />
                    Scan
                  </>
                )}
              </button>
            </div>
            <p className="font-sans text-[10px] text-muted-foreground mt-1.5">
              Uses {getExpansionProvider(settings)
                ? `${getExpansionProvider(settings)!.provider} (${getExpansionProvider(settings)!.model})`
                : "no provider available"
              } to generate terms, then embeds them all. Click Compute after scanning to visualise.
            </p>
          </div>

          {/* Presets dropdown */}
          {showPresets && (
            <div className="border border-parchment rounded-sm p-3 bg-card">
              <p className="font-sans text-caption text-slate mb-2 font-semibold uppercase tracking-wider">
                Concept Group Presets
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset)}
                    className="btn-editorial-secondary text-caption px-3 py-1.5"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="font-sans text-body-sm text-slate">Projection:</label>
              <select
                value={projectionMethod}
                onChange={e => setProjectionMethod(e.target.value as "pca" | "umap")}
                className="input-editorial w-auto py-1.5 px-3 text-body-sm"
              >
                <option value="pca">PCA (fast)</option>
                <option value="umap">UMAP (better structure)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-sans text-body-sm text-slate">View:</label>
              <select
                value={dims}
                onChange={e => setDims(Number(e.target.value) as 2 | 3)}
                className="input-editorial w-auto py-1.5 px-3 text-body-sm"
              >
                <option value={3}>3D (rotatable)</option>
                <option value={2}>2D (flat)</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCompute}
            disabled={loading}
            className="btn-editorial-primary disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Compute
          </button>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleCompute} />}

      {result && (
        <div className="space-y-4">
          <h3 className="font-display text-body-lg font-bold">
            Manifold Structure
          </h3>
          <div className={dims === 3 ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
            {result.projections.map(proj => (
              <ScatterPlot
                key={proj.modelId}
                modelName={proj.modelName}
                providerId={proj.providerId}
                points={proj.points}
                method={proj.method}
                dimensions={proj.dimensions}
                clusterAssignments={clusterData.get(proj.modelId)}
                edges={edgeData.get(proj.modelId)}
                vectors={vectorData.get(proj.modelId)}
                modelId={proj.modelId}
                groupNames={currentGroupNames}
              />
            ))}
          </div>
          <NeighbourhoodMapDeepDive result={result} clusterData={clusterData} />
        </div>
      )}
    </div>
  );
}

/** Cross-model Deep Dive for Neighbourhood Map. Per-model summary
 * covering point count, projection method, dimensions, and (when
 * cluster detection has run) cluster count. */
function NeighbourhoodMapDeepDive({
  result,
  clusterData,
}: {
  result: NeighbourhoodMapResult;
  clusterData: Map<string, number[]>;
}) {
  const projections = result.projections;
  const n = projections.length;
  if (n === 0) return null;

  const perModel = projections.map(p => {
    const clusters = clusterData.get(p.modelId);
    const clusterCount = clusters ? new Set(clusters).size : 0;
    // Spread = max axis range across x/y/(z), gives a sense of how
    // dispersed the projection is.
    const xs = p.points.map(pt => pt.x);
    const ys = p.points.map(pt => pt.y);
    const zs = p.points.map(pt => pt.z ?? 0);
    const spread = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      p.dimensions === 3 ? Math.max(...zs) - Math.min(...zs) : 0
    );
    return {
      modelId: p.modelId,
      modelName: p.modelName,
      pointCount: p.points.length,
      method: p.method,
      dimensions: p.dimensions,
      clusterCount,
      spread,
    };
  });

  // Cluster-count agreement across models.
  const clusterCounts = perModel.map(p => p.clusterCount).filter(c => c > 0);
  const clusterAgreement =
    clusterCounts.length === 0
      ? null
      : clusterCounts.every(c => c === clusterCounts[0])
      ? "exact"
      : Math.max(...clusterCounts) - Math.min(...clusterCounts) <= 1
      ? "near"
      : "split";

  const reading =
    n === 1
      ? "Only one model enabled. Add more to test whether the manifold's local structure is structural or contingent."
      : clusterAgreement === "exact"
      ? `All ${n} models partition the neighbourhood into the same number of clusters. The local geometry is structural — different training corpora and architectures all carve up this concept set the same way.`
      : clusterAgreement === "near"
      ? "Models nearly agree on cluster count, differing by one. The neighbourhood structure is robust at the level of broad partitioning but contingent at the boundary."
      : clusterAgreement === "split"
      ? `Models disagree on cluster count (${Math.min(...clusterCounts)} to ${Math.max(...clusterCounts)}). The neighbourhood's geometric structure is contingent on training; different models carve up this concept set differently.`
      : "Cluster detection has not run — toggle clusters on the projection to populate this reading.";

  return (
    <DeepDivePanel tagline="per-model projection · cluster-count agreement">
      <DeepDiveSection
        title="Cross-model summary"
        tip="Do enabled models partition the local neighbourhood into the same number of clusters? Convergence here means the local structure is structural; divergence means contingent on training."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DeepDiveStat label="Models" value={String(n)} />
          <DeepDiveStat label="Points each" value={String(perModel[0]?.pointCount ?? 0)} hint={`projected to ${perModel[0]?.dimensions ?? 0}D`} />
          <DeepDiveStat
            label="Cluster agreement"
            value={clusterAgreement === "exact" ? "all agree" : clusterAgreement === "near" ? "near agreement" : clusterAgreement === "split" ? "split" : "—"}
            hint={clusterCounts.length > 0 ? `${Math.min(...clusterCounts)}–${Math.max(...clusterCounts)} clusters` : "no cluster data"}
            tone={clusterAgreement === "exact" ? "success" : clusterAgreement === "near" ? "warning" : clusterAgreement === "split" ? "error" : "neutral"}
          />
          <DeepDiveStat label="Mean spread" value={(perModel.reduce((s, p) => s + p.spread, 0) / n).toFixed(3)} hint="projected axis range" />
        </div>
        <p className="mt-2 font-body text-caption text-slate italic">{reading}</p>
      </DeepDiveSection>
      <DeepDiveSection title="Per-model summary">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead><tr className="border-b border-parchment">
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Points</th>
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Method</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Dims</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Clusters</th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Spread</th>
            </tr></thead>
            <tbody className="divide-y divide-parchment">
              {perModel.map(p => (
                <tr key={p.modelId}>
                  <td className="px-2 py-1 font-medium">{p.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.pointCount}</td>
                  <td className="px-2 py-1 uppercase">{p.method}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.dimensions}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.clusterCount > 0 ? p.clusterCount : "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.spread.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DeepDiveSection>
    </DeepDivePanel>
  );
}

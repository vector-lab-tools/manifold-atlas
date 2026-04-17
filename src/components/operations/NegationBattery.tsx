"use client";

import { useState } from "react";
import { Loader2, Crosshair, Download } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { SimilarityMeter } from "@/components/viz/SimilarityMeter";
import { negationSimilarityLevel } from "@/lib/similarity-scale";
import { ResetButton } from "@/components/shared/ResetButton";
import {
  NEGATION_BATTERIES,
  computeNegationBattery,
  negationBatteryTextList,
  type NegationBatteryStatementResult,
} from "@/lib/operations/negation-battery";

const BATTERIES = NEGATION_BATTERIES;
type BatteryResult = NegationBatteryStatementResult;

interface NegationBatteryProps {
  onQueryTime: (time: number) => void;
}

export function NegationBattery({ onQueryTime }: NegationBatteryProps) {
  const [selectedBattery, setSelectedBattery] = useState<string>("Political claims");
  const [customStatements, setCustomStatements] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<BatteryResult[]>([]);
  const { settings, getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  const handleRun = async () => {
    const statements = customStatements.trim()
      ? customStatements.split("\n").map(s => s.trim()).filter(s => s.length > 0)
      : BATTERIES[selectedBattery] || [];

    if (statements.length === 0) return;

    setLoading(true);
    setError(null);
    setResults([]);
    const start = performance.now();

    try {
      setProgress({ current: 0, total: statements.length });

      const inputs = { statements, threshold: settings.negationThreshold };
      const texts = negationBatteryTextList(inputs);
      const modelVectors = await embedAll(texts);
      const enabledModels = getEnabledModels();
      const computed = computeNegationBattery(inputs, modelVectors, enabledModels);

      setResults(computed.statements);
      setProgress({ current: statements.length, total: statements.length });
      onQueryTime((performance.now() - start) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  // Summary stats
  const totalTests = results.length * (results[0]?.models.length || 0);
  const totalCollapsed = results.reduce(
    (sum, r) => sum + r.models.filter(m => m.collapsed).length, 0
  );
  const collapseRate = totalTests > 0 ? (totalCollapsed / totalTests * 100) : 0;
  const avgSimilarity = results.length > 0
    ? results.reduce((sum, r) => sum + r.models.reduce((s, m) => s + m.similarity, 0) / r.models.length, 0) / results.length
    : 0;

  const exportCSV = () => {
    const rows = ["statement,negated,model,cosine_similarity,collapsed"];
    for (const r of results) {
      for (const m of r.models) {
        rows.push(`"${r.statement}","${r.negated}","${m.modelName}",${m.similarity.toFixed(6)},${m.collapsed}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "negation-battery-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Negation Battery</h2>
          <ResetButton onReset={() => { setResults([]); setCustomStatements(""); setSelectedBattery("Political claims"); setError(null); }} />
        </div>
        <p className="font-sans text-body-sm text-slate mb-4">
          Run a battery of negation tests automatically. Select a pre-built set or enter your
          own statements (one per line). For each statement, the tool embeds the claim and its
          negation and measures how close they sit in the geometry. The report card shows
          where each model gives negation the least space.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="font-sans text-body-sm text-slate">Battery:</label>
            <select
              value={selectedBattery}
              onChange={e => { setSelectedBattery(e.target.value); setCustomStatements(""); }}
              className="input-editorial w-auto py-1.5 px-3 text-body-sm"
            >
              {Object.keys(BATTERIES).map(name => (
                <option key={name} value={name}>{name} ({BATTERIES[name].length} tests)</option>
              ))}
              <option value="custom">Custom statements</option>
            </select>
          </div>

          {selectedBattery === "custom" && (
            <textarea
              value={customStatements}
              onChange={e => setCustomStatements(e.target.value)}
              placeholder="One statement per line, e.g.&#10;This policy is fair&#10;Nuclear weapons solve war&#10;Art has intrinsic value"
              className="input-editorial min-h-[120px] resize-y text-body-sm"
              rows={5}
            />
          )}

          <div className="flex items-center justify-between">
            {loading && (
              <span className="font-sans text-caption text-muted-foreground">
                Testing {progress.current} of {progress.total}...
              </span>
            )}
            <div className="ml-auto">
              <button
                onClick={handleRun}
                disabled={loading}
                className="btn-editorial-primary disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin mr-2" />Testing...</>
                ) : (
                  <><Crosshair size={16} className="mr-2" />Run Battery</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleRun} />}

      {results.length > 0 && (
        <div className="space-y-4">
          {/* Report card summary */}
          <div className="card-editorial overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="font-display text-body-lg font-bold">Negation Report Card</h3>
            </div>
            <div className="thin-rule mx-5" />
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Tests Run</div>
                  <div className="font-sans text-body-lg font-bold mt-0.5">{results.length}</div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Collapse Rate</div>
                  <div className={`font-sans text-body-lg font-bold mt-0.5 ${collapseRate > 50 ? "text-error-500" : collapseRate > 20 ? "text-warning-500" : "text-success-600"}`}>
                    {collapseRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Avg Similarity</div>
                  <div className="font-sans text-body-lg font-bold mt-0.5 tabular-nums">{avgSimilarity.toFixed(4)}</div>
                </div>
                <div className="bg-muted rounded-sm p-3">
                  <div className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">Total Collapses</div>
                  <div className={`font-sans text-body-lg font-bold mt-0.5 ${totalCollapsed > 0 ? "text-error-500" : "text-success-600"}`}>
                    {totalCollapsed} / {totalTests}
                  </div>
                </div>
              </div>
            </div>

            <div className="thin-rule mx-5" />

            {/* Average similarity meter */}
            <div className="px-5 py-4">
              <SimilarityMeter
                similarity={avgSimilarity}
                level={negationSimilarityLevel(avgSimilarity, settings.negationThreshold)}
              />
            </div>
          </div>

          {/* Per-statement results table */}
          <div className="card-editorial overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="font-display text-body-lg font-bold">Individual Results</h3>
              <button onClick={exportCSV} className="btn-editorial-ghost text-caption px-3 py-1.5">
                <Download size={14} className="mr-1" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-body-sm">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="text-left px-5 py-2 text-caption text-muted-foreground uppercase tracking-wider font-semibold">Statement</th>
                    {results[0]?.models.map(m => (
                      <th key={m.modelId} className="text-center px-3 py-2 text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                        {m.modelName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-cream/30 transition-colors">
                      <td className="px-5 py-2.5 max-w-[300px]">
                        <div className="font-medium">{r.statement}</div>
                        <div className="text-caption text-muted-foreground mt-0.5">&rarr; {r.negated}</div>
                      </td>
                      {r.models.map(m => {
                        const level = negationSimilarityLevel(m.similarity, settings.negationThreshold);
                        return (
                          <td key={m.modelId} className="text-center px-3 py-2.5">
                            <span
                              className="font-bold tabular-nums"
                              style={{ color: level.color }}
                            >
                              {m.similarity.toFixed(3)}
                            </span>
                            {m.collapsed && (
                              <div className="text-[9px] text-error-500 font-semibold mt-0.5">COLLAPSED</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Grammar of Vectors operation.
 *
 * Maps discursive quirks of LLM text generation by measuring
 * cosine(X, Y) for each instance of a chosen grammatical construction.
 * The user picks which grammar to explore (Not X but Y, Not just X
 * but Y, …) and which register of preset examples to run. Custom mode
 * accepts free-form pasted constructions, parsed according to the
 * currently-selected grammar.
 *
 * The component also accepts URL-parameter deep links from LLMbench
 * Grammar Probe (?x=…&ys=…&source=llmbench-grammar-probe) so Phase C
 * candidate Ys can be sent here for cosine analysis against a common
 * X. See the companion spec in
 * `knowledge/wip/blogposts/grammar-of-vectors/WORKING.md`.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Download, Gauge } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import {
  GRAMMARS,
  DEFAULT_GRAMMAR_ID,
  DEFAULT_GRAMMAR_THRESHOLD,
  computeGrammarOfVectors,
  grammarOfVectorsTextList,
  parseInstances,
  type GrammarInstance,
  type GrammarOfVectorsResult,
} from "@/lib/operations/grammar-of-vectors";

interface GrammarOfVectorsProps {
  onQueryTime: (time: number) => void;
}

type InputMode = "preset" | "custom";

export function GrammarOfVectors({ onQueryTime }: GrammarOfVectorsProps) {
  const [grammarId, setGrammarId] = useState<string>(DEFAULT_GRAMMAR_ID);
  const grammar = GRAMMARS[grammarId] ?? GRAMMARS[DEFAULT_GRAMMAR_ID];
  const registerNames = useMemo(() => Object.keys(grammar.registers), [grammar]);

  const [register, setRegister] = useState<string>(registerNames[0] ?? "");
  const [mode, setMode] = useState<InputMode>("preset");
  const [customText, setCustomText] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<GrammarOfVectorsResult | null>(null);

  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  // Reset register if the selected grammar doesn't have the current
  // one (happens when grammars are switched and their register sets
  // don't match).
  useEffect(() => {
    if (!grammar.registers[register]) {
      setRegister(registerNames[0] ?? "");
    }
  }, [grammar, register, registerNames]);

  // Deep-link inbound handler: ?x=<X>&ys=<Y1,Y2,...>&source=llmbench-grammar-probe.
  // Each Y is paired with the shared X as an explicit "X | Y" pipe
  // construction so it maps cleanly onto the current grammar's parser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const x = params.get("x");
    const ysRaw = params.get("ys");
    if (!x || !ysRaw) return;
    const ys = ysRaw.split(/\s*,\s*/).filter(Boolean);
    if (ys.length === 0) return;
    const lines = ys.map(y => `${x} | ${y}`).join("\n");
    setMode("custom");
    setCustomText(lines);
    setPreviewOpen(true);
    // Leave grammar at its current selection — the parser will accept
    // the pipe-delimited form regardless of which grammar is active.
  }, []);

  // Resolved instances for the preview pane and for the run.
  const resolvedInstances: GrammarInstance[] = useMemo(() => {
    if (mode === "custom") return parseInstances(grammarId, customText);
    return grammar.registers[register] ?? [];
  }, [mode, grammarId, customText, grammar, register]);

  const handleRun = async () => {
    if (resolvedInstances.length === 0) {
      setError(new Error("No constructions to test. Pick a register or paste your own."));
      return;
    }
    setLoading(true);
    setError(null);
    const started = performance.now();
    try {
      const inputs = {
        grammarId,
        register: mode === "custom" ? undefined : register,
        instances: mode === "custom" ? resolvedInstances : undefined,
        threshold: DEFAULT_GRAMMAR_THRESHOLD,
      };
      const texts = grammarOfVectorsTextList({
        ...inputs,
        instances: resolvedInstances,
      });
      const modelVectors = await embedAll(texts);
      const enabledModels = getEnabledModels();
      const computed = computeGrammarOfVectors(
        { ...inputs, instances: resolvedInstances },
        modelVectors,
        enabledModels
      );
      setResult(computed);
      onQueryTime((performance.now() - started) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setMode("preset");
    setGrammarId(DEFAULT_GRAMMAR_ID);
    setRegister(Object.keys(GRAMMARS[DEFAULT_GRAMMAR_ID].registers)[0] ?? "");
    setCustomText("");
    setPreviewOpen(false);
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = ["construction,x,y,model,cosine,opposition_preserved"];
    for (const p of result.pairs) {
      for (const m of p.models) {
        const raw = p.instance.raw.replace(/"/g, '""');
        const x = p.instance.parts[0].replace(/"/g, '""');
        const y = p.instance.parts[1].replace(/"/g, '""');
        rows.push(`"${raw}","${x}","${y}","${m.modelName}",${m.cosineSimilarity.toFixed(6)},${m.oppositionPreserved}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const grammarSlug = result.grammarId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const registerSlug = (result.register ?? "custom").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `grammar-of-vectors-${grammarSlug}-${registerSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-display-md font-bold">Grammar of Vectors</h2>
          <ResetButton onReset={handleReset} />
        </div>
        <p className="font-sans text-body-sm text-slate italic mb-2">
          Mapping discursive quirks of LLM text generation &mdash; currently the Not X but Y pattern
        </p>
        <p className="font-sans text-body-sm text-slate mb-4">
          Language models constantly produce constructions like &ldquo;not a problem,
          but an opportunity&rdquo; or &ldquo;not merely efficient, but meaningful&rdquo;.
          The rhetoric performs antithesis while the underlying geometric move is a
          slight rotation to a near-neighbour. This operation measures the gap
          between the rhetorical claim of opposition and the cosine reality.
          Pick a grammar, pick a register, and run.
        </p>

        <div className="space-y-3">
          {/* Grammar selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="font-sans text-body-sm text-slate">Grammar:</label>
            <select
              value={grammarId}
              onChange={e => setGrammarId(e.target.value)}
              className="input-editorial w-auto py-1.5 px-3 text-body-sm"
            >
              {Object.values(GRAMMARS).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <p className="font-sans text-caption text-muted-foreground italic">
            {grammar.description} &nbsp;
            <span className="text-foreground font-mono not-italic">e.g. &ldquo;{grammar.example}&rdquo;</span>
          </p>

          {/* Register / custom mode */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="font-sans text-body-sm text-slate">Source:</label>
            <div className="flex items-center gap-1 p-0.5 bg-muted rounded-sm">
              <button
                onClick={() => setMode("preset")}
                className={`px-3 py-1 font-sans text-caption rounded-sm transition-colors ${
                  mode === "preset" ? "bg-burgundy text-primary-foreground shadow-editorial" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Preset register
              </button>
              <button
                onClick={() => setMode("custom")}
                className={`px-3 py-1 font-sans text-caption rounded-sm transition-colors ${
                  mode === "custom" ? "bg-burgundy text-primary-foreground shadow-editorial" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Custom
              </button>
            </div>
            {mode === "preset" && (
              <>
                <select
                  value={register}
                  onChange={e => setRegister(e.target.value)}
                  className="input-editorial w-auto py-1.5 px-3 text-body-sm"
                >
                  {registerNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <span className="font-sans text-caption text-muted-foreground">
                  {resolvedInstances.length} phrase{resolvedInstances.length === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>

          {/* Custom input */}
          {mode === "custom" && (
            <div>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder={
                  `One construction per line. Either a "${grammar.example}" phrase or an X | Y pipe pair.\n\n` +
                  `${grammar.example}\nnot a threat, but a tool\nX | Y`
                }
                rows={6}
                className="input-editorial text-body-sm w-full resize-y font-mono"
              />
              <p className="mt-1 font-sans text-caption text-muted-foreground italic">
                {resolvedInstances.length} parsed · lines that don&rsquo;t match the selected
                grammar or contain a pipe are skipped.
              </p>
            </div>
          )}

          {/* Preview */}
          {resolvedInstances.length > 0 && (
            <div>
              <button
                onClick={() => setPreviewOpen(!previewOpen)}
                className="flex items-center gap-1 font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors"
              >
                {previewOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Preview constructions ({resolvedInstances.length})
              </button>
              {previewOpen && (
                <ul className="mt-2 space-y-0.5 list-disc pl-5 font-sans text-caption text-slate">
                  {resolvedInstances.map((inst, i) => (
                    <li key={i}>
                      <span className="text-foreground">{inst.raw}</span>
                      {inst.raw !== `${inst.parts[0]} | ${inst.parts[1]}` && (
                        <span className="ml-2 text-muted-foreground">
                          X: &ldquo;{inst.parts[0]}&rdquo; · Y: &ldquo;{inst.parts[1]}&rdquo;
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              onClick={handleRun}
              disabled={loading || resolvedInstances.length === 0}
              className="btn-editorial-primary flex items-center gap-1 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin mr-1" />Running...</>
              ) : (
                <><Gauge size={14} className="mr-1" />Run Grammar Test</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error != null && <ErrorDisplay error={error} onRetry={handleRun} />}

      {result && (
        <>
          {/* Summary */}
          <div className="card-editorial p-5">
            <h3 className="font-display text-body-lg font-bold mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryBox label="Grammar" value={result.grammarName} />
              <SummaryBox label="Source" value={result.register ?? "custom"} />
              <SummaryBox label="Constructions" value={String(result.summary.totalPairs)} />
              <SummaryBox label="Tests" value={String(result.summary.totalTests)} />
              <SummaryBox
                label="Opposition preserved"
                value={`${(result.summary.preservedRate * 100).toFixed(1)}%`}
                tone={result.summary.preservedRate < 0.25 ? "error" : result.summary.preservedRate < 0.5 ? "warning" : "success"}
              />
              <SummaryBox label="Avg cosine" value={result.summary.avgSimilarity.toFixed(4)} />
              <SummaryBox
                label="Threshold"
                value={String(result.threshold)}
                hint="above = pseudo-dialectic · below = opposition preserved"
              />
              {result.summary.mostDeceptive && (
                <SummaryBox
                  label="Most deceptive"
                  value={`"${truncate(result.summary.mostDeceptive.raw, 36)}"`}
                  hint={`cos ${result.summary.mostDeceptive.cosine.toFixed(3)} in ${result.summary.mostDeceptive.modelName}`}
                />
              )}
            </div>
            <div className="thin-rule my-4" />
            <p className="font-body text-body-sm text-slate italic">
              The grammar of vectors expresses what the geometry permits. When a
              construction claims opposition that the cosine cannot deliver, the
              rhetoric is performing more than the medium can support. Pseudo-dialectic
              is the name for that gap.
            </p>
          </div>

          {/* Per-construction × per-model matrix */}
          <div className="card-editorial overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="font-display text-body-lg font-bold">Per-construction cosines</h3>
              <button onClick={exportCsv} className="btn-editorial-ghost text-caption px-3 py-1.5">
                <Download size={14} className="mr-1" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-body-sm">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="text-left px-5 py-2 text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                      Construction
                    </th>
                    {result.pairs[0]?.models.map(m => (
                      <th key={m.modelId} className="text-right px-3 py-2 text-caption text-muted-foreground uppercase tracking-wider font-semibold">
                        {m.modelName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {result.pairs.map((p, i) => (
                    <tr key={i} className="hover:bg-cream/30 transition-colors">
                      <td className="px-5 py-2.5 max-w-[360px]">
                        <div className="font-medium">{p.instance.raw}</div>
                        <div className="text-caption text-muted-foreground mt-0.5">
                          X: &ldquo;{p.instance.parts[0]}&rdquo; · Y: &ldquo;{p.instance.parts[1]}&rdquo;
                        </div>
                      </td>
                      {p.models.map(m => (
                        <td key={m.modelId} className="text-right px-3 py-2.5">
                          <span
                            className={`font-bold tabular-nums ${
                              !m.oppositionPreserved ? "text-error-600" : "text-success-600"
                            }`}
                          >
                            {m.cosineSimilarity.toFixed(3)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryBox({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const valueColour = {
    neutral: "",
    success: "text-success-600",
    warning: "text-warning-500",
    error: "text-error-500",
  }[tone];
  return (
    <div className="bg-muted rounded-sm p-3">
      <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className={`font-sans text-body-lg font-bold mt-1 tabular-nums ${valueColour}`}>
        {value}
      </div>
      {hint && <div className="font-sans text-caption text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

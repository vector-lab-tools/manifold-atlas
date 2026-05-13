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

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Download, Gauge, Upload, FileJson, X as XIcon } from "lucide-react";
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
  type GrammarPairResult,
} from "@/lib/operations/grammar-of-vectors";
import {
  parseBundle,
  bundleToInstances,
  computeBundleFindings,
  type GrammarProbeBundle,
  type BundleFindings,
} from "@/lib/operations/grammar-probe-bundle";

interface GrammarOfVectorsProps {
  onQueryTime: (time: number) => void;
}

type InputMode = "preset" | "custom" | "bundle";

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
  const [expandedPairs, setExpandedPairs] = useState<Set<number>>(new Set());
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);

  // Grammar Probe Bundle state. When a `.grammar.json` is loaded, the
  // bundle's probes are flattened into one instance per (probe × y-
  // token) and fed into the compute pipeline. After the run, the
  // bundle findings (Spearman logprob-vs-cosine ranks) are rendered
  // alongside the standard summary.
  const [bundle, setBundle] = useState<GrammarProbeBundle | null>(null);
  const [bundleWarnings, setBundleWarnings] = useState<string[]>([]);
  const [bundleImportError, setBundleImportError] = useState<string | null>(null);
  const [bundleDragOver, setBundleDragOver] = useState(false);
  const [bundleFindings, setBundleFindings] = useState<BundleFindings | null>(null);
  const bundleFileInput = useRef<HTMLInputElement | null>(null);

  // Sort state for the per-construction cosines table. "index" is the
  // natural order. "construction" sorts alphabetically by raw text.
  // "range" sorts by cross-model spread. Any other string is treated
  // as a model id, sorting by that model's cosine.
  const [sortKey, setSortKey] = useState<string>("index");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const togglePair = (i: number) => {
    setExpandedPairs(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAllPairs = (expand: boolean) => {
    if (!result) return;
    if (expand) {
      setExpandedPairs(new Set(result.pairs.map((_, i) => i)));
    } else {
      setExpandedPairs(new Set());
    }
  };

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible default directions per column
      setSortDir(key === "construction" || key === "index" ? "asc" : "desc");
    }
  };

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
    if (mode === "bundle") return bundle ? bundleToInstances(bundle) : [];
    return grammar.registers[register] ?? [];
  }, [mode, grammarId, customText, grammar, register, bundle]);

  const ingestBundleText = (text: string, filename?: string) => {
    const parsed = parseBundle(text);
    if (!parsed.ok) {
      setBundleImportError(parsed.error);
      setBundle(null);
      setBundleWarnings([]);
      return;
    }
    setBundle(parsed.bundle);
    setBundleWarnings(parsed.warnings);
    setBundleImportError(null);
    setBundleFindings(null);
    setResult(null);
    setPreviewOpen(true);
    // If the bundle's pattern id matches a grammar we know about,
    // select it so the UI labelling is coherent. Unknown patterns are
    // left on the current grammar — the parser is unused in bundle
    // mode anyway.
    if (GRAMMARS[parsed.bundle.pattern.id]) {
      setGrammarId(parsed.bundle.pattern.id);
    }
    if (filename) {
      // No-op today, but preserved for future UI breadcrumb.
    }
  };

  const handleBundleFile = async (file: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      ingestBundleText(text, file.name);
    } catch (e) {
      setBundleImportError(`Could not read file: ${(e as Error).message}`);
    }
  };

  const handleBundleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBundleDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleBundleFile(file);
  };

  const clearBundle = () => {
    setBundle(null);
    setBundleWarnings([]);
    setBundleImportError(null);
    setBundleFindings(null);
    if (bundleFileInput.current) bundleFileInput.current.value = "";
  };

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
      // If the run was fed from a bundle, compute logprob-vs-cosine
      // rank correlations per probe. Ignored in preset / custom modes.
      if (mode === "bundle" && bundle) {
        setBundleFindings(computeBundleFindings(computed.pairs));
      } else {
        setBundleFindings(null);
      }
      // Default: open every row so the user can scan the full per-model
      // geometry without having to click each chevron.
      setExpandedPairs(new Set(computed.pairs.map((_, i) => i)));
      setSortKey("index");
      setSortDir("asc");
      onQueryTime((performance.now() - started) / 1000);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = () => {
    // Minimal skeleton — the grammar's own example as a reference plus
    // three X | Y slots for the user to fill in.
    const template =
      `# Replace the placeholders below with your own X and Y fragments.\n` +
      `# Lines starting with # are ignored. One construction per line.\n` +
      `# Either the full prose (matching the grammar's shape) or X | Y pairs.\n` +
      `#\n` +
      `# Example for "${grammar.name}":\n` +
      `#   ${grammar.example}\n` +
      `\n` +
      `<your X> | <your Y>\n` +
      `<your X> | <your Y>\n` +
      `<your X> | <your Y>\n`;
    setCustomText(template);
    setPreviewOpen(false);
  };

  const handleLoadExample = () => {
    const firstRegister = Object.keys(grammar.registers)[0];
    const examples = grammar.registers[firstRegister] ?? [];
    if (examples.length === 0) return;
    const lines = examples
      .slice(0, Math.min(6, examples.length))
      .map(e => e.raw);
    setCustomText(lines.join("\n"));
    setPreviewOpen(true);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setMode("preset");
    setGrammarId(DEFAULT_GRAMMAR_ID);
    setRegister(Object.keys(GRAMMARS[DEFAULT_GRAMMAR_ID].registers)[0] ?? "");
    setCustomText("");
    setPreviewOpen(false);
    clearBundle();
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      "construction,x,y,model,cosine,cosine_distance,angular_degrees,euclidean,norm_x,norm_y,dimensions,opposition_preserved",
    ];
    for (const p of result.pairs) {
      for (const m of p.models) {
        const raw = p.instance.raw.replace(/"/g, '""');
        const x = p.instance.parts[0].replace(/"/g, '""');
        const y = p.instance.parts[1].replace(/"/g, '""');
        rows.push(
          `"${raw}","${x}","${y}","${m.modelName}",${m.cosineSimilarity.toFixed(6)},${m.cosineDistance.toFixed(6)},${m.angularDistance.toFixed(4)},${m.euclideanDistance.toFixed(6)},${m.normX.toFixed(4)},${m.normY.toFixed(4)},${m.dimensions},${m.oppositionPreserved}`
        );
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
              <button
                onClick={() => setMode("bundle")}
                title="Load a Grammar Probe Bundle (.grammar.json) exported from LLMbench Phase C. Atlas embeds each probe's X against every top-K Y token and reports the Spearman correlation between logprob rank and cosine rank."
                className={`px-3 py-1 font-sans text-caption rounded-sm transition-colors ${
                  mode === "bundle" ? "bg-burgundy text-primary-foreground shadow-editorial" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                LLMbench bundle
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
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button
                  onClick={handleLoadTemplate}
                  className="btn-editorial-ghost text-caption"
                  title="Start with a scaffold: placeholders for X and Y plus a reference to the grammar's canonical form."
                >
                  Load template
                </button>
                <button
                  onClick={handleLoadExample}
                  className="btn-editorial-ghost text-caption"
                  title={`Load six real constructions from the first register (${Object.keys(grammar.registers)[0] ?? "Marketing"}) as a starting point you can edit.`}
                >
                  Load example
                </button>
                <span className="font-sans text-caption text-muted-foreground italic">
                  Or paste your own below.
                </span>
              </div>
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
                {resolvedInstances.length}
                {" parsed · lines that don\u2019t match the selected grammar or contain a pipe are skipped."}
              </p>
            </div>
          )}

          {/* Bundle drop-zone + metadata */}
          {mode === "bundle" && (
            <div>
              {!bundle ? (
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setBundleDragOver(true);
                  }}
                  onDragLeave={() => setBundleDragOver(false)}
                  onDrop={handleBundleDrop}
                  className={`rounded-sm border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    bundleDragOver
                      ? "border-burgundy bg-burgundy/5"
                      : "border-parchment hover:border-muted-foreground/60"
                  }`}
                >
                  <FileJson size={22} className="text-muted-foreground mx-auto mb-2" />
                  <p className="font-sans text-body-sm text-foreground mb-1">
                    Drop a <span className="font-mono">.grammar.json</span> bundle here,
                    or
                    <button
                      onClick={() => bundleFileInput.current?.click()}
                      className="ml-1 underline decoration-burgundy/60 hover:text-burgundy"
                    >
                      browse
                    </button>
                    .
                  </p>
                  <p className="font-sans text-caption text-muted-foreground italic">
                    Format: <span className="font-mono">vector-lab.grammar-probe.v1</span> — produced by LLMbench Grammar Probe (Phase C).
                  </p>
                  <input
                    ref={bundleFileInput}
                    type="file"
                    accept=".json,.grammar.json,application/json"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleBundleFile(f);
                    }}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="rounded-sm border border-parchment bg-muted/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <FileJson size={18} className="text-burgundy mt-0.5" />
                      <div>
                        <div className="font-sans text-body-sm font-semibold">
                          {bundle.pattern.label}
                          <span className="ml-2 text-muted-foreground font-mono text-caption">
                            {bundle.pattern.id}
                          </span>
                        </div>
                        <div className="font-sans text-caption text-muted-foreground mt-0.5">
                          {bundle.source.tool} {bundle.source.version}
                          {bundle.source.phase ? ` · Phase ${bundle.source.phase}` : ""}
                          {" · "}model {bundle.model.displayName ?? bundle.model.name}
                          {" · "}topK {bundle.parameters.topK}
                          {" · "}temp {bundle.parameters.temperature}
                          {" · "}
                          {bundle.probes.length} probe{bundle.probes.length === 1 ? "" : "s"}
                          {" · "}
                          {resolvedInstances.length} Y candidates
                        </div>
                        {bundle.createdAt && (
                          <div className="font-sans text-caption text-muted-foreground">
                            created {bundle.createdAt}
                          </div>
                        )}
                        {bundleWarnings.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 font-sans text-caption text-warning-500">
                            {bundleWarnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        )}
                        {bundle.pattern.note && (
                          <p className="mt-1 font-sans text-caption text-muted-foreground italic">
                            {bundle.pattern.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={clearBundle}
                      title="Clear this bundle."
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>
              )}
              {bundleImportError && (
                <div className="mt-2 rounded-sm border border-error-500/40 bg-error-500/5 px-3 py-2 font-sans text-caption text-error-600">
                  <span className="font-semibold">Could not import bundle:</span> {bundleImportError}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => bundleFileInput.current?.click()}
                  className="btn-editorial-ghost text-caption"
                >
                  <Upload size={12} className="mr-1" />
                  {bundle ? "Replace bundle" : "Choose file"}
                </button>
                <span className="font-sans text-caption text-muted-foreground italic">
                  Atlas embeds each X and every top-K Y token, then reports the Spearman correlation between logprob rank and cosine-to-X rank per probe.
                </span>
              </div>
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
              <SummaryBox
                label="Grammar"
                value={result.grammarName}
                tip="The syntactic construction being tested. Different grammars are different rhetorical tics that vector logic produces when asked to sound nuanced (not X but Y, not just X but Y, and more to come)."
              />
              <SummaryBox
                label="Source"
                value={result.register ?? "custom"}
                tip="The register that supplies the example constructions. Each register is a curated battery drawn from a characteristic prose style (marketing, AI pedagogical, political op-ed, technology discourse), or the user's own Custom list."
              />
              <SummaryBox
                label="Constructions"
                value={String(result.summary.totalPairs)}
                tip="Number of distinct constructions tested in this run. Each one supplies an X and a Y for cosine measurement."
              />
              <SummaryBox
                label="Tests"
                value={String(result.summary.totalTests)}
                tip="Number of cosine measurements taken — constructions multiplied by the number of enabled embedding models."
              />
              <SummaryBox
                label="Distinct lexical fields"
                value={`${(result.summary.preservedRate * 100).toFixed(1)}%`}
                tone={result.summary.preservedRate < 0.25 ? "error" : result.summary.preservedRate < 0.5 ? "warning" : "success"}
                tip="Proportion of tests where cosine(X, Y) falls below the threshold — the geometry registers distinct lexical fields for the two fragments. Whether that separation amounts to the antithesis the rhetorical construction claims is the reader's interpretive move. Low rates mean the X and Y fragments are geometrically close across most of the run — the empirical material for the synthetic-dialectic argument, but not by itself the verdict that the rhetoric outruns the geometry."
              />
              <SummaryBox
                label="Avg cosine"
                value={result.summary.avgSimilarity.toFixed(4)}
                tip={`Mean cosine similarity between X and Y across all tests, ± ${result.summary.stdDevSimilarity.toFixed(4)} standard deviation. The construction's rhetorical frame claims X and Y are opposed; the closer this value sits to 1.0, the smaller the lexical-field separation the geometry registers between the two fragments.`}
              />
              <SummaryBox
                label="Threshold"
                value={String(result.threshold)}
                hint="above = lexical-field overlap · below = distinct lexical fields"
                tip="Cosine threshold separating distinct-lexical-fields (below) from lexical-field overlap (above). The synthetic-dialectic reading — that the rhetorical performance of antithesis runs on a near-neighbour geometric move — is the interpretation the user brings to a run whose overlap rate is high. Use the Deep Dive's threshold sweep to see how sensitive the rate is to this choice; typically stable across 0.5–0.7."
              />
              {result.summary.mostDeceptive && (
                <SummaryBox
                  label="Highest cosine pair"
                  value={`"${truncate(result.summary.mostDeceptive.raw, 36)}"`}
                  hint={`cos ${result.summary.mostDeceptive.cosine.toFixed(3)} in ${result.summary.mostDeceptive.modelName}`}
                  tip="The construction × model combination with the highest cosine similarity in this run — the strongest case in this sample for reading the rhetorical antithesis as outrunning the geometry. The reader judges whether the high overlap means the construction performs more opposition than the geometry can deliver (synthetic dialectic), or simply that the two fragments share enough vocabulary for cosine to register them as close."
                />
              )}
            </div>
            <div className="thin-rule my-4" />
            <p className="font-body text-body-sm text-slate italic">
              The grammar of vectors expresses what the geometry permits. When a
              construction claims opposition that the cosine cannot deliver, the
              rhetoric is performing more than the medium can support.{" "}
              <em>Synthetic dialectic</em> is the name for that gap: a rhetorical performance
              of thesis and antithesis whose underlying geometric move is a slight rotation
              between near-neighbours. Dialectic as style, not as operation.
            </p>
          </div>

          {/* Bundle findings (only when run from an LLMbench bundle) */}
          {bundleFindings && <BundleFindingsCard findings={bundleFindings} bundle={bundle} />}

          {/* Per-construction × per-model matrix with expandable rows */}
          <div className="card-editorial overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-display text-body-lg font-bold">Per-construction cosines</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllPairs(true)}
                  className="btn-editorial-ghost text-caption"
                  title="Expand every row to show the full per-model geometry."
                >
                  Expand all
                </button>
                <button
                  onClick={() => toggleAllPairs(false)}
                  className="btn-editorial-ghost text-caption"
                  title="Collapse every row back to the cosine summary."
                >
                  Collapse all
                </button>
                <button onClick={exportCsv} className="btn-editorial-ghost text-caption px-3 py-1.5">
                  <Download size={14} className="mr-1" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-body-sm">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="w-6"></th>
                    <SortableTh
                      label="#"
                      sortKey="index"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="right"
                      tip="Row number in the original run order. Click to sort; click again to flip direction."
                    />
                    <SortableTh
                      label="Construction"
                      sortKey="construction"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={handleSort}
                      tip="The construction tested. X and Y are extracted from the prose. Click to sort alphabetically."
                    />
                    {result.pairs[0]?.models.map(m => (
                      <SortableTh
                        key={m.modelId}
                        label={m.modelName}
                        sortKey={m.modelId}
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        align="right"
                        tip={`Cosine similarity between X and Y, as reported by ${m.modelName}. Click to sort by this model's cosine — largest (most deceptive) first.`}
                      />
                    ))}
                    <SortableTh
                      label="Range"
                      sortKey="range"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="right"
                      tip="Cross-model range — max cosine minus min cosine. High values mean models disagree about whether the antithesis survives. Click to sort most-contested first."
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {getSortedPairs(result.pairs, sortKey, sortDir).map(({ pair, originalIndex }) => {
                    const expanded = expandedPairs.has(originalIndex);
                    return (
                      <ExpandableRow
                        key={originalIndex}
                        rowNumber={originalIndex + 1}
                        pair={pair}
                        expanded={expanded}
                        onToggle={() => togglePair(originalIndex)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 font-sans text-caption text-muted-foreground italic">
              Rows are open by default; toggle individual rows with their chevron or use Expand / Collapse all. Click any column header to sort by that measure.
            </div>
          </div>

          {/* Deep Dive */}
          <div className="card-editorial overflow-hidden">
            <button
              onClick={() => setDeepDiveOpen(!deepDiveOpen)}
              className="w-full px-5 py-3 flex items-center gap-2 hover:bg-cream/50 transition-colors"
            >
              {deepDiveOpen ? (
                <ChevronDown size={14} className="text-burgundy" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}
              <span className="font-display text-body-lg font-bold">Deep Dive</span>
              <span className="ml-2 font-sans text-caption text-muted-foreground">
                per-model aggregates · threshold sweep · distribution · contested constructions · extremes
              </span>
            </button>
            {deepDiveOpen && <DeepDive result={result} />}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandableRow({
  rowNumber,
  pair,
  expanded,
  onToggle,
}: {
  rowNumber: number;
  pair: GrammarPairResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const modelCount = pair.models.length;
  return (
    <>
      <tr className="hover:bg-cream/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-2.5 text-center">
          {expanded ? (
            <ChevronDown size={12} className="text-muted-foreground inline" />
          ) : (
            <ChevronRight size={12} className="text-muted-foreground inline" />
          )}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground text-caption">
          {rowNumber}
        </td>
        <td className="px-3 py-2.5 max-w-[360px]">
          <div className="font-medium">{pair.instance.raw}</div>
          <div className="text-caption text-muted-foreground mt-0.5">
            X: &ldquo;{pair.instance.parts[0]}&rdquo; · Y: &ldquo;{pair.instance.parts[1]}&rdquo;
          </div>
        </td>
        {pair.models.map(m => (
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
        <td className="text-right px-3 py-2.5 tabular-nums text-muted-foreground">
          {modelCount > 1 ? pair.crossModelRange.toFixed(3) : "—"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-cream/20">
          <td></td>
          <td colSpan={modelCount + 3} className="px-3 py-3">
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-caption">
                <thead>
                  <tr className="border-b border-parchment">
                    <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="Cosine similarity between X and Y. 1.0 = identical direction; 0.0 = orthogonal."
                    >
                      Cosine
                    </th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="1 − cosine similarity."
                    >
                      Distance
                    </th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="Angular distance in degrees. 0° = identical, 90° = orthogonal, 180° = opposite. The construction claims 180°. The geometry usually delivers a few degrees."
                    >
                      Angular (°)
                    </th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="L2 norm of (x − y). Depends on magnitude as well as direction."
                    >
                      Euclidean
                    </th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="L2 norm of the X vector."
                    >
                      ‖X‖
                    </th>
                    <th
                      className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40"
                      title="L2 norm of the Y vector."
                    >
                      ‖Y‖
                    </th>
                    <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Dims</th>
                    <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {pair.models.map(m => (
                    <tr key={m.modelId}>
                      <td className="px-2 py-1">{m.modelName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.cosineSimilarity.toFixed(4)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.cosineDistance.toFixed(4)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.angularDistance.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.euclideanDistance.toFixed(4)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.normX.toFixed(3)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.normY.toFixed(3)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.dimensions}</td>
                      <td className="px-2 py-1 text-right">
                        {m.oppositionPreserved ? (
                          <span
                            className="text-success-600 font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-success-600/40 underline"
                            title="The cosine sits below the threshold: the geometry registers a distinct lexical field for X and a distinct lexical field for Y. Whether that separation amounts to the antithesis the construction claims is the reader's interpretive move; the cell reports the measurement, not the verdict."
                          >
                            distinct fields
                          </span>
                        ) : (
                          <span
                            className="text-error-600 font-semibold cursor-help decoration-dotted underline underline-offset-2 decoration-error-600/40 underline"
                            title="The cosine sits at or above the threshold: the geometry registers lexical overlap between X and Y. This is the empirical material for the synthetic-dialectic reading — that the rhetorical performance of thesis-and-antithesis runs on a slight rotation between near-neighbours — but the inference from overlap to synthetic-dialectic is the reader's, not the instrument's."
                          >
                            lexical overlap
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Sort pairs by the requested key and direction. Returns pair objects
 * paired with their original index so the UI can keep chevron state
 * consistent across re-sorts.
 */
function getSortedPairs(
  pairs: GrammarPairResult[],
  sortKey: string,
  sortDir: "asc" | "desc"
): Array<{ pair: GrammarPairResult; originalIndex: number }> {
  const indexed = pairs.map((pair, originalIndex) => ({ pair, originalIndex }));
  if (sortKey === "index") {
    if (sortDir === "asc") return indexed;
    return indexed.slice().reverse();
  }
  const sorted = indexed.slice().sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    if (sortKey === "construction") {
      va = a.pair.instance.raw.toLowerCase();
      vb = b.pair.instance.raw.toLowerCase();
    } else if (sortKey === "range") {
      va = a.pair.crossModelRange;
      vb = b.pair.crossModelRange;
    } else {
      // Treat as model id
      const amm = a.pair.models.find(m => m.modelId === sortKey);
      const bmm = b.pair.models.find(m => m.modelId === sortKey);
      va = amm ? amm.cosineSimilarity : 0;
      vb = bmm ? bmm.cosineSimilarity : 0;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

/**
 * Header cell for the per-construction cosines table that handles
 * click-to-sort and a visual indicator for the active sort column.
 */
function SortableTh({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  tip,
}: {
  label: string;
  sortKey: string;
  currentKey: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  align?: "left" | "right";
  tip?: string;
}) {
  const active = sortKey === currentKey;
  const arrow = active ? (currentDir === "asc" ? " \u25B2" : " \u25BC") : "";
  return (
    <th
      onClick={() => onSort(sortKey)}
      title={tip}
      className={`${
        align === "right" ? "text-right" : "text-left"
      } px-3 py-2 text-caption uppercase tracking-wider font-semibold cursor-pointer select-none transition-colors ${
        active ? "text-burgundy" : "text-muted-foreground hover:text-foreground"
      } ${tip ? "decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline" : ""}`}
    >
      {label}
      {arrow}
    </th>
  );
}

function DeepDive({ result }: { result: GrammarOfVectorsResult }) {
  const { modelAggregates, thresholdSweep, cosineDistribution, summary, pairs } = result;
  const maxBucketCount = Math.max(1, ...cosineDistribution.map(b => b.count));

  // Contested constructions: top-5 by cross-model range.
  const contested = [...pairs]
    .filter(p => p.models.length > 1)
    .sort((a, b) => b.crossModelRange - a.crossModelRange)
    .slice(0, 5);

  // Extremes: top-10 most deceptive / preserved by pair mean cosine.
  const byMean = [...pairs].sort((a, b) => b.meanCosine - a.meanCosine);
  const topDeceptive = byMean.slice(0, Math.min(10, byMean.length));
  const topPreserved = byMean.slice(-Math.min(10, byMean.length)).reverse();

  return (
    <div className="px-5 pb-5 pt-1 border-t border-parchment space-y-6">
      {/* Per-model aggregates */}
      <section>
        <h4
          className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
          title="Aggregate statistics per enabled embedding model: count of tested constructions, mean cosine, standard deviation, min / max, preservation rate, and the construction each model rates as most deceptive (highest cosine) and most preserved (lowest cosine). Differences between models here are evidence that the pattern's geometric fate depends partly on training decisions, not only on the construction itself."
        >
          Per-model aggregates
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead>
              <tr className="border-b border-parchment">
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Model</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">N</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Mean</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Std dev</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Min</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Max</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Preserved</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Most deceptive</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Most preserved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {modelAggregates.map(ma => (
                <tr key={ma.modelId}>
                  <td className="px-2 py-1 font-medium">{ma.modelName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ma.pairCount}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ma.meanCosine.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ma.stdDevCosine.toFixed(4)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-success-600">{ma.minCosine.toFixed(3)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-error-600">{ma.maxCosine.toFixed(3)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {ma.preservedCount} / {ma.pairCount} ({(ma.preservedRate * 100).toFixed(0)}%)
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {ma.mostDeceptive ? (
                      <>
                        <span className="text-error-600 tabular-nums mr-1">{ma.mostDeceptive.cosine.toFixed(3)}</span>
                        <span title={ma.mostDeceptive.raw}>{truncate(ma.mostDeceptive.raw, 42)}</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {ma.mostPreserved ? (
                      <>
                        <span className="text-success-600 tabular-nums mr-1">{ma.mostPreserved.cosine.toFixed(3)}</span>
                        <span title={ma.mostPreserved.raw}>{truncate(ma.mostPreserved.raw, 42)}</span>
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Threshold sweep */}
      <section>
        <h4
          className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
          title="Preservation rate at a range of cosine thresholds. Checks how sensitive the overall finding is to the 0.55 default. If preservation flips dramatically around the threshold, the finding is threshold-dependent; if it stays broadly stable across 0.5–0.7, the finding is robust. A flat profile in the 0.6–0.8 band is the signature of genuine syn-dialectic: the similarities are not marginal, they are consistently high."
        >
          Threshold sweep
        </h4>
        <p className="font-sans text-caption text-muted-foreground italic mb-2">
          Preservation rate at varying thresholds. The conclusion is sensitive to the threshold choice only at the tails — typically stable across the 0.5–0.7 range. Values are across all tests (N = {summary.totalTests}).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-caption">
            <thead>
              <tr className="border-b border-parchment">
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Threshold</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Preserved</th>
                <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Rate</th>
                <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {thresholdSweep.map(row => {
                const rateBar = Math.max(2, row.preservedRate * 200);
                const isCurrent = row.threshold === result.threshold;
                return (
                  <tr key={row.threshold} className={isCurrent ? "bg-burgundy/5" : ""}>
                    <td className="px-2 py-1 tabular-nums">
                      {row.threshold.toFixed(2)}
                      {isCurrent && <span className="ml-2 text-burgundy text-[9px] font-semibold uppercase tracking-wider">current</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{row.preservedCount} / {row.totalTests}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{(row.preservedRate * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1">
                      <div className="inline-block h-2 bg-success-500 rounded-sm align-middle" style={{ width: `${rateBar}px` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cosine distribution */}
      <section>
        <h4
          className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
          title="Histogram of every cosine value across every construction and every enabled model, bucketed in 0.1-wide bins over [0, 1]. Clustering above the threshold (red bars) is the visual signature of synthetic dialectic at scale: the rhetoric claims oppositions the geometry doesn't deliver. A distribution concentrated below the threshold (green) would instead indicate that the constructions preserve the antithesis they claim."
        >
          Cosine distribution
        </h4>
        <p className="font-sans text-caption text-muted-foreground italic mb-2">
          All {summary.totalTests} cosine values across every construction × every model, bucketed in 0.1-wide bins. Clustering above the threshold is the signature of synthetic dialectic: the rhetoric claims opposition the geometry doesn&rsquo;t deliver.
        </p>
        <div className="space-y-1">
          {cosineDistribution.map((b, i) => {
            const pct = summary.totalTests > 0 ? (b.count / summary.totalTests) * 100 : 0;
            const aboveThreshold = b.lower >= result.threshold;
            const barWidth = (b.count / maxBucketCount) * 100;
            return (
              <div key={i} className="flex items-center gap-2 font-sans text-caption">
                <span className="w-20 text-muted-foreground tabular-nums text-right">
                  {b.lower.toFixed(1)}–{b.upper.toFixed(1)}
                </span>
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full rounded-sm ${aboveThreshold ? "bg-error-500" : "bg-success-500"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums text-muted-foreground">
                  {b.count} ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contested constructions */}
      {contested.length > 0 && (
        <section>
          <h4
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Top constructions ranked by cross-model range (max cosine minus min cosine). High range = models disagree about whether the antithesis survives in the geometry. Low range = models agree (the agreement itself is evidence — if multiple independently-trained models converge on the same reading, the reading is structural rather than contingent)."
          >
            Most contested constructions
          </h4>
          <p className="font-sans text-caption text-muted-foreground italic mb-2">
            Top {contested.length} constructions by cross-model range — points where the models most disagree about whether the antithesis survives.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full font-sans text-caption">
              <thead>
                <tr className="border-b border-parchment">
                  <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Construction</th>
                  <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Range</th>
                  <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Mean</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment">
                {contested.map((p, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{p.instance.raw}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.crossModelRange.toFixed(4)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.meanCosine.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Extremes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Top constructions ranked by mean cosine across models (highest first). These are the constructions where the rhetoric of opposition most exceeds the cosine reality — the clearest cases of syn-dialectic in this run."
          >
            Most deceptive ({topDeceptive.length})
          </h4>
          <table className="w-full font-sans text-caption">
            <tbody className="divide-y divide-parchment">
              {topDeceptive.map((p, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">{p.instance.raw}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-error-600 font-semibold">
                    {p.meanCosine.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2 cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Top constructions ranked by mean cosine across models (lowest first). These are the constructions where the geometry preserves the antithesis the rhetoric claims — cases where 'not X but Y' does what it says."
          >
            Most preserved ({topPreserved.length})
          </h4>
          <table className="w-full font-sans text-caption">
            <tbody className="divide-y divide-parchment">
              {topPreserved.map((p, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">{p.instance.raw}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-success-600 font-semibold">
                    {p.meanCosine.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  hint,
  tip,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  /** Hover explanation, rendered via the native title attribute with a dotted-underline cursor-help affordance. */
  tip?: string;
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
      <div
        title={tip}
        className={`font-sans text-caption text-muted-foreground uppercase tracking-wider ${
          tip ? "cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block" : ""
        }`}
      >
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

/**
 * Spearman findings card. Rendered only for bundle runs. The headline
 * is the mean rho across probes: high positive = the LLM's top-
 * probability Ys are also the embedding model's nearest neighbours of
 * X, i.e. the construction has collapsed into a geometric reflex.
 * Near-zero or negative = the rhetoric is doing work beyond nearest-
 * neighbour retrieval.
 */
function BundleFindingsCard({
  findings,
  bundle,
}: {
  findings: BundleFindings;
  bundle: GrammarProbeBundle | null;
}) {
  const rhoTone =
    findings.overallMeanRho >= 0.5
      ? "error"
      : findings.overallMeanRho <= -0.3
      ? "success"
      : "warning";
  const rhoColor = {
    error: "text-error-600",
    warning: "text-warning-500",
    success: "text-success-600",
    neutral: "",
  }[rhoTone];

  return (
    <div className="card-editorial p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-display text-body-lg font-bold">Bundle findings</h3>
          <p className="font-sans text-caption text-muted-foreground italic">
            Spearman rank correlation between LLM logprob rank and embedding cosine rank.
            {bundle && (
              <>
                {" "}Bundle: {bundle.pattern.label} from {bundle.source.tool} {bundle.source.version}, generator model {bundle.model.displayName ?? bundle.model.name}.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-muted rounded-sm p-3">
          <div
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Mean of per-probe Spearman rho values, where each probe's rho is itself the mean across enabled embedding models. Values close to +1 indicate the construction has collapsed into a geometric reflex: the LLM's top-probability Ys are also the nearest-neighbour Ys of X. Values close to 0 indicate the construction is doing rhetorical work beyond nearest-neighbour retrieval. Values close to -1 indicate the construction actively inverts geometric proximity."
          >
            Mean rho
          </div>
          <div className={`font-sans text-body-lg font-bold mt-1 tabular-nums ${rhoColor}`}>
            {findings.overallMeanRho.toFixed(3)}
          </div>
          <div className="font-sans text-caption text-muted-foreground mt-0.5">
            across {findings.totalProbes} probe{findings.totalProbes === 1 ? "" : "s"}
          </div>
        </div>
        <div className="bg-muted rounded-sm p-3">
          <div
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Probes where mean rho ≥ 0.5 — the LLM's continuation preferences track embedding proximity closely. The construction, in these probes, is a nearest-neighbour lookup dressed in antithetical clothing."
          >
            Reflex
          </div>
          <div className="font-sans text-body-lg font-bold mt-1 tabular-nums text-error-600">
            {findings.reflexCount}
          </div>
          <div className="font-sans text-caption text-muted-foreground mt-0.5">
            rho ≥ 0.5
          </div>
        </div>
        <div className="bg-muted rounded-sm p-3">
          <div
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Probes where |mean rho| < 0.2 — the LLM's ranked continuations bear no strong monotonic relationship to cosine proximity. The rhetorical scaffold is doing work that pure nearest-neighbour retrieval cannot explain."
          >
            Rhetorical
          </div>
          <div className="font-sans text-body-lg font-bold mt-1 tabular-nums text-warning-500">
            {findings.rhetoricalCount}
          </div>
          <div className="font-sans text-caption text-muted-foreground mt-0.5">
            |rho| &lt; 0.2
          </div>
        </div>
        <div className="bg-muted rounded-sm p-3">
          <div
            className="font-sans text-caption text-muted-foreground uppercase tracking-wider cursor-help decoration-dotted underline underline-offset-2 decoration-muted-foreground/40 underline inline-block"
            title="Probes where mean rho ≤ -0.5 — the LLM consistently reaches for Ys that are geometrically far from X. The construction, in these cases, is actively inverting cosine proximity."
          >
            Inverted
          </div>
          <div className="font-sans text-body-lg font-bold mt-1 tabular-nums text-success-600">
            {findings.invertedCount}
          </div>
          <div className="font-sans text-caption text-muted-foreground mt-0.5">
            rho ≤ -0.5
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-sans text-caption">
          <thead>
            <tr className="border-b border-parchment">
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                Scaffold
              </th>
              <th className="text-left px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                X
              </th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                n
              </th>
              <th className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                Mean rho
              </th>
              {findings.perProbe[0]?.spearmanPerModel.map(m => (
                <th
                  key={m.modelId}
                  className="text-right px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold"
                  title={`Spearman rho for ${m.modelName}.`}
                >
                  {m.modelName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-parchment">
            {findings.perProbe.map(p => (
              <tr key={p.scaffoldId}>
                <td className="px-2 py-1 font-mono text-muted-foreground" title={p.scaffold}>
                  {p.scaffoldId}
                </td>
                <td className="px-2 py-1">{p.x}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.n}</td>
                <td
                  className={`px-2 py-1 text-right tabular-nums font-semibold ${rhoClass(p.meanRho)}`}
                >
                  {p.meanRho.toFixed(3)}
                </td>
                {p.spearmanPerModel.map(m => (
                  <td
                    key={m.modelId}
                    className={`px-2 py-1 text-right tabular-nums ${rhoClass(m.rho)}`}
                  >
                    {m.rho.toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-body text-body-sm text-slate italic">
        Read: high positive rho means the construction has collapsed into a nearest-neighbour
        reflex — the LLM&rsquo;s top-probability Ys for a &ldquo;{bundle?.pattern.label ?? "scaffolded"}&rdquo;
        completion coincide with the embedding model&rsquo;s nearest neighbours of X. Values
        near zero mean the construction is performing rhetorical work (antithesis, emphasis,
        correction) that the geometry does not underwrite.
      </p>
    </div>
  );
}

function rhoClass(rho: number): string {
  if (rho >= 0.5) return "text-error-600";
  if (rho <= -0.5) return "text-success-600";
  if (Math.abs(rho) < 0.2) return "text-warning-500";
  return "";
}

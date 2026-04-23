"use client";

/**
 * Manifold Atlas — Protocol Runner.
 *
 * The fourth operation group. Loads protocol definitions from
 * /public/protocols/, lets the user pick one, batch-fetches every
 * embedding required by the protocol, iterates steps through their
 * pure compute functions, and renders collapsible result cards.
 *
 * Scheduled for v0.10.0. Currently wired for the "distance" operation
 * only; remaining operations follow in the progressive refactor.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileType,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Workflow,
  BookOpen,
  Plus,
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useEmbedAll } from "@/components/shared/useEmbedAll";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { ResetButton } from "@/components/shared/ResetButton";
import { loadAllProtocols } from "@/lib/protocols/parser";
import { collectProtocolTexts, vectorsForStep } from "@/lib/protocols/inputs";
import { executeStep } from "@/lib/protocols/execute";
import {
  loadCustomProtocols,
  removeCustomProtocol,
  type CustomProtocol,
} from "@/lib/protocols/custom";
import { AddProtocolModal } from "@/components/operations/AddProtocolModal";
import type {
  Protocol,
  ProtocolRun,
  ProtocolStepResult,
  ProtocolCategory,
} from "@/types/protocols";
import { VERSION } from "@/lib/version";
import type { TabId } from "@/components/layout/TabNav";
import { ProtocolStepDeepDive } from "@/components/operations/ProtocolStepDeepDive";
import { ProtocolStepEditor } from "@/components/operations/ProtocolStepEditor";
import type { ProtocolStep } from "@/types/protocols";

type ProtocolSubTab = "library" | "run";

interface ProtocolRunnerProps {
  onQueryTime: (time: number) => void;
  subTab: ProtocolSubTab;
  /**
   * Called for all tab changes, not just the Library/Run sub-tabs.
   * Receiving any TabId lets the Runner open a step's full operation
   * view via the deep-link on each result card.
   */
  onSubTabChange: (tab: TabId) => void;
}

/** Tab labels for the "Open in X tab" links on step cards. */
const OPERATION_LABELS: Partial<Record<TabId, string>> = {
  distance: "Concept Distance",
  matrix: "Distance Matrix",
  negation: "Negation Gauge",
  battery: "Negation Battery",
  neighbourhood: "Neighbourhood",
  sectioning: "Semantic Sectioning",
  drift: "Vector Drift",
  walk: "Vector Walk",
  textvec: "Text Vectorisation",
  compass: "Hegemony Compass",
  abstraction: "Real Abstraction",
  silence: "Silence Detector",
  agonism: "Agonism Test",
  analogy: "Vector Logic",
  topology: "Persistent Homology",
};

const CATEGORY_LABEL: Record<ProtocolCategory, string> = {
  workshop: "Workshop",
  research: "Research",
  demo: "Demo",
};

const CATEGORY_COLOUR: Record<ProtocolCategory, string> = {
  workshop: "bg-burgundy/10 text-burgundy",
  research: "bg-gold/20 text-gold-900",
  demo: "bg-muted text-muted-foreground",
};

export function ProtocolRunner({ onQueryTime, subTab, onSubTabChange }: ProtocolRunnerProps) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomProtocol | null>(null);

  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<unknown>(null);
  const [run, setRun] = useState<ProtocolRun | null>(null);
  // All step panels are expanded by default after a run; the user can
  // collapse individual cards to make the run easier to scan.
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  // Per-step input overrides. Keyed by step index. A step is "edited"
  // iff it has an entry here; entries are merged over the step's
  // defaults at run time.
  const [editedInputs, setEditedInputs] = useState<Record<number, Record<string, unknown>>>({});
  const [editorOpen, setEditorOpen] = useState(false);

  const { getEnabledModels } = useSettings();
  const embedAll = useEmbedAll();

  // Load library on mount: built-in protocols merged with user-added
  // ones stored in localStorage.
  useEffect(() => {
    let cancelled = false;
    loadAllProtocols()
      .then(list => {
        if (cancelled) return;
        const custom = loadCustomProtocols();
        setProtocols([...list, ...custom]);
        setLoadingLibrary(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLibraryError(err instanceof Error ? err.message : String(err));
        setLoadingLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCustomSaved = (protocol: CustomProtocol) => {
    setProtocols(prev => {
      // If we were editing, replace by id; otherwise append.
      const existing = prev.findIndex(p => p.id === protocol.id);
      if (existing >= 0) {
        const next = prev.slice();
        next[existing] = protocol;
        return next;
      }
      // If the id changed during edit, drop the old entry.
      if (editingCustom && editingCustom.id !== protocol.id) {
        return [...prev.filter(p => p.id !== editingCustom.id), protocol];
      }
      return [...prev, protocol];
    });
    if (activeProtocol && editingCustom && activeProtocol.id === editingCustom.id) {
      // Keep the active protocol in sync if the user edited the one
      // currently open in the Run view.
      setActiveProtocol(protocol);
    }
    setEditingCustom(null);
  };

  const openEditCustom = (protocol: CustomProtocol) => {
    setEditingCustom(protocol);
    setAddModalOpen(true);
  };

  const handleRemoveCustom = (id: string) => {
    if (!confirm(`Remove the custom protocol "${id}" from the Library? Built-in protocols are not affected.`)) return;
    removeCustomProtocol(id);
    setProtocols(prev => prev.filter(p => p.id !== id));
    if (activeProtocol?.id === id) {
      setActiveProtocol(null);
      setRun(null);
      onSubTabChange("library");
    }
  };

  const grouped = useMemo(() => {
    const g: Record<ProtocolCategory, Protocol[]> = {
      workshop: [],
      research: [],
      demo: [],
    };
    for (const p of protocols) g[p.category].push(p);
    return g;
  }, [protocols]);

  const handleSelectProtocol = (protocol: Protocol) => {
    setActiveProtocol(protocol);
    setRun(null);
    setRunError(null);
    setExpandedSteps(new Set());
    setEditedInputs({});
    setEditorOpen(false);
    onSubTabChange("run");
  };

  /**
   * Apply edits to a protocol, returning a new Protocol whose steps
   * carry merged inputs. Used before collecting texts and executing.
   */
  const applyEdits = (protocol: Protocol): Protocol => ({
    ...protocol,
    steps: protocol.steps.map((step, i): ProtocolStep => {
      const edits = editedInputs[i];
      if (!edits) return step;
      return { ...step, inputs: { ...step.inputs, ...edits } };
    }),
  });

  const handleStepEdit = (stepIndex: number, patch: Record<string, unknown> | null) => {
    setEditedInputs(prev => {
      const next = { ...prev };
      if (patch === null || Object.keys(patch).length === 0) {
        delete next[stepIndex];
      } else {
        next[stepIndex] = patch;
      }
      return next;
    });
  };

  const resetAllEdits = () => setEditedInputs({});

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  /**
   * Hand off to an operation's full tab. Stashes the step's inputs in
   * sessionStorage under a per-operation key so the operation tab can
   * pre-fill itself on mount. Tabs that don't yet read the stash will
   * simply ignore it; no regression.
   */
  const handleOpenInOperation = (step: ProtocolStepResult) => {
    try {
      const key = `manifold-atlas.prefill.${step.step.operation}`;
      sessionStorage.setItem(key, JSON.stringify(step.step.inputs));
    } catch {
      // sessionStorage can be disabled; the tab switch still works.
    }
    onSubTabChange(step.step.operation);
  };

  const handleRun = useCallback(async () => {
    if (!activeProtocol) return;
    setRunning(true);
    setRunError(null);
    setExpandedSteps(new Set());
    const overallStart = performance.now();
    const startedAt = new Date().toISOString();

    try {
      const enabledModels = getEnabledModels();
      const effective = applyEdits(activeProtocol);
      const texts = collectProtocolTexts(effective);

      // Batched embedding across all steps' inputs, all models
      const modelVectors = await embedAll(texts);

      // Build a text→index map for slicing per step
      const textIndex = new Map<string, number>();
      texts.forEach((t, i) => textIndex.set(t, i));

      // Execute each step with the relevant slice of vectors. Uses
      // the effective (edit-merged) steps so user tweaks take effect.
      const stepResults: ProtocolStepResult[] = [];
      for (let i = 0; i < effective.steps.length; i++) {
        const step = effective.steps[i];
        const stepVectors = vectorsForStep(step, textIndex, modelVectors);
        if (stepVectors === null) {
          stepResults.push({
            stepIndex: i,
            step,
            status: "skipped",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            elapsedMs: 0,
            models: [],
            error: "Inputs could not be resolved to pre-fetched embeddings.",
          });
          continue;
        }
        const result = executeStep(step, {
          stepIndex: i,
          stepVectors,
          enabledModels,
        });
        stepResults.push(result);
      }

      const totalElapsedMs = performance.now() - overallStart;
      const completedAt = new Date().toISOString();

      const newRun: ProtocolRun = {
        protocolId: effective.id,
        protocolTitle: effective.title,
        startedAt,
        completedAt,
        totalElapsedMs,
        models: enabledModels.map(m => ({ id: m.id, name: m.name, providerId: m.providerId })),
        steps: stepResults,
        stats: {
          totalQueries: texts.length * enabledModels.length,
          // Cache hits/misses are not yet instrumented at this level; leave 0/0 for now.
          cacheHits: 0,
          cacheMisses: 0,
          embeddedTexts: texts.length,
        },
        atlasVersion: VERSION,
      };
      setRun(newRun);
      // Expand every step by default so all results are visible; the
      // user can collapse individual cards to scan a long run.
      setExpandedSteps(new Set(stepResults.map((_, i) => i)));
      onQueryTime(totalElapsedMs / 1000);
    } catch (err) {
      setRunError(err);
    } finally {
      setRunning(false);
    }
  }, [activeProtocol, editedInputs, embedAll, getEnabledModels, onQueryTime]);

  const handleReset = () => {
    setRun(null);
    setRunError(null);
    setExpandedSteps(new Set());
    setEditedInputs({});
  };

  const exportMarkdown = () => {
    if (!run || !activeProtocol) return;
    const lines: string[] = [];
    lines.push(`# ${activeProtocol.title}`);
    lines.push("");
    lines.push(`*${activeProtocol.description}*`);
    lines.push("");
    lines.push(`**Run:** ${run.startedAt}  `);
    lines.push(`**Elapsed:** ${(run.totalElapsedMs! / 1000).toFixed(2)}s  `);
    lines.push(`**Atlas:** v${run.atlasVersion}  `);
    lines.push(`**Models:** ${run.models.map(m => m.name).join(", ")}  `);
    lines.push("");
    run.steps.forEach((s, i) => {
      lines.push(`## ${i + 1}. ${s.step.label || s.step.operation}`);
      lines.push("");
      if (s.status === "done" && s.headline) {
        lines.push("| metric | value |");
        lines.push("| --- | --- |");
        for (const [k, v] of Object.entries(s.headline)) {
          lines.push(`| ${k} | ${v} |`);
        }
      } else {
        lines.push(`_Status: ${s.status}${s.error ? ` — ${s.error}` : ""}_`);
      }
      lines.push("");
    });
    downloadText(
      `${activeProtocol.id}-${Date.now()}.md`,
      lines.join("\n"),
      "text/markdown"
    );
  };

  const exportJson = () => {
    if (!run || !activeProtocol) return;
    const bundle = {
      protocol: activeProtocol,
      run,
    };
    downloadText(
      `${activeProtocol.id}-${Date.now()}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json"
    );
  };

  const exportPdf = async () => {
    if (!run || !activeProtocol) return;
    const { exportRunAsPDF } = await import("@/lib/protocols/export-pdf");
    try {
      await exportRunAsPDF(run, activeProtocol);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const exportCsv = () => {
    if (!run || !activeProtocol) return;
    const rows: string[] = ["step_index,step_label,operation,status,metric,value"];
    run.steps.forEach((s, i) => {
      const label = (s.step.label || s.step.operation).replace(/"/g, '""');
      if (s.headline) {
        for (const [k, v] of Object.entries(s.headline)) {
          rows.push(`${i + 1},"${label}",${s.step.operation},${s.status},"${k}",${String(v)}`);
        }
      } else {
        rows.push(`${i + 1},"${label}",${s.step.operation},${s.status},,`);
      }
    });
    downloadText(
      `${activeProtocol.id}-${Date.now()}.csv`,
      rows.join("\n"),
      "text/csv"
    );
  };

  // ---------- Render ----------

  if (subTab === "library") {
    return (
      <div className="space-y-6">
        <div className="card-editorial p-6">
          <div className="flex items-start justify-between mb-1 gap-4">
            <h2 className="font-display text-display-md font-bold">Library</h2>
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn-editorial-secondary flex items-center gap-1"
            >
              <Plus size={14} />
              Add Test
            </button>
          </div>
          <p className="font-sans text-body-sm text-slate">
            Curated sequences of operations, ready to run in one click. Each
            protocol tests a specific claim from the vector theory framework
            and produces an exportable report. Designed for workshops and
            research reproducibility. Add your own markdown-defined tests via
            the button above — they persist in this browser and appear
            alongside the built-in protocols.
          </p>
        </div>

        <AddProtocolModal
          open={addModalOpen}
          onClose={() => {
            setAddModalOpen(false);
            setEditingCustom(null);
          }}
          existingIds={protocols.map(p => p.id)}
          allProtocols={protocols}
          editing={editingCustom}
          onSaved={handleCustomSaved}
        />

        {loadingLibrary && (
          <div className="card-editorial p-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-sans text-body-sm">Loading protocol library...</span>
          </div>
        )}

        {libraryError && (
          <div className="card-editorial p-6 text-error-700">
            <p className="font-sans text-body-sm">
              Could not load protocols: {libraryError}
            </p>
          </div>
        )}

        {!loadingLibrary &&
          !libraryError &&
          (Object.keys(grouped) as ProtocolCategory[]).map(cat => {
            const list = grouped[cat];
            if (list.length === 0) return null;
            return (
              <div key={cat} className="space-y-3">
                <h3 className="font-display text-body-lg font-bold text-slate uppercase tracking-wider">
                  {CATEGORY_LABEL[cat]}
                </h3>
                {list.map(p => {
                  const isCustom = (p as CustomProtocol).isCustom === true;
                  return (
                    <div key={p.id} className="card-editorial p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-display text-body-lg font-bold">{p.title}</h4>
                            <span
                              className={`font-sans text-caption uppercase tracking-wider px-2 py-0.5 rounded-sm ${CATEGORY_COLOUR[p.category]}`}
                            >
                              {CATEGORY_LABEL[p.category]}
                            </span>
                            {isCustom && (
                              <span className="font-sans text-caption uppercase tracking-wider px-2 py-0.5 rounded-sm bg-burgundy/10 text-burgundy">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="font-sans text-body-sm text-slate">
                            {p.description}
                          </p>
                          <div className="mt-2 flex items-center gap-4 font-sans text-caption text-muted-foreground">
                            <span>{p.steps.length} steps</span>
                            {p.estimatedQueries !== undefined && (
                              <span>~{p.estimatedQueries} embeddings</span>
                            )}
                            {p.readingLink && (
                              <a
                                href={p.readingLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-burgundy hover:text-burgundy-900 underline underline-offset-2"
                              >
                                <BookOpen size={11} />
                                {p.readingLink.label}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {isCustom && (
                            <>
                              <button
                                onClick={() => openEditCustom(p as CustomProtocol)}
                                className="btn-editorial-ghost text-caption"
                                title="Edit this custom protocol's markdown"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleRemoveCustom(p.id)}
                                className="btn-editorial-ghost text-caption"
                                title="Remove this custom protocol from the Library"
                              >
                                Remove
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleSelectProtocol(p)}
                            className="btn-editorial-primary flex items-center gap-1"
                          >
                            <Play size={14} />
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    );
  }

  // subTab === "run"

  if (!activeProtocol) {
    return (
      <div className="card-editorial p-6">
        <p className="font-sans text-body-sm text-slate mb-3">
          No protocol selected. Open the Library to pick one.
        </p>
        <button
          onClick={() => onSubTabChange("library")}
          className="btn-editorial-primary"
        >
          Go to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-start justify-between mb-1 gap-4">
          <div>
            <h2 className="font-display text-display-md font-bold">{activeProtocol.title}</h2>
            <p className="font-sans text-body-sm text-slate mt-1">
              {activeProtocol.description}
            </p>
            <div className="mt-2 flex items-center gap-4 font-sans text-caption text-muted-foreground">
              <span
                className={`uppercase tracking-wider px-2 py-0.5 rounded-sm ${CATEGORY_COLOUR[activeProtocol.category]}`}
              >
                {CATEGORY_LABEL[activeProtocol.category]}
              </span>
              <span>{activeProtocol.steps.length} steps</span>
              {activeProtocol.estimatedQueries !== undefined && (
                <span>~{activeProtocol.estimatedQueries} embeddings</span>
              )}
            </div>
          </div>
          <ResetButton onReset={handleReset} />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-editorial-primary flex items-center gap-1 disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? "Running..." : "Run Protocol"}
          </button>
          <button
            onClick={() => setEditorOpen(v => !v)}
            className="btn-editorial-ghost flex items-center gap-1"
          >
            {editorOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {editorOpen ? "Hide step inputs" : "Edit step inputs"}
            {Object.keys(editedInputs).length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-sm bg-burgundy/10 text-burgundy text-[10px] font-semibold uppercase tracking-wider">
                {Object.keys(editedInputs).length} edited
              </span>
            )}
          </button>
          {Object.keys(editedInputs).length > 0 && (
            <button
              onClick={resetAllEdits}
              className="btn-editorial-ghost text-caption"
              title="Discard all step edits, restore protocol defaults"
            >
              Reset all edits
            </button>
          )}
          <button
            onClick={() => onSubTabChange("library")}
            className="btn-editorial-ghost ml-auto"
          >
            Back to Library
          </button>
        </div>
      </div>

      {editorOpen && (
        <div className="space-y-3">
          <p className="font-sans text-caption text-muted-foreground">
            Tweak any step's inputs before running. Substitute your own claims,
            swap the anchors in a sectioning walk, or change the A − B + C terms.
            Edits are applied on the next Run and discarded when you leave this
            protocol.
          </p>
          {activeProtocol.steps.map((step, i) => (
            <ProtocolStepEditor
              key={i}
              step={step}
              stepIndex={i}
              edits={editedInputs[i]}
              onChange={patch => handleStepEdit(i, patch)}
            />
          ))}
        </div>
      )}

      {runError != null && <ErrorDisplay error={runError} onRetry={handleRun} />}

      {run && (
        <>
          <div className="card-editorial p-4">
            <div className="flex items-center gap-4 font-sans text-caption text-muted-foreground">
              <span>
                Completed in{" "}
                <span className="tabular-nums font-semibold text-foreground">
                  {(run.totalElapsedMs! / 1000).toFixed(2)}s
                </span>
              </span>
              <span>
                <span className="tabular-nums font-semibold text-foreground">
                  {run.stats.embeddedTexts}
                </span>{" "}
                unique texts across{" "}
                <span className="tabular-nums font-semibold text-foreground">
                  {run.models.length}
                </span>{" "}
                models
              </span>
              <span>
                <span className="tabular-nums font-semibold text-foreground">
                  {run.stats.totalQueries}
                </span>{" "}
                total queries
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={exportPdf}
                className="btn-editorial-ghost flex items-center gap-1"
                title="Export a full research-oriented PDF: metadata, deep-dive tables, Hegemony Compass images."
              >
                <FileType size={14} />
                PDF
              </button>
              <button onClick={exportMarkdown} className="btn-editorial-ghost flex items-center gap-1">
                <FileText size={14} />
                Markdown
              </button>
              <button onClick={exportJson} className="btn-editorial-ghost flex items-center gap-1">
                <FileJson size={14} />
                JSON
              </button>
              <button onClick={exportCsv} className="btn-editorial-ghost flex items-center gap-1">
                <FileSpreadsheet size={14} />
                CSV
              </button>
            </div>
          </div>

          {run.steps.map((s, i) => {
            const expanded = expandedSteps.has(i);
            const label = s.step.label || s.step.operation;
            const opLabel = OPERATION_LABELS[s.step.operation] ?? s.step.operation;
            return (
              <div key={i} className="card-editorial overflow-hidden">
                <button
                  onClick={() => toggleStep(i)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-cream/50 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-sans text-caption text-muted-foreground tabular-nums w-6 text-right">
                    {i + 1}.
                  </span>
                  <StepStatusIcon status={s.status} />
                  <span className="font-sans text-body-sm font-semibold flex-1 text-left">
                    {label}
                  </span>
                  <span className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                    {s.step.operation}
                  </span>
                  {s.elapsedMs !== undefined && s.status === "done" && (
                    <span className="font-sans text-caption text-muted-foreground tabular-nums">
                      {s.elapsedMs < 1000
                        ? `${s.elapsedMs.toFixed(0)}ms`
                        : `${(s.elapsedMs / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </button>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-parchment space-y-4">
                    {s.error && (
                      <p className="pt-3 font-sans text-body-sm text-error-700">
                        {s.error}
                      </p>
                    )}
                    {s.status === "done" && s.headline && (
                      <div className="pt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(s.headline).map(([k, v]) => (
                          <div key={k} className="bg-muted rounded-sm p-3">
                            <div className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
                              {k}
                            </div>
                            <div className="font-sans text-body-lg font-bold tabular-nums mt-1">
                              {String(v)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Deep dive: full per-model / per-step tabular data */}
                    {s.status === "done" && s.details != null && (
                      <div className="pt-1 border-t border-parchment">
                        <div className="pt-3 font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                          Deep Dive
                        </div>
                        <ProtocolStepDeepDive step={s} />
                      </div>
                    )}

                    {s.status === "done" && (
                      <div className="pt-1 flex items-center">
                        <button
                          onClick={() => handleOpenInOperation(s)}
                          className="flex items-center gap-1.5 font-sans text-caption text-burgundy hover:text-burgundy-900 underline underline-offset-2"
                          title={`Open this step in the ${opLabel} tab with inputs pre-filled`}
                        >
                          <ExternalLink size={12} />
                          Open in {opLabel} tab
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function StepStatusIcon({ status }: { status: ProtocolStepResult["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={14} className="text-success-600 flex-shrink-0" />;
    case "error":
      return <XCircle size={14} className="text-error-600 flex-shrink-0" />;
    case "skipped":
      return <MinusCircle size={14} className="text-muted-foreground flex-shrink-0" />;
    case "running":
      return <Loader2 size={14} className="text-burgundy flex-shrink-0 animate-spin" />;
    default:
      return <Workflow size={14} className="text-muted-foreground flex-shrink-0" />;
  }
}

function downloadText(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


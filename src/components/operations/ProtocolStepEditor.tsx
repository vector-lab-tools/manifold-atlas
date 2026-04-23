"use client";

/**
 * Protocol Step Editor.
 *
 * For each step in the active protocol, renders an editable view of
 * the step's resolved inputs. Users can tweak the values before running
 * — e.g. substitute their own list of statements into a Negation
 * Battery, or change the anchors in a Semantic Sectioning walk —
 * without leaving the Runner.
 *
 * This deliberately widens the tool's use: protocols ship as curated
 * defaults, but every list / term / statement is a starting point.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ProtocolStep } from "@/types/protocols";
import type { TabId } from "@/components/layout/TabNav";
import {
  NEGATION_BATTERIES,
  resolveNegationBatteryPreset,
} from "@/lib/operations/negation-battery";
import { loadUserBatteries } from "@/lib/operations/user-batteries";
import { AGONISM_PAIRS, type AgonismPair } from "@/lib/operations/agonism-test";
import { COMPASS_PRESETS } from "@/lib/operations/hegemony-compass";

/** Tab labels for the section headers. */
const OPERATION_LABEL: Partial<Record<TabId, string>> = {
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

export interface StepEditorProps {
  step: ProtocolStep;
  stepIndex: number;
  /** Current overrides for this step (partial). */
  edits: Record<string, unknown> | undefined;
  /** Called with the next edits patch; null to clear. */
  onChange: (patch: Record<string, unknown> | null) => void;
}

/**
 * Return the effective input value for a given key: the edit if
 * present, otherwise the step default.
 */
function eff<T>(step: ProtocolStep, edits: Record<string, unknown> | undefined, key: string, fallback: T): T {
  if (edits && key in edits) return edits[key] as T;
  if (key in step.inputs) return step.inputs[key] as T;
  return fallback;
}

// --- Entry point ---------------------------------------------------

export function ProtocolStepEditor({ step, stepIndex, edits, onChange }: StepEditorProps) {
  const label = step.label ?? OPERATION_LABEL[step.operation] ?? step.operation;
  const edited = edits !== undefined;

  const body = useMemo(() => {
    switch (step.operation) {
      case "distance":
        return <DistanceEditor step={step} edits={edits} onChange={onChange} />;
      case "analogy":
        return <AnalogyEditor step={step} edits={edits} onChange={onChange} />;
      case "negation":
        return <NegationEditor step={step} edits={edits} onChange={onChange} />;
      case "sectioning":
        return <SectioningEditor step={step} edits={edits} onChange={onChange} />;
      case "battery":
        return <BatteryEditor step={step} edits={edits} onChange={onChange} />;
      case "agonism":
        return <AgonismEditor step={step} edits={edits} onChange={onChange} />;
      case "compass":
        return <CompassEditor step={step} edits={edits} onChange={onChange} />;
      case "matrix":
        return <MatrixEditor step={step} edits={edits} onChange={onChange} />;
      default:
        return (
          <p className="font-sans text-caption text-muted-foreground italic">
            This operation is not yet editable from the Runner. (It may not be wired to the Runner at all — see the step status for details.)
          </p>
        );
    }
  }, [step, edits, onChange]);

  return (
    <div className="card-editorial overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-parchment">
        <span className="font-sans text-caption text-muted-foreground tabular-nums w-6 text-right">
          {stepIndex + 1}.
        </span>
        <span className="font-sans text-body-sm font-semibold flex-1 text-left">
          {label}
        </span>
        <span className="font-sans text-caption text-muted-foreground uppercase tracking-wider">
          {step.operation}
        </span>
        {edited && (
          <>
            <span className="font-sans text-caption text-burgundy uppercase tracking-wider font-semibold">
              Edited
            </span>
            <button
              onClick={() => onChange(null)}
              title="Reset this step to its protocol defaults"
              className="btn-editorial-ghost px-2 py-1 flex items-center gap-1 text-caption"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </>
        )}
      </div>
      <div className="px-4 py-3">{body}</div>
    </div>
  );
}

// --- Shared atoms --------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
      {children}
    </label>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-editorial text-body-sm w-full"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="input-editorial text-body-sm w-full resize-y font-mono"
    />
  );
}

// --- Per-operation editors -----------------------------------------

function DistanceEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const termA = eff(step, edits, "termA", "");
  const termB = eff(step, edits, "termB", "");
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Term A</FieldLabel>
        <TextField value={termA} onChange={v => onChange({ ...(edits ?? {}), termA: v })} />
      </div>
      <div>
        <FieldLabel>Term B</FieldLabel>
        <TextField value={termB} onChange={v => onChange({ ...(edits ?? {}), termB: v })} />
      </div>
    </div>
  );
}

function AnalogyEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const termA = eff(step, edits, "termA", "");
  const termB = eff(step, edits, "termB", "");
  const termC = eff(step, edits, "termC", "");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>A</FieldLabel>
          <TextField value={termA} onChange={v => onChange({ ...(edits ?? {}), termA: v })} />
        </div>
        <div>
          <FieldLabel>B (subtract)</FieldLabel>
          <TextField value={termB} onChange={v => onChange({ ...(edits ?? {}), termB: v })} />
        </div>
        <div>
          <FieldLabel>C (add)</FieldLabel>
          <TextField value={termC} onChange={v => onChange({ ...(edits ?? {}), termC: v })} />
        </div>
      </div>
      <p className="font-sans text-caption text-muted-foreground">
        Computed: <span className="text-foreground font-medium">{termA || "A"} − {termB || "B"} + {termC || "C"}</span>
      </p>
    </div>
  );
}

function NegationEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const statement = eff(step, edits, "statement", "");
  return (
    <div>
      <FieldLabel>Statement</FieldLabel>
      <TextArea
        value={statement}
        onChange={v => onChange({ ...(edits ?? {}), statement: v })}
        rows={2}
        placeholder="This policy is fair"
      />
      <p className="mt-2 font-sans text-caption text-muted-foreground italic">
        The negation is auto-generated rule-based; edits to the statement produce a new negation on the next run.
      </p>
    </div>
  );
}

function SectioningEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const anchorA = eff(step, edits, "anchorA", "");
  const anchorB = eff(step, edits, "anchorB", "");
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Anchor A (t = 0)</FieldLabel>
        <TextField value={anchorA} onChange={v => onChange({ ...(edits ?? {}), anchorA: v })} />
      </div>
      <div>
        <FieldLabel>Anchor B (t = 1)</FieldLabel>
        <TextField value={anchorB} onChange={v => onChange({ ...(edits ?? {}), anchorB: v })} />
      </div>
    </div>
  );
}

function BatteryEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  // Hydrate user batteries once so they appear in the preset dropdown.
  const [userBatteries, setUserBatteries] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setUserBatteries(loadUserBatteries());
  }, []);

  // Resolve the default statement list: either preset or inline.
  const stepPreset = typeof step.inputs.preset === "string" ? step.inputs.preset : undefined;
  const defaultList: string[] = useMemo(() => {
    if (Array.isArray(step.inputs.statements)) {
      return (step.inputs.statements as unknown[]).filter(
        (s): s is string => typeof s === "string"
      );
    }
    return resolveNegationBatteryPreset(stepPreset) ?? [];
  }, [step.inputs, stepPreset]);

  // Use edited statements if present; otherwise the default list.
  const currentList: string[] = Array.isArray(edits?.statements)
    ? (edits!.statements as string[])
    : defaultList;
  const text = currentList.join("\n");

  const handleChange = (v: string) => {
    const list = v
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
    // Always store as an explicit list when the user edits. Drop the
    // preset reference so the edited list takes effect.
    const nextEdits: Record<string, unknown> = { ...(edits ?? {}), statements: list };
    if ("preset" in nextEdits) delete nextEdits.preset;
    onChange(nextEdits);
  };

  const builtInNames = Object.keys(NEGATION_BATTERIES);
  const userNames = Object.keys(userBatteries);
  const showDropdown = stepPreset !== undefined;

  return (
    <div className="space-y-2">
      {showDropdown && (
        <div className="flex items-center gap-2 font-sans text-caption text-muted-foreground flex-wrap">
          <span>Preset:</span>
          <select
            value={stepPreset}
            onChange={e => {
              const name = e.target.value;
              const list = resolveNegationBatteryPreset(name) ?? [];
              // Switch preset and load its default list into edits.
              onChange({ ...(edits ?? {}), preset: name, statements: list });
            }}
            className="input-editorial text-caption py-1 px-2 w-auto"
          >
            <optgroup label="Built-in">
              {builtInNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>
            {userNames.length > 0 && (
              <optgroup label="Your saved batteries">
                {userNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <span>({currentList.length} statements)</span>
        </div>
      )}
      <FieldLabel>Statements (one per line)</FieldLabel>
      <TextArea
        value={text}
        onChange={handleChange}
        rows={Math.min(14, Math.max(6, currentList.length + 1))}
        placeholder={"This policy is fair\nMarkets are free\n..."}
      />
      <p className="font-sans text-caption text-muted-foreground italic">
        Each line is a claim; its negation is auto-generated at run time. To
        save the current list as a reusable battery, open the Negation Battery
        tab and use "Save as named battery".
      </p>
    </div>
  );
}

function CompassEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const preset = eff<string>(step, edits, "preset", "");
  const presetNames = Object.keys(COMPASS_PRESETS);
  const resolved = preset && preset in COMPASS_PRESETS ? COMPASS_PRESETS[preset] : null;

  // Concepts: if edited, use edits; otherwise resolve from step.inputs
  // or fall back to the preset's defaults.
  const conceptsFromEdits = typeof edits?.concepts === "string"
    ? (edits.concepts as string)
    : Array.isArray(edits?.concepts)
      ? (edits.concepts as string[]).join(", ")
      : null;
  const conceptsFromStep = typeof step.inputs.concepts === "string"
    ? (step.inputs.concepts as string)
    : Array.isArray(step.inputs.concepts)
      ? (step.inputs.concepts as string[]).join(", ")
      : null;
  const conceptsText =
    conceptsFromEdits ?? conceptsFromStep ?? (resolved?.defaults ?? []).join(", ");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-sans text-caption text-muted-foreground flex-wrap">
        <span>Preset:</span>
        <select
          value={preset}
          onChange={e => onChange({ ...(edits ?? {}), preset: e.target.value })}
          className="input-editorial text-caption py-1 px-2 w-auto"
        >
          {!preset && <option value="">— choose —</option>}
          {presetNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      {resolved && (
        <div className="grid grid-cols-2 gap-2 font-sans text-caption text-muted-foreground">
          <div className="bg-muted rounded-sm p-2">
            <div className="text-[9px] uppercase tracking-wider font-semibold">X axis</div>
            <div>{resolved.xAxis.negative.label} ↔ {resolved.xAxis.positive.label}</div>
          </div>
          <div className="bg-muted rounded-sm p-2">
            <div className="text-[9px] uppercase tracking-wider font-semibold">Y axis</div>
            <div>{resolved.yAxis.negative.label} ↔ {resolved.yAxis.positive.label}</div>
          </div>
        </div>
      )}
      <div>
        <FieldLabel>Concepts (comma-separated)</FieldLabel>
        <TextArea
          value={conceptsText}
          onChange={v => {
            // Store as a comma-separated string; the collector handles both.
            onChange({ ...(edits ?? {}), concepts: v });
          }}
          rows={3}
          placeholder="justice, fairness, equity, freedom, authority"
        />
        <p className="mt-1 font-sans text-caption text-muted-foreground italic">
          Each concept is plotted relative to the compass axes. Empty to use the preset's defaults.
        </p>
      </div>
    </div>
  );
}

function MatrixEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  const conceptsFromEdits = typeof edits?.concepts === "string"
    ? (edits.concepts as string)
    : Array.isArray(edits?.concepts)
      ? (edits.concepts as string[]).join(", ")
      : null;
  const conceptsFromStep = typeof step.inputs.concepts === "string"
    ? (step.inputs.concepts as string)
    : Array.isArray(step.inputs.concepts)
      ? (step.inputs.concepts as string[]).join(", ")
      : "";
  const conceptsText = conceptsFromEdits ?? conceptsFromStep;
  const count = conceptsText
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0).length;

  return (
    <div className="space-y-2">
      <FieldLabel>Concepts (comma-separated, minimum 2)</FieldLabel>
      <TextArea
        value={conceptsText}
        onChange={v => onChange({ ...(edits ?? {}), concepts: v })}
        rows={3}
        placeholder="justice, fairness, equity, law, punishment, mercy"
      />
      <p className="font-sans text-caption text-muted-foreground italic">
        {count} concept{count === 1 ? "" : "s"} — {count >= 2 ? `${(count * (count - 1)) / 2} pairs will be computed per model` : "need at least two concepts"}.
      </p>
    </div>
  );
}

function AgonismEditor({ step, edits, onChange }: Omit<StepEditorProps, "stepIndex">) {
  // Resolve default pairs: inline pairs array, preset filter, or full default.
  const defaultPairs: AgonismPair[] = useMemo(() => {
    if (Array.isArray(step.inputs.pairs)) {
      return (step.inputs.pairs as AgonismPair[]).filter(
        p => p && p.positionA && p.positionB
      );
    }
    const preset = typeof step.inputs.preset === "string" ? step.inputs.preset : undefined;
    if (!preset || preset === "all") return AGONISM_PAIRS;
    const wanted = preset.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const hits = AGONISM_PAIRS.filter(p =>
      wanted.some(w => p.label.toLowerCase().includes(w))
    );
    return hits.length > 0 ? hits : AGONISM_PAIRS;
  }, [step.inputs]);

  const currentPairs: AgonismPair[] = Array.isArray(edits?.pairs)
    ? (edits!.pairs as AgonismPair[])
    : defaultPairs;

  // One row per pair, five pipe-delimited fields:
  // thinkerA | quoteA | thinkerB | quoteB | label
  const text = currentPairs
    .map(p =>
      [
        p.positionA.thinker,
        p.positionA.quote,
        p.positionB.thinker,
        p.positionB.quote,
        p.label,
      ].join(" | ")
    )
    .join("\n");

  const handleChange = (v: string) => {
    const parsed: AgonismPair[] = v
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split("|").map(s => s.trim());
        const thinkerA = parts[0] ?? "";
        const quoteA = parts[1] ?? "";
        const thinkerB = parts[2] ?? "";
        const quoteB = parts[3] ?? "";
        const label = parts[4] ?? `${thinkerA || "A"} vs ${thinkerB || "B"}`;
        return {
          label,
          positionA: { thinker: thinkerA, quote: quoteA },
          positionB: { thinker: thinkerB, quote: quoteB },
        };
      })
      .filter(p => p.positionA.quote && p.positionB.quote);
    const nextEdits: Record<string, unknown> = { ...(edits ?? {}), pairs: parsed };
    if ("preset" in nextEdits) delete nextEdits.preset;
    onChange(nextEdits);
  };

  return (
    <div className="space-y-2">
      <p className="font-sans text-caption text-muted-foreground">
        Each line: <span className="text-foreground font-mono">thinkerA | quoteA | thinkerB | quoteB | label</span>.
        Quotes should be opposed positions on the same question.
      </p>
      <FieldLabel>Opposed pairs ({currentPairs.length})</FieldLabel>
      <TextArea
        value={text}
        onChange={handleChange}
        rows={Math.min(14, Math.max(4, currentPairs.length + 1))}
      />
    </div>
  );
}

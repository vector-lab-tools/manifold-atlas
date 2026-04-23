"use client";

/**
 * Modal for adding or editing a user-defined protocol.
 *
 * - Add mode: empty textarea; "Start from..." dropdown populated with
 *   every built-in and custom protocol so the user can begin from a
 *   working example and tweak it; saveCustomProtocol on submit.
 * - Edit mode: textarea pre-filled with the target custom protocol's
 *   source; updateCustomProtocol on submit; handles id rename cleanly.
 *
 * Shows any parse / validation error inline; on success closes and
 * notifies the caller.
 */

import { useEffect, useRef, useState } from "react";
import { X, Upload, Plus, Save } from "lucide-react";
import type { Protocol } from "@/types/protocols";
import {
  saveCustomProtocol,
  updateCustomProtocol,
  CustomProtocolError,
  CUSTOM_PROTOCOL_EXAMPLE,
  type CustomProtocol,
} from "@/lib/protocols/custom";

interface AddProtocolModalProps {
  open: boolean;
  onClose: () => void;
  /** Ids that already exist (built-in + other custom) for collision detection. */
  existingIds: string[];
  /** All loaded protocols, used to populate the Start-from dropdown. */
  allProtocols: Protocol[];
  /**
   * If set, the modal opens in edit mode and updates the existing
   * protocol on save.
   */
  editing?: CustomProtocol | null;
  onSaved: (protocol: CustomProtocol) => void;
}

// Built-in protocol ids live at /protocols/{id}.md. Custom ones carry
// their source on the object itself.
async function fetchProtocolSource(p: Protocol): Promise<string> {
  const c = p as CustomProtocol;
  if (c.isCustom && c.source) return c.source;
  const response = await fetch(`/protocols/${p.id}.md`);
  if (!response.ok) throw new Error(`Failed to load template "${p.id}"`);
  return response.text();
}

export function AddProtocolModal({
  open,
  onClose,
  existingIds,
  allProtocols,
  editing,
  onSaved,
}: AddProtocolModalProps) {
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [templateChoice, setTemplateChoice] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEdit = !!editing;

  // When (re)opened, seed the textarea: edit mode uses the source;
  // add mode starts blank.
  useEffect(() => {
    if (!open) return;
    setMarkdown(editing?.source ?? "");
    setError(null);
    setTemplateChoice("");
  }, [open, editing]);

  if (!open) return null;

  const handleSave = () => {
    try {
      if (isEdit && editing) {
        const protocol = updateCustomProtocol(editing.id, markdown, existingIds);
        setError(null);
        onSaved(protocol);
        onClose();
      } else {
        const protocol = saveCustomProtocol(markdown, existingIds);
        setMarkdown("");
        setError(null);
        onSaved(protocol);
        onClose();
      }
    } catch (err) {
      if (err instanceof CustomProtocolError) setError(err.message);
      else setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFileChosen = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setMarkdown(text);
    setError(null);
  };

  const handleTemplateChoice = async (choice: string) => {
    setTemplateChoice(choice);
    setError(null);
    if (choice === "") return;
    if (choice === "__blank__") {
      setMarkdown("");
      return;
    }
    if (choice === "__example__") {
      setMarkdown(CUSTOM_PROTOCOL_EXAMPLE);
      return;
    }
    const p = allProtocols.find(q => q.id === choice);
    if (!p) return;
    try {
      const source = await fetchProtocolSource(p);
      // In add mode, change the id so it doesn't collide with the
      // source. In edit mode, leave the id so the user can see they
      // are editing in place.
      if (!isEdit) {
        const renamed = renameProtocolId(source, `${p.id}-copy`);
        setMarkdown(renamed);
      } else {
        setMarkdown(source);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[680px] max-w-[calc(100vw-2rem)] card-editorial shadow-editorial-lg flex flex-col"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        <div className="px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="font-display text-display-md font-bold">
              {isEdit ? `Edit: ${editing?.title ?? "custom protocol"}` : "Add a protocol"}
            </h2>
            <p className="font-sans text-caption text-muted-foreground mt-0.5">
              {isEdit
                ? "Edit the markdown and save to update this protocol in place. You can also change the id to save it under a new name."
                : "Paste your own protocol markdown, upload a .md file, or start from an existing protocol as a template. Added protocols are saved to this browser and appear in the Library."}
            </p>
          </div>
          <button onClick={onClose} className="btn-editorial-ghost px-2 py-1">
            <X size={16} />
          </button>
        </div>

        <div className="thin-rule mx-6" />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
              Start from:
            </label>
            <select
              value={templateChoice}
              onChange={e => handleTemplateChoice(e.target.value)}
              className="input-editorial text-caption py-1 px-2 w-auto"
            >
              <option value="">— Choose a template —</option>
              <option value="__blank__">Blank</option>
              <option value="__example__">Minimal example (3 steps)</option>
              <optgroup label="Built-in protocols">
                {allProtocols
                  .filter(p => !(p as CustomProtocol).isCustom)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </optgroup>
              {allProtocols.some(p => (p as CustomProtocol).isCustom) && (
                <optgroup label="Your custom protocols">
                  {allProtocols
                    .filter(p => (p as CustomProtocol).isCustom)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={e => handleFileChosen(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-editorial-ghost flex items-center gap-1"
            >
              <Upload size={14} />
              Upload .md file
            </button>
          </div>
          {!isEdit && templateChoice && templateChoice !== "__blank__" && templateChoice !== "__example__" && (
            <p className="font-sans text-caption text-muted-foreground italic">
              Loaded as <span className="text-foreground font-mono">{templateChoice}-copy</span> — rename the id in the front matter to anything you like.
            </p>
          )}

          <label className="block font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold">
            Protocol markdown
          </label>
          <textarea
            value={markdown}
            onChange={e => {
              setMarkdown(e.target.value);
              if (error) setError(null);
            }}
            rows={18}
            placeholder={CUSTOM_PROTOCOL_EXAMPLE}
            className="input-editorial text-body-sm w-full resize-y font-mono"
          />

          {error && (
            <div className="card-editorial border-error-500 border p-3">
              <p className="font-sans text-caption text-error-700">{error}</p>
            </div>
          )}

          <details className="font-sans text-caption text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Format reference</summary>
            <div className="mt-2 space-y-1">
              <p>
                Front matter (between <code>---</code> fences) must include:{" "}
                <code>id</code>, <code>title</code>, <code>description</code>, and{" "}
                <code>category</code> (one of: <code>workshop</code>, <code>research</code>, <code>demo</code>).
              </p>
              <p>
                Body: numbered steps, one per operation. Each step starts with
                <code> 1. &lt;operation-id&gt;</code> at column zero. Indented
                lines (3 spaces) below it are the step's inputs as{" "}
                <code>key: value</code> pairs or YAML-ish lists.
              </p>
              <p>
                Supported operations: <code>distance</code>, <code>analogy</code>,{" "}
                <code>negation</code>, <code>sectioning</code>, <code>battery</code>,{" "}
                <code>agonism</code>.
              </p>
            </div>
          </details>
        </div>

        <div className="thin-rule mx-6" />

        <div className="px-6 py-4 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={markdown.trim().length === 0}
            className="btn-editorial-primary flex items-center gap-1 disabled:opacity-50"
          >
            {isEdit ? <Save size={14} /> : <Plus size={14} />}
            {isEdit ? "Save changes" : "Add to Library"}
          </button>
          <button onClick={onClose} className="btn-editorial-ghost">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Replace the `id:` field in a protocol's front matter with a new id.
 * Falls back to the original markdown if the front matter can't be
 * located. Used when a built-in protocol is loaded as a template in
 * add mode so the copy doesn't collide with the source.
 */
function renameProtocolId(source: string, newId: string): string {
  const fmMatch = /^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/.exec(source);
  if (!fmMatch) return source;
  const [, openFence, fmBody, closeFence, rest] = fmMatch;
  const replacedFm = fmBody.replace(/^(\s*id:\s*).*$/m, `$1${newId}`);
  return `${openFence}${replacedFm}${closeFence}${rest}`;
}

/**
 * Custom Protocols — user-added tests.
 *
 * Users can extend the Library by adding their own protocol markdown.
 * This module persists those additions in localStorage under a single
 * key holding an array of raw markdown strings. Markdown (not parsed
 * objects) is the stored representation because:
 *
 *   - The source text is what the user edits; round-tripping is clean.
 *   - If the Protocol type evolves, reparsing catches the change.
 *   - Invalid entries can be reported without losing the source text.
 *
 * Custom protocols carry `isCustom: true` on the returned Protocol
 * so the Library UI can badge them and offer a Remove action.
 */

import type { Protocol } from "@/types/protocols";
import { parseProtocolMarkdown } from "@/lib/protocols/parser";

const STORAGE_KEY = "manifold-atlas.custom-protocols";

export interface CustomProtocol extends Protocol {
  isCustom: true;
  /** Raw markdown the user submitted. Useful for editing or re-export. */
  source: string;
}

function safeReadStore(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

function writeStore(sources: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // Storage quota / disabled; silently drop. The caller may retry.
  }
}

/**
 * Parse and return every valid custom protocol the user has added.
 * Invalid entries are logged and skipped rather than throwing.
 */
export function loadCustomProtocols(): CustomProtocol[] {
  const sources = safeReadStore();
  const out: CustomProtocol[] = [];
  for (const source of sources) {
    try {
      const parsed = parseProtocolMarkdown(source);
      out.push({ ...parsed, isCustom: true, source });
    } catch (err) {
      console.warn("Skipping invalid custom protocol:", err);
    }
  }
  return out;
}

export class CustomProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomProtocolError";
  }
}

/**
 * Parse the supplied markdown, validate it, and persist.
 *
 * Throws CustomProtocolError on:
 *   - parse failure (delegates message from parseProtocolMarkdown)
 *   - id collision with a built-in or another custom protocol
 *   - id collision detection requires the caller to supply existing
 *     ids so we don't need a second fetch round trip.
 */
export function saveCustomProtocol(markdown: string, existingIds: string[]): CustomProtocol {
  let parsed: Protocol;
  try {
    parsed = parseProtocolMarkdown(markdown);
  } catch (err) {
    throw new CustomProtocolError(
      err instanceof Error ? err.message : String(err)
    );
  }
  if (existingIds.includes(parsed.id)) {
    throw new CustomProtocolError(
      `A protocol with id "${parsed.id}" already exists. Change the id in the front matter to add this as a separate protocol.`
    );
  }
  const sources = safeReadStore();
  sources.push(markdown);
  writeStore(sources);
  return { ...parsed, isCustom: true, source: markdown };
}

/**
 * Update a custom protocol.
 *
 * Parses the new markdown. If the id is unchanged, replaces in place.
 * If the id changed, removes the old entry and adds the new one — but
 * only if the new id does not collide with another existing protocol.
 *
 * Throws CustomProtocolError on parse failure or id collision.
 */
export function updateCustomProtocol(
  oldId: string,
  newMarkdown: string,
  existingIds: string[]
): CustomProtocol {
  let parsed: Protocol;
  try {
    parsed = parseProtocolMarkdown(newMarkdown);
  } catch (err) {
    throw new CustomProtocolError(
      err instanceof Error ? err.message : String(err)
    );
  }

  const idChanged = parsed.id !== oldId;
  if (idChanged) {
    const collidesWithOther = existingIds
      .filter(id => id !== oldId)
      .includes(parsed.id);
    if (collidesWithOther) {
      throw new CustomProtocolError(
        `A protocol with id "${parsed.id}" already exists. Change the id in the front matter or keep the original.`
      );
    }
  }

  const sources = safeReadStore();
  const out: string[] = [];
  let replaced = false;
  for (const source of sources) {
    try {
      const p = parseProtocolMarkdown(source);
      if (p.id === oldId) {
        out.push(newMarkdown);
        replaced = true;
      } else {
        out.push(source);
      }
    } catch {
      out.push(source);
    }
  }
  if (!replaced) out.push(newMarkdown); // Fallback: append if not found.
  writeStore(out);
  return { ...parsed, isCustom: true, source: newMarkdown };
}

/**
 * Remove a custom protocol by id. No-op for unknown ids.
 */
export function removeCustomProtocol(id: string): void {
  const sources = safeReadStore();
  const kept: string[] = [];
  for (const source of sources) {
    try {
      const parsed = parseProtocolMarkdown(source);
      if (parsed.id !== id) kept.push(source);
    } catch {
      // Keep unparseable entries so the user can still remove them
      // manually via storage inspection; they won't appear in the UI
      // so they can't be "removed" through this call path anyway.
      kept.push(source);
    }
  }
  writeStore(kept);
}

/**
 * Example markdown shown in the Add Protocol modal's placeholder so a
 * new user can see the shape without leaving the app.
 */
export const CUSTOM_PROTOCOL_EXAMPLE = `---
id: my-custom-test
title: My Custom Test
category: research
description: A short description that appears on the Library card.
estimatedQueries: 10
---

1. distance
   label: Freedom vs liberation
   termA: freedom
   termB: liberation

2. negation
   label: A claim to test
   statement: Markets allocate resources efficiently

3. sectioning
   label: Solidarity to compliance
   anchorA: solidarity
   anchorB: compliance
`;

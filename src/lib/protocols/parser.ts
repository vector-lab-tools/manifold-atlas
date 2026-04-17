/**
 * Manifold Atlas — Protocol markdown parser.
 *
 * Parses protocol definitions from markdown files with YAML-ish front
 * matter plus numbered steps. Keeps the format editable by authors
 * who aren't TypeScript programmers; workshop facilitators can fork
 * a protocol and tweak it without touching source.
 *
 * Format:
 *
 *   ---
 *   id: negation-audit
 *   title: Negation Audit
 *   category: critique
 *   description: ...
 *   estimatedQueries: 60
 *   readingLink:
 *     label: Negative Vectors
 *     url: https://stunlaw.blogspot.com/...
 *   ---
 *
 *   1. negation-battery
 *      label: Ethical claims battery
 *      preset: ethical-statements
 *
 *   2. negation-gauge
 *      inputs:
 *        - "This policy is fair"
 *        - "Markets are free"
 *
 * Protocols live in /public/protocols/ and an index.md lists them.
 */

import type { Protocol, ProtocolStep, ProtocolCategory } from "@/types/protocols";
import type { TabId } from "@/components/layout/TabNav";

const VALID_CATEGORIES: ProtocolCategory[] = ["workshop", "research", "demo"];

const VALID_TAB_IDS: TabId[] = [
  "distance",
  "matrix",
  "negation",
  "battery",
  "neighbourhood",
  "sectioning",
  "drift",
  "walk",
  "textvec",
  "compass",
  "abstraction",
  "silence",
  "agonism",
  "analogy",
  "topology",
];

// Simple YAML-ish parser covering only what protocol files need:
// key: value, key: "value", lists as "- item", nested one level.
// Intentionally tiny; not a full YAML implementation.
interface ParsedFrontMatter {
  [key: string]: string | string[] | Record<string, string>;
}

function parseFrontMatter(block: string): ParsedFrontMatter {
  const lines = block.split("\n");
  const result: ParsedFrontMatter = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  let currentObject: Record<string, string> | null = null;
  let objectIndent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // List item under the current key
    if (trimmed.startsWith("- ") && currentList !== null) {
      currentList.push(stripQuotes(trimmed.slice(2).trim()));
      continue;
    }

    // Nested object entry (key: value at higher indent)
    if (currentObject !== null && indent >= objectIndent && trimmed.includes(":")) {
      const [k, ...rest] = trimmed.split(":");
      currentObject[k.trim()] = stripQuotes(rest.join(":").trim());
      continue;
    }

    // Otherwise: top-level key
    if (currentList !== null && currentKey !== null) {
      result[currentKey] = currentList;
      currentList = null;
    }
    if (currentObject !== null && currentKey !== null) {
      result[currentKey] = currentObject;
      currentObject = null;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (value.length === 0) {
      // Either a list or a nested object is about to follow
      currentKey = key;
      currentList = [];
      currentObject = {};
      objectIndent = indent + 2;
    } else {
      result[key] = stripQuotes(value);
      currentKey = null;
      currentList = null;
      currentObject = null;
    }
  }

  // Flush trailing list/object
  if (currentList !== null && currentKey !== null && currentList.length > 0) {
    result[currentKey] = currentList;
  } else if (currentObject !== null && currentKey !== null && Object.keys(currentObject).length > 0) {
    result[currentKey] = currentObject;
  }

  return result;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function isValidTabId(value: string): value is TabId {
  return (VALID_TAB_IDS as string[]).includes(value);
}

function isValidCategory(value: string): value is ProtocolCategory {
  return (VALID_CATEGORIES as string[]).includes(value);
}

/**
 * Parse the body of a protocol (everything after the front matter)
 * into ordered steps. Each step begins with "1. operation-id" at
 * column zero; indented lines below it are the step's inputs.
 */
function parseSteps(body: string): ProtocolStep[] {
  const lines = body.split("\n");
  const steps: ProtocolStep[] = [];
  let current: { operation: string; inputLines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    if (!isValidTabId(current.operation)) {
      throw new Error(
        `Unknown operation "${current.operation}". Valid operations: ${VALID_TAB_IDS.join(", ")}`
      );
    }
    const inputs = parseFrontMatter(current.inputLines.join("\n"));
    const { label, ...rest } = inputs as { label?: string } & Record<string, unknown>;
    steps.push({
      operation: current.operation,
      label: typeof label === "string" ? label : undefined,
      inputs: rest,
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const numberedMatch = /^(\d+)\.\s+([a-z][a-z0-9-]*)\s*$/.exec(line);
    if (numberedMatch) {
      flush();
      current = { operation: numberedMatch[2], inputLines: [] };
      continue;
    }
    if (current) {
      // Indented lines belong to the current step
      if (line.startsWith("   ") || line.startsWith("\t")) {
        // Strip exactly three spaces (or one tab) of indent, leave rest
        const dedented = line.startsWith("\t") ? line.slice(1) : line.slice(3);
        current.inputLines.push(dedented);
      } else if (line.trim().length === 0) {
        current.inputLines.push("");
      }
    }
  }
  flush();

  return steps;
}

/**
 * Parse a complete protocol markdown file.
 */
export function parseProtocolMarkdown(markdown: string): Protocol {
  const fmMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown);
  if (!fmMatch) {
    throw new Error("Protocol file must begin with a --- front matter block.");
  }

  const frontMatter = parseFrontMatter(fmMatch[1]);
  const body = fmMatch[2];

  const id = frontMatter.id as string | undefined;
  const title = frontMatter.title as string | undefined;
  const description = frontMatter.description as string | undefined;
  const categoryRaw = frontMatter.category as string | undefined;

  if (!id || !title || !description || !categoryRaw) {
    throw new Error(
      "Protocol front matter must include id, title, description, and category."
    );
  }
  if (!isValidCategory(categoryRaw)) {
    throw new Error(
      `Unknown category "${categoryRaw}". Valid categories: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  const steps = parseSteps(body);
  if (steps.length === 0) {
    throw new Error(`Protocol "${id}" has no steps.`);
  }

  const estimatedQueriesRaw = frontMatter.estimatedQueries as string | undefined;
  const readingLinkRaw = frontMatter.readingLink as Record<string, string> | undefined;

  return {
    id,
    title,
    description,
    category: categoryRaw,
    steps,
    estimatedQueries: estimatedQueriesRaw ? Number(estimatedQueriesRaw) : undefined,
    readingLink:
      readingLinkRaw && readingLinkRaw.label && readingLinkRaw.url
        ? { label: readingLinkRaw.label, url: readingLinkRaw.url }
        : undefined,
  };
}

/**
 * Fetch and parse a single protocol by id from /public/protocols/.
 */
export async function loadProtocol(id: string): Promise<Protocol> {
  const response = await fetch(`/protocols/${id}.md`);
  if (!response.ok) {
    throw new Error(`Failed to load protocol "${id}" (HTTP ${response.status})`);
  }
  const markdown = await response.text();
  return parseProtocolMarkdown(markdown);
}

/**
 * Load the index of available protocols from /public/protocols/index.md.
 * Each line in the index is a protocol id, one per line.
 */
export async function loadProtocolIndex(): Promise<string[]> {
  const response = await fetch(`/protocols/index.md`);
  if (!response.ok) {
    throw new Error(`Failed to load protocol index (HTTP ${response.status})`);
  }
  const markdown = await response.text();
  return markdown
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"));
}

/**
 * Load all protocols listed in the index.
 */
export async function loadAllProtocols(): Promise<Protocol[]> {
  const ids = await loadProtocolIndex();
  const results = await Promise.all(
    ids.map(async id => {
      try {
        return await loadProtocol(id);
      } catch (error) {
        console.error(`Failed to load protocol "${id}":`, error);
        return null;
      }
    })
  );
  return results.filter((p): p is Protocol => p !== null);
}

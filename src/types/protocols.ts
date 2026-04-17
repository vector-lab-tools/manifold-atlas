/**
 * Manifold Atlas — Protocol types
 *
 * A protocol is a named sequence of operations with pre-set inputs,
 * runnable in one click and exportable as a structured report.
 *
 * Designed for DMI workshops and research reproducibility. Each run
 * carries timestamps and model fingerprints so results are citable.
 * Provenance attestation reserved for future Manifoldscope integration.
 *
 * Protocols live as markdown files in /public/protocols/.
 */

import type { TabId } from "@/components/layout/TabNav";

export type ProtocolCategory = "workshop" | "research" | "demo";

/**
 * A single step in a protocol. `operation` is one of the tool's TabIds
 * (e.g. "distance", "negation", "analogy"), and `inputs` carries the
 * operation-specific arguments (concepts, preset names, context lists).
 */
export interface ProtocolStep {
  /** Operation identifier (matches TabId). */
  operation: TabId;
  /** Human-readable step label for display in the Runner. */
  label?: string;
  /** Operation-specific inputs. Shape depends on operation. */
  inputs: Record<string, unknown>;
}

export interface Protocol {
  /** Kebab-case identifier, e.g. "negation-audit". */
  id: string;
  /** Display title. */
  title: string;
  /** Short description of what the protocol demonstrates. */
  description: string;
  /** Category for grouping in the Library view. */
  category: ProtocolCategory;
  /** Sequence of steps, executed in order. */
  steps: ProtocolStep[];
  /** Optional: estimated number of embedding queries (for workshop planning). */
  estimatedQueries?: number;
  /** Optional: Stunlaw or article URL for theoretical context. */
  readingLink?: { label: string; url: string };
}

/**
 * Status of a single step during a protocol run.
 */
export type ProtocolStepStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped";

/**
 * Per-model, per-step summary numbers rendered in the result card.
 * Each operation contributes its own shape; we keep this as a flat
 * record of named numbers for consistent display.
 */
export interface StepHeadlineMetrics {
  [label: string]: number | string;
}

/**
 * Result of executing one protocol step. The `details` field carries
 * the full operation output for export; `headline` is what the Runner
 * UI shows in the collapsed card.
 */
export interface ProtocolStepResult {
  stepIndex: number;
  step: ProtocolStep;
  status: ProtocolStepStatus;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
  /** Model ids successfully used for this step. */
  models: string[];
  /** Compact summary rendered in the result card. */
  headline?: StepHeadlineMetrics;
  /** Full operation-specific output; structure depends on operation. */
  details?: unknown;
  /** Error message if status is "error". */
  error?: string;
}

/**
 * Provenance attestation reserved for Manifoldscope integration.
 *
 * The intended contract: Manifoldscope characterises the intrinsic
 * geometry of the manifold in the region a protocol exercises
 * (intrinsic dimension, curvature, local density, sampling adequacy).
 * Atlas protocol runs carry the attestation so that pointwise findings
 * (e.g. "cosine distance between X and Y is 0.12") are bound to a
 * geometric characterisation of the region where the measurement was
 * taken. No Critique finding is defensible without a Measure attestation
 * for the same region. See CONCEPTS.md "Intensive Manifold Reading".
 *
 * Shape is deliberately left loose until Manifoldscope publishes its
 * export format.
 */
export interface ProvenanceAttestation {
  source: "manifoldscope";
  version: string;
  generatedAt: string;
  payload: Record<string, unknown>;
}

/**
 * Complete record of a protocol run. Serialisable; used for JSON
 * export and, in future, Manifoldscope provenance binding.
 */
export interface ProtocolRun {
  /** Which protocol was run. */
  protocolId: string;
  protocolTitle: string;
  /** ISO 8601 timestamps. */
  startedAt: string;
  completedAt?: string;
  totalElapsedMs?: number;
  /** Model ids enabled for this run. */
  models: Array<{ id: string; name: string; providerId: string }>;
  /** One entry per step, in execution order. */
  steps: ProtocolStepResult[];
  /** Counts for the run summary. */
  stats: {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    embeddedTexts: number;
  };
  /** Reserved for Manifoldscope attestation; empty until integrated. */
  provenance?: ProvenanceAttestation;
  /** Version of Manifold Atlas that produced this run. */
  atlasVersion: string;
}

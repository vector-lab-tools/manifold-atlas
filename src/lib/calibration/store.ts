/**
 * Persistence for calibration records.
 *
 * Calibrations are expensive only once. A run costs one batched embed
 * of the corpus per model, after which the record is small enough to
 * keep in localStorage indefinitely. Records computed against an
 * earlier corpus version are dropped on read rather than silently used,
 * because a floor measured on different sentences is a different floor.
 */

import type { ModelCalibration } from "./compute";
import { isStale } from "./compute";

const STORE_KEY = "manifold-atlas-calibration";

type StoredMap = Record<string, ModelCalibration>;

function readAll(): StoredMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredMap;
    const out: StoredMap = {};
    for (const [id, cal] of Object.entries(parsed)) {
      if (cal && typeof cal === "object" && !isStale(cal)) out[id] = cal;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: StoredMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded or storage disabled. Calibration is a cache, so a
    // failed write costs a recomputation rather than a lost result.
  }
}

export function loadCalibrations(): Map<string, ModelCalibration> {
  return new Map(Object.entries(readAll()));
}

export function loadCalibration(modelId: string): ModelCalibration | null {
  return readAll()[modelId] ?? null;
}

export function saveCalibration(cal: ModelCalibration): void {
  const all = readAll();
  all[cal.modelId] = cal;
  writeAll(all);
}

export function clearCalibration(modelId: string): void {
  const all = readAll();
  delete all[modelId];
  writeAll(all);
}

export function clearAllCalibrations(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // See writeAll.
  }
}

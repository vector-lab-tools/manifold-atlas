"use client";

/**
 * Calibration state for the whole application.
 *
 * Holds one record per model, loaded from localStorage on mount and
 * recomputed only when the user asks or when the corpus version moves.
 * Every operation reads from here to find the floor its cosines should
 * be reported against, so a model calibrated in one panel is calibrated
 * everywhere.
 *
 * A calibration run embeds the corpus once per model. The texts are
 * sent through the ordinary embedding cache, so a second run after a
 * corpus change only pays for the sentences that changed.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSettings } from "./SettingsContext";
import { useEmbeddingCache } from "./EmbeddingCacheContext";
import { fetchEmbeddings } from "@/lib/embeddings/client";
import { cosineSimilarity } from "@/lib/geometry/cosine";
import type { EmbeddingProviderId } from "@/types/embeddings";
import {
  calibrationTextList,
  computeCalibration,
  loadCalibrations,
  saveCalibration,
  clearCalibration,
  clearAllCalibrations,
  type ModelCalibration,
} from "@/lib/calibration";

/**
 * Providers differ in how many texts they accept per request, and the
 * lowest common ceiling among the supported ones is well under the
 * corpus size. Chunking here rather than in the client keeps the
 * calibration run within every provider's limit.
 */
const EMBED_CHUNK = 48;

/**
 * How many corpus texts to re-embed and check against what the run
 * assembled, before any of it is turned into a measurement.
 *
 * The cache is keyed by text and cannot tell whether a stored vector was
 * produced by the pipeline now in force. A pipeline stamp handles the
 * changes we know about; this handles the ones we do not. Six texts is
 * roughly 3% of the corpus and costs one extra request, which is
 * nothing against the alternative of publishing a floor that moved
 * because some of its vectors came from somewhere else.
 */
const VERIFY_SAMPLE = 6;
/** Two vectors of the same text from the same model should be identical. */
const VERIFY_TOLERANCE = 1e-4;

/** Indices spread across the strata rather than clustered at the front. */
function verifyIndices(total: number): number[] {
  const step = Math.max(1, Math.floor(total / VERIFY_SAMPLE));
  const out: number[] = [];
  for (let i = 0; i < total && out.length < VERIFY_SAMPLE; i += step) out.push(i);
  return out;
}

export type CalibrationStatus = "idle" | "running" | "done" | "error";

/**
 * Turn a provider error into something the user can act on.
 *
 * A rejected key is the most common calibration failure and the raw
 * message from the provider ("Invalid username or password") does not
 * say which key, or where to change it. Anything not recognised is
 * passed through unaltered rather than being flattened into a generic
 * apology.
 */
export function calibrationErrorHint(message: string): string | null {
  if (/\b(401|403)\b/.test(message) || /invalid username or password|unauthor|invalid api key|forbidden/i.test(message)) {
    return "The provider rejected the API key. Open Settings and check the key for this provider.";
  }
  if (/\b429\b/.test(message) || /rate limit/i.test(message)) {
    return "The provider rate-limited the run. Wait a moment and calibrate again; texts already embedded are cached, so the retry resumes rather than restarting.";
  }
  if (/\b(500|502|503|504)\b/.test(message)) {
    return "The provider returned a server error. This is usually transient; try again shortly.";
  }
  if (/failed to fetch|networkerror|econnrefused/i.test(message)) {
    return "Could not reach the provider. For Ollama, check the server is running at the base URL in Settings.";
  }
  return null;
}

export interface CalibrationProgress {
  modelId: string;
  modelName: string;
  providerId: string;
  status: CalibrationStatus;
  /** What the run is doing right now, for the live readout. */
  stage: "queued" | "cache" | "embedding" | "verifying" | "computing" | "done" | "error";
  /** Texts embedded so far, out of the corpus total. */
  completed: number;
  total: number;
  /** How many of the corpus texts were already cached. */
  fromCache?: number;
  /** Running commentary, appended as the measurement proceeds. */
  log: string[];
  error?: string;
  /** Seconds the model took, stamped on completion. */
  seconds?: number;
}

interface CalibrationContextType {
  calibrations: Map<string, ModelCalibration>;
  /** True while any model is calibrating. */
  running: boolean;
  progress: CalibrationProgress[];
  /** Calibrate the given models, or every enabled model when omitted. */
  calibrate: (modelIds?: string[]) => Promise<void>;
  /**
   * Live readout visibility. Opens automatically whenever a run starts,
   * from wherever it was triggered, and stays open when the run ends so
   * the measurements can be read.
   */
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  recalibrate: (modelId: string) => Promise<void>;
  forget: (modelId: string) => void;
  forgetAll: () => void;
  /** Enabled models with no usable calibration record. */
  uncalibratedModels: Array<{ id: string; name: string; providerId: string }>;
}

const CalibrationContext = createContext<CalibrationContextType | null>(null);

export function CalibrationProvider({ children }: { children: React.ReactNode }) {
  const { getEnabledModels } = useSettings();
  const cache = useEmbeddingCache();
  const [calibrations, setCalibrations] = useState<Map<string, ModelCalibration>>(new Map());
  const [progress, setProgress] = useState<CalibrationProgress[]>([]);
  const [running, setRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setCalibrations(loadCalibrations());
  }, []);

  /**
   * Embed the corpus for one model, chunked, reading and writing the
   * shared embedding cache so repeated runs are close to free.
   */
  const embedCorpus = useCallback(
    async (
      model: { id: string; providerId: EmbeddingProviderId; apiKey: string; baseUrl?: string },
      texts: string[],
      onChunk: (completed: number, fromCache?: number) => void
    ): Promise<number[][]> => {
      const cached = await cache.getMany(model.id, texts);
      // The corpus reuses a few short declaratives as the first half of
      // topical pairs, so `missing` can contain duplicates. Dedupe before
      // sending, or those texts are paid for twice in a single run.
      const missing = [...new Set(texts.filter(t => !cached.has(t)))];

      const fetched = new Map<string, number[]>();
      let done = texts.length - missing.length;
      onChunk(done, done);

      for (let i = 0; i < missing.length; i += EMBED_CHUNK) {
        const chunk = missing.slice(i, i + EMBED_CHUNK);
        const response = await fetchEmbeddings(
          model.providerId,
          model.id,
          chunk,
          model.apiKey,
          model.baseUrl
        );
        chunk.forEach((text, k) => fetched.set(text, response.vectors[k]));
        await cache.setMany(
          model.id,
          chunk.map((text, k) => ({ text, vector: response.vectors[k] }))
        );
        done += chunk.length;
        onChunk(done);
      }

      return texts.map(t => cached.get(t) ?? fetched.get(t)!);
    },
    [cache]
  );

  const calibrate = useCallback(
    async (modelIds?: string[]) => {
      const enabled = getEnabledModels();
      const targets = modelIds
        ? enabled.filter(m => modelIds.includes(m.id))
        : enabled;

      if (targets.length === 0) return;

      const texts = calibrationTextList();
      setRunning(true);
      setModalOpen(true);
      setProgress(
        targets.map(m => ({
          modelId: m.id,
          modelName: m.name,
          providerId: m.providerId,
          status: "idle" as const,
          stage: "queued" as const,
          completed: 0,
          total: texts.length,
          log: [],
        }))
      );

      const update = (modelId: string, patch: Partial<CalibrationProgress>) =>
        setProgress(prev => prev.map(p => (p.modelId === modelId ? { ...p, ...patch } : p)));

      const say = (modelId: string, line: string) =>
        setProgress(prev =>
          prev.map(p => (p.modelId === modelId ? { ...p, log: [...p.log, line] } : p))
        );

      // Sequential across models. Providers rate-limit per key, and a
      // calibration is not urgent enough to risk tripping that.
      for (const model of targets) {
        const startedAt = Date.now();
        try {
          update(model.id, { status: "running", stage: "cache" });
          say(model.id, `Corpus: ${texts.length} texts across four strata.`);

          let announcedFetch = false;
          let vectors = await embedCorpus(model, texts, (completed, fromCache) => {
            if (fromCache !== undefined) {
              update(model.id, { fromCache });
              say(
                model.id,
                fromCache > 0
                  ? `${fromCache} of ${texts.length} already cached; embedding the remaining ${texts.length - fromCache}.`
                  : `Nothing cached for this model; embedding all ${texts.length}.`
              );
            }
            if (!announcedFetch && completed > (fromCache ?? 0)) {
              announcedFetch = true;
              update(model.id, { stage: "embedding" });
            }
            update(model.id, { completed });
          });

          // Verify before measuring. A cached vector that the current
          // pipeline would not produce is indistinguishable from a good
          // one until it is checked against a fresh fetch.
          update(model.id, { stage: "verifying" });
          const idx = verifyIndices(texts.length);
          const probe = idx.map(i => texts[i]);
          const fresh = await fetchEmbeddings(
            model.providerId, model.id, probe, model.apiKey, model.baseUrl
          );
          const drift = idx.map((i, k) => 1 - cosineSimilarity(vectors[i], fresh.vectors[k]));
          const worst = Math.max(...drift);

          if (worst > VERIFY_TOLERANCE) {
            say(
              model.id,
              `Verification failed: ${drift.filter(d => d > VERIFY_TOLERANCE).length} of ${idx.length} sampled vectors do not match a fresh embedding (worst cosine ${(1 - worst).toFixed(4)}).`
            );
            say(model.id, `Discarding this model's cached vectors and re-embedding the corpus.`);
            await cache.clearModel(model.id);
            update(model.id, { stage: "embedding", completed: 0, fromCache: 0 });
            vectors = await embedCorpus(model, texts, completed =>
              update(model.id, { completed })
            );
            const recheck = await fetchEmbeddings(
              model.providerId, model.id, probe, model.apiKey, model.baseUrl
            );
            const worst2 = Math.max(
              ...idx.map((i, k) => 1 - cosineSimilarity(vectors[i], recheck.vectors[k]))
            );
            if (worst2 > VERIFY_TOLERANCE) {
              throw new Error(
                `Vectors from this provider are not reproducible: the same texts embedded twice ` +
                `differ by up to ${worst2.toExponential(2)} in cosine. A calibration taken from ` +
                `them would not be a measurement. No record has been saved.`
              );
            }
            say(model.id, `Re-embedded and verified.`);
          } else {
            say(
              model.id,
              `Verified ${idx.length} sampled vectors against fresh embeddings (max drift ${worst.toExponential(1)}).`
            );
          }

          update(model.id, { stage: "computing", completed: texts.length });
          say(model.id, `Computing pairwise cosines and the radius profile.`);

          const cal = computeCalibration(
            { id: model.id, name: model.name, providerId: model.providerId },
            vectors,
            Date.now()
          );
          saveCalibration(cal);
          setCalibrations(prev => new Map(prev).set(cal.modelId, cal));

          // Print the measurement as it lands, rather than only leaving
          // it in a panel the user has to go and find.
          say(model.id, `Term floor ${cal.termFloor.mean.toFixed(4)} (sd ${cal.termFloor.sd.toFixed(4)}, n ${cal.termFloor.n}), radius ${cal.coneByRegister.term.toFixed(1)}°.`);
          say(model.id, `Declarative floor ${cal.shortFloor.mean.toFixed(4)} (sd ${cal.shortFloor.sd.toFixed(4)}, n ${cal.shortFloor.n}), radius ${cal.coneByRegister.short.toFixed(1)}°.`);
          say(model.id, `Prose floor ${cal.proseFloor.mean.toFixed(4)} (sd ${cal.proseFloor.sd.toFixed(4)}, n ${cal.proseFloor.n}), radius ${cal.coneByRegister.prose.toFixed(1)}°.`);
          say(model.id, `Topical ceiling ${cal.topicalCeiling.mean.toFixed(4)}.`);
          say(model.id, `Effective dimension ${cal.radius.effectiveDim.toFixed(0)} of ${cal.radius.effectiveDimCeiling.toFixed(0)} reachable at this sample size; top coordinate carries ${(cal.radius.topDimShare * 100).toFixed(1)}% of the variance.`);
          say(model.id, cal.radius.apiNormalised ? `Vectors returned unit-normalised.` : `Vectors not unit-normalised: mean norm ${cal.radius.meanNorm.toFixed(3)}.`);

          update(model.id, {
            status: "done",
            stage: "done",
            completed: texts.length,
            seconds: (Date.now() - startedAt) / 1000,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          say(model.id, message);
          const hint = calibrationErrorHint(message);
          if (hint) say(model.id, hint);
          update(model.id, {
            status: "error",
            stage: "error",
            error: message,
            seconds: (Date.now() - startedAt) / 1000,
          });
        }
      }

      setRunning(false);
    },
    [getEnabledModels, embedCorpus]
  );

  const recalibrate = useCallback(
    async (modelId: string) => {
      clearCalibration(modelId);
      setCalibrations(prev => {
        const next = new Map(prev);
        next.delete(modelId);
        return next;
      });
      await calibrate([modelId]);
    },
    [calibrate]
  );

  const forget = useCallback((modelId: string) => {
    clearCalibration(modelId);
    setCalibrations(prev => {
      const next = new Map(prev);
      next.delete(modelId);
      return next;
    });
  }, []);

  const forgetAll = useCallback(() => {
    clearAllCalibrations();
    setCalibrations(new Map());
    setProgress([]);
  }, []);

  const uncalibratedModels = useMemo(
    () =>
      getEnabledModels()
        .filter(m => !calibrations.has(m.id))
        .map(m => ({ id: m.id, name: m.name, providerId: m.providerId })),
    [getEnabledModels, calibrations]
  );

  return (
    <CalibrationContext.Provider
      value={{
        calibrations,
        running,
        progress,
        calibrate,
        modalOpen,
        setModalOpen,
        recalibrate,
        forget,
        forgetAll,
        uncalibratedModels,
      }}
    >
      {children}
    </CalibrationContext.Provider>
  );
}

export function useCalibration(): CalibrationContextType {
  const ctx = useContext(CalibrationContext);
  if (!ctx) throw new Error("useCalibration must be used inside a CalibrationProvider");
  return ctx;
}

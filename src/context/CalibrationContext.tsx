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

export type CalibrationStatus = "idle" | "running" | "done" | "error";

export interface CalibrationProgress {
  modelId: string;
  modelName: string;
  status: CalibrationStatus;
  /** Texts embedded so far, out of the corpus total. */
  completed: number;
  total: number;
  error?: string;
}

interface CalibrationContextType {
  calibrations: Map<string, ModelCalibration>;
  /** True while any model is calibrating. */
  running: boolean;
  progress: CalibrationProgress[];
  /** Calibrate the given models, or every enabled model when omitted. */
  calibrate: (modelIds?: string[]) => Promise<void>;
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
      onChunk: (completed: number) => void
    ): Promise<number[][]> => {
      const cached = await cache.getMany(model.id, texts);
      const missing = texts.filter(t => !cached.has(t));

      const fetched = new Map<string, number[]>();
      let done = texts.length - missing.length;
      onChunk(done);

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
      setProgress(
        targets.map(m => ({
          modelId: m.id,
          modelName: m.name,
          status: "running" as const,
          completed: 0,
          total: texts.length,
        }))
      );

      const update = (modelId: string, patch: Partial<CalibrationProgress>) =>
        setProgress(prev => prev.map(p => (p.modelId === modelId ? { ...p, ...patch } : p)));

      // Sequential across models. Providers rate-limit per key, and a
      // calibration is not urgent enough to risk tripping that.
      for (const model of targets) {
        try {
          const vectors = await embedCorpus(model, texts, completed =>
            update(model.id, { completed })
          );
          const cal = computeCalibration(
            { id: model.id, name: model.name, providerId: model.providerId },
            vectors,
            Date.now()
          );
          saveCalibration(cal);
          setCalibrations(prev => new Map(prev).set(cal.modelId, cal));
          update(model.id, { status: "done", completed: texts.length });
        } catch (e) {
          update(model.id, {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
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

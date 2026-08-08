"use client";

import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { openDB, type IDBPDatabase } from "idb";

/**
 * Bump when anything that could change a returned vector changes: the
 * provider request shape, a pooling or normalisation step, the route.
 * Entries stamped with an older value are ignored on read and refetched.
 *
 * This exists because a set of entries was found on 8 Aug 2026 that the
 * then-current pipeline did not reproduce: the same text and model came
 * back at cosine 0.90 to 0.98 against the cached vector rather than 1.0,
 * with the deviation growing with text length. Ollama was ruled out as
 * the source (deterministic within a load and across a reload), as was
 * the fetch path (the route returns bit-identical vectors to a direct
 * call) and key misalignment (each bad vector's nearest match was its
 * own text). The origin was never identified, which is the point: the
 * cache had no way to say where a vector came from, so a calibration
 * silently mixed vectors of unknown provenance with fresh ones and
 * moved a reported floor by a third of its own standard deviation.
 * A stamp cannot prevent that, but it bounds it, and the verification
 * pass in CalibrationContext catches what the stamp cannot.
 */
export const EMBED_PIPELINE_VERSION = 2;

interface CacheEntry {
  modelId: string;
  text: string;
  vector: number[];
  timestamp: number;
  /** Pipeline that produced this vector. Missing means pre-versioning. */
  pipeline?: number;
}

interface EmbeddingCacheContextType {
  get: (modelId: string, text: string) => Promise<number[] | null>;
  set: (modelId: string, text: string, vector: number[]) => Promise<void>;
  getMany: (modelId: string, texts: string[]) => Promise<Map<string, number[]>>;
  /** Remove every cached vector for one model. Returns how many went. */
  clearModel: (modelId: string) => Promise<number>;
  setMany: (modelId: string, entries: Array<{ text: string; vector: number[] }>) => Promise<void>;
  cacheSize: number;
  clearCache: () => Promise<void>;
}

const EmbeddingCacheContext = createContext<EmbeddingCacheContextType | null>(null);

const DB_NAME = "manifold-atlas-cache";
const STORE_NAME = "embeddings";
const DB_VERSION = 1;

function cacheKey(modelId: string, text: string): string {
  return `${modelId}::${text}`;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export function EmbeddingCacheProvider({ children }: { children: React.ReactNode }) {
  const dbRef = useRef<Promise<IDBPDatabase> | null>(null);
  const [cacheSize, setCacheSize] = useState(0);

  const ensureDB = useCallback(() => {
    if (!dbRef.current) {
      dbRef.current = getDB();
      // Count entries on init
      dbRef.current.then(async db => {
        const count = await db.count(STORE_NAME);
        setCacheSize(count);
      });
    }
    return dbRef.current;
  }, []);

  const get = useCallback(async (modelId: string, text: string): Promise<number[] | null> => {
    const db = await ensureDB();
    const entry: CacheEntry | undefined = await db.get(STORE_NAME, cacheKey(modelId, text));
    if (!entry || entry.pipeline !== EMBED_PIPELINE_VERSION) return null;
    return entry.vector ?? null;
  }, [ensureDB]);

  const set = useCallback(async (modelId: string, text: string, vector: number[]) => {
    const db = await ensureDB();
    const entry: CacheEntry = {
      modelId, text, vector, timestamp: Date.now(), pipeline: EMBED_PIPELINE_VERSION,
    };
    await db.put(STORE_NAME, entry, cacheKey(modelId, text));
    setCacheSize(prev => prev + 1);
  }, [ensureDB]);

  const getMany = useCallback(async (modelId: string, texts: string[]): Promise<Map<string, number[]>> => {
    const db = await ensureDB();
    const results = new Map<string, number[]>();
    const tx = db.transaction(STORE_NAME, "readonly");
    for (const text of texts) {
      const entry: CacheEntry | undefined = await tx.store.get(cacheKey(modelId, text));
      // An entry from an older pipeline is treated as absent rather than
      // trusted. Refetching costs a call; a wrong vector costs a number.
      if (entry?.vector && entry.pipeline === EMBED_PIPELINE_VERSION) {
        results.set(text, entry.vector);
      }
    }
    await tx.done;
    return results;
  }, [ensureDB]);

  const setMany = useCallback(
    async (modelId: string, entries: Array<{ text: string; vector: number[] }>) => {
      const db = await ensureDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      for (const { text, vector } of entries) {
        const entry: CacheEntry = {
          modelId, text, vector, timestamp: Date.now(), pipeline: EMBED_PIPELINE_VERSION,
        };
        await tx.store.put(entry, cacheKey(modelId, text));
      }
      await tx.done;
      setCacheSize(prev => prev + entries.length);
    },
    [ensureDB]
  );

  /** Drop every entry for one model. Used when verification fails. */
  const clearModel = useCallback(async (modelId: string) => {
    const db = await ensureDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    let cursor = await tx.store.openCursor();
    let removed = 0;
    while (cursor) {
      const v = cursor.value as CacheEntry;
      if (v?.modelId === modelId) { await cursor.delete(); removed += 1; }
      cursor = await cursor.continue();
    }
    await tx.done;
    setCacheSize(prev => Math.max(0, prev - removed));
    return removed;
  }, [ensureDB]);

  const clearCache = useCallback(async () => {
    const db = await ensureDB();
    await db.clear(STORE_NAME);
    setCacheSize(0);
  }, [ensureDB]);

  return (
    <EmbeddingCacheContext.Provider value={{ get, set, getMany, setMany, clearModel, cacheSize, clearCache }}>
      {children}
    </EmbeddingCacheContext.Provider>
  );
}

export function useEmbeddingCache() {
  const ctx = useContext(EmbeddingCacheContext);
  if (!ctx) throw new Error("useEmbeddingCache must be used within EmbeddingCacheProvider");
  return ctx;
}

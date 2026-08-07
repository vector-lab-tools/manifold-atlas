"use client";

import { SettingsProvider } from "@/context/SettingsContext";
import { EmbeddingCacheProvider } from "@/context/EmbeddingCacheContext";
import { CalibrationProvider } from "@/context/CalibrationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <EmbeddingCacheProvider>
        <CalibrationProvider>
          {children}
        </CalibrationProvider>
      </EmbeddingCacheProvider>
    </SettingsProvider>
  );
}

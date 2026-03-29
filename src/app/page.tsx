"use client";

import { useState } from "react";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { TabNav, type TabId } from "@/components/layout/TabNav";
import { StatusBar } from "@/components/layout/StatusBar";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { ConceptDistance } from "@/components/operations/ConceptDistance";
import { NeighbourhoodMap } from "@/components/operations/NeighbourhoodMap";
import { NegationGauge } from "@/components/operations/NegationGauge";
import { NegationBattery } from "@/components/operations/NegationBattery";
import { SemanticSectioning } from "@/components/operations/SemanticSectioning";
import { ConceptDrift } from "@/components/operations/ConceptDrift";
import { HegemonyCompass } from "@/components/operations/HegemonyCompass";
import { SohnRethelTest } from "@/components/operations/SohnRethelTest";
import { SilenceDetector } from "@/components/operations/SilenceDetector";
import { Clippy } from "@/components/easter-eggs/Clippy";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("distance");
  const [lastQueryTime, setLastQueryTime] = useState<number | undefined>(undefined);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        <div className={activeTab === "distance" ? "" : "hidden"}>
          <ConceptDistance onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "neighbourhood" ? "" : "hidden"}>
          <NeighbourhoodMap onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "negation" ? "" : "hidden"}>
          <NegationGauge onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "battery" ? "" : "hidden"}>
          <NegationBattery onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "sectioning" ? "" : "hidden"}>
          <SemanticSectioning onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "drift" ? "" : "hidden"}>
          <ConceptDrift onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "compass" ? "" : "hidden"}>
          <HegemonyCompass onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "sohnrethel" ? "" : "hidden"}>
          <SohnRethelTest onQueryTime={setLastQueryTime} />
        </div>
        <div className={activeTab === "silence" ? "" : "hidden"}>
          <SilenceDetector onQueryTime={setLastQueryTime} />
        </div>
      </main>

      <StatusBar lastQueryTime={lastQueryTime} />
      <SettingsPanel />
      <Clippy />
    </div>
  );
}

export default function Home() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}

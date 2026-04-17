/**
 * Manifold Atlas
 * Comparative Geometry of AI Vector Spaces
 *
 * Concept and Design: David M. Berry
 * University of Sussex
 * https://stunlaw.blogspot.com
 *
 * Implemented with Claude Code 4.6
 * MIT Licence
 */

"use client";

import { useState } from "react";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { TabNav, type TabId } from "@/components/layout/TabNav";
import { StatusBar } from "@/components/layout/StatusBar";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { ConceptDistance } from "@/components/operations/ConceptDistance";
import { DistanceMatrix } from "@/components/operations/DistanceMatrix";
import { NeighbourhoodMap } from "@/components/operations/NeighbourhoodMap";
import { NegationGauge } from "@/components/operations/NegationGauge";
import { NegationBattery } from "@/components/operations/NegationBattery";
import { SemanticSectioning } from "@/components/operations/SemanticSectioning";
import { ConceptDrift } from "@/components/operations/VectorDrift";
import { VectorWalk } from "@/components/operations/VectorWalk";
import { TextVectorisation } from "@/components/operations/TextVectorisation";
import { HegemonyCompass } from "@/components/operations/HegemonyCompass";
import { AgonismTest } from "@/components/operations/AgonismTest";
import { SohnRethelTest } from "@/components/operations/SohnRethelTest";
import { SilenceDetector } from "@/components/operations/SilenceDetector";
import { TopologicalVoids } from "@/components/operations/TopologicalVoids";
import { VectorLogic } from "@/components/operations/VectorLogic";
import { ProtocolRunner } from "@/components/operations/ProtocolRunner";
import { Clippy } from "@/components/easter-eggs/Clippy";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("distance");
  const [lastQueryTime, setLastQueryTime] = useState<number | undefined>(undefined);
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        {activeTab === "distance" && <ConceptDistance onQueryTime={setLastQueryTime} />}
        {activeTab === "matrix" && <DistanceMatrix onQueryTime={setLastQueryTime} />}
        {activeTab === "neighbourhood" && <NeighbourhoodMap onQueryTime={setLastQueryTime} />}
        {activeTab === "negation" && <NegationGauge onQueryTime={setLastQueryTime} />}
        {activeTab === "battery" && <NegationBattery onQueryTime={setLastQueryTime} />}
        {activeTab === "analogy" && <VectorLogic onQueryTime={setLastQueryTime} />}
        {activeTab === "sectioning" && <SemanticSectioning onQueryTime={setLastQueryTime} />}
        {activeTab === "drift" && <ConceptDrift onQueryTime={setLastQueryTime} />}
        {activeTab === "walk" && <VectorWalk onQueryTime={setLastQueryTime} />}
        {activeTab === "textvec" && <TextVectorisation onQueryTime={setLastQueryTime} />}
        {activeTab === "compass" && <HegemonyCompass onQueryTime={setLastQueryTime} />}
        {activeTab === "agonism" && <AgonismTest onQueryTime={setLastQueryTime} />}
        {activeTab === "abstraction" && <SohnRethelTest onQueryTime={setLastQueryTime} />}
        {activeTab === "silence" && <SilenceDetector onQueryTime={setLastQueryTime} />}
        {activeTab === "topology" && <TopologicalVoids onQueryTime={setLastQueryTime} />}
        {(activeTab === "library" || activeTab === "run") && (
          <ProtocolRunner
            onQueryTime={setLastQueryTime}
            subTab={activeTab}
            onSubTabChange={setActiveTab}
          />
        )}
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

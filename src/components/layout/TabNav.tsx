"use client";

import { cn } from "@/lib/utils";
import { Ruler, Map, Gauge, Crosshair, GitBranch, Waypoints, Compass, Scale, Volume2 } from "lucide-react";

export type TabId = "distance" | "neighbourhood" | "negation" | "battery" | "sectioning" | "drift" | "compass" | "sohnrethel" | "silence";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof Ruler }> = [
  { id: "distance", label: "Concept Distance", icon: Ruler },
  { id: "neighbourhood", label: "Neighbourhood Map", icon: Map },
  { id: "negation", label: "Negation Gauge", icon: Gauge },
  { id: "battery", label: "Negation Battery", icon: Crosshair },
  { id: "sectioning", label: "Semantic Sectioning", icon: GitBranch },
  { id: "drift", label: "Concept Drift", icon: Waypoints },
  { id: "compass", label: "Hegemony Compass", icon: Compass },
  { id: "sohnrethel", label: "Sohn-Rethel Test", icon: Scale },
  { id: "silence", label: "Silence Detector", icon: Volume2 },
];

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="border-b border-parchment-dark px-6 bg-card overflow-x-auto">
      <div className="flex gap-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 font-sans text-caption font-medium whitespace-nowrap",
                "border-b-3 transition-all duration-200 relative",
                isActive
                  ? "border-burgundy text-burgundy bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-cream/50"
              )}
            >
              <Icon size={14} />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-1 right-1 h-[3px] bg-burgundy rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

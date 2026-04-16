"use client";

import { cn } from "@/lib/utils";
import { Ruler, Map, Scale } from "lucide-react";

export type TabId = "distance" | "matrix" | "negation" | "battery" | "neighbourhood" | "sectioning" | "drift" | "walk" | "textvec" | "compass" | "abstraction" | "silence" | "agonism" | "analogy" | "topology";
export type GroupId = "measure" | "map" | "critique";

interface TabGroup {
  id: GroupId;
  label: string;
  description: string;
  icon: typeof Ruler;
  tabs: Array<{ id: TabId; label: string }>;
}

const GROUPS: TabGroup[] = [
  {
    id: "measure",
    label: "Measure",
    description: "Point-to-point geometric measurement",
    icon: Ruler,
    tabs: [
      { id: "distance", label: "Concept Distance" },
      { id: "matrix", label: "Distance Matrix" },
      { id: "negation", label: "Negation Gauge" },
      { id: "battery", label: "Negation Battery" },
      { id: "analogy", label: "Vector Logic" },
    ],
  },
  {
    id: "map",
    label: "Map",
    description: "Spatial structure and topology",
    icon: Map,
    tabs: [
      { id: "neighbourhood", label: "Neighbourhood" },
      { id: "sectioning", label: "Semantic Sectioning" },
      { id: "drift", label: "Vector Drift" },
      { id: "walk", label: "Vector Walk" },
      { id: "textvec", label: "Text Vectorisation" },
    ],
  },
  {
    id: "critique",
    label: "Critique",
    description: "Ideological and political analysis",
    icon: Scale,
    tabs: [
      { id: "compass", label: "Hegemony Compass" },
      { id: "agonism", label: "Agonism Test" },
      { id: "abstraction", label: "Real Abstraction" },
      { id: "silence", label: "Silence Detector" },
      { id: "topology", label: "Persistent Homology" },
    ],
  },
];

function getGroup(tabId: TabId): GroupId {
  for (const group of GROUPS) {
    if (group.tabs.some(t => t.id === tabId)) return group.id;
  }
  return "measure";
}

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const activeGroup = getGroup(activeTab);
  const currentGroup = GROUPS.find(g => g.id === activeGroup)!;

  return (
    <div className="bg-card">
      {/* Group tabs */}
      <div className="px-6 flex gap-0 border-b border-parchment-dark">
        {GROUPS.map(group => {
          const Icon = group.icon;
          const isActive = group.id === activeGroup;
          return (
            <button
              key={group.id}
              onClick={() => onTabChange(group.tabs[0].id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 font-sans text-body-sm font-semibold",
                "border-b-[3px] transition-all duration-200",
                isActive
                  ? "border-burgundy text-burgundy bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-cream/30"
              )}
            >
              <Icon size={16} />
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tabs for active group */}
      <div className="px-6 flex gap-1 py-1 border-b border-parchment bg-muted/30">
        {currentGroup.tabs.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-4 py-1.5 font-sans text-body-sm font-medium rounded-sm",
                "transition-all duration-200",
                isActive
                  ? "text-primary-foreground bg-burgundy shadow-editorial"
                  : "text-muted-foreground hover:text-foreground hover:bg-cream/50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Settings, Moon, Sun } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { HelpDropdown } from "./HelpDropdown";
import { AboutModal } from "./AboutModal";
import { ProviderSelector } from "./ProviderSelector";
import { getGroupLabel, type TabId } from "./TabNav";

interface HeaderProps {
  activeTab?: TabId;
}

export function Header({ activeTab }: HeaderProps) {
  const { settings, toggleDarkMode, setSettingsOpen } = useSettings();
  const viewLabel = activeTab ? getGroupLabel(activeTab) : "";

  return (
    <header className="border-b border-parchment-dark px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Tool branding. The Vector Lab family mark stays in the About
            panel and the footer; the header carries the tool alone. */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/vector-lab-manifold-atlas.svg"
            alt=""
            aria-hidden="true"
            width={26}
            height={26}
            className="block flex-shrink-0"
          />
          <h1 className="font-display text-display-md font-bold text-burgundy tracking-tight leading-none">
            Manifold Atlas
          </h1>
        </div>

        {viewLabel && (
          <>
            <span className="h-6 w-px bg-parchment-dark" aria-hidden="true" />
            <span className="font-sans text-body-sm text-muted-foreground">
              {viewLabel}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ProviderSelector />
        <AboutModal />
        <HelpDropdown />
        <button
          onClick={toggleDarkMode}
          className="btn-editorial-ghost px-3 py-2"
          aria-label="Toggle dark mode"
        >
          {settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-editorial-secondary px-3 py-2"
        >
          <Settings size={16} className="mr-2" />
          <span className="font-sans text-body-sm">Settings</span>
        </button>
      </div>
    </header>
  );
}

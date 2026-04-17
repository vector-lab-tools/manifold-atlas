"use client";

import { Settings, Moon, Sun } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { HelpDropdown } from "./HelpDropdown";
import { AboutModal } from "./AboutModal";
import { ProviderSelector } from "./ProviderSelector";

export function Header() {
  const { settings, toggleDarkMode, setSettingsOpen } = useSettings();

  return (
    <header className="border-b border-parchment-dark px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <a
          href="https://vector-lab-tools.github.io"
          target="_blank"
          rel="noopener noreferrer"
          title="Part of the Vector Lab"
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/vector-lab-manifold-atlas.svg"
            alt="Manifold Atlas — a Vector Lab instrument"
            width={32}
            height={32}
            className="block"
          />
        </a>
        <div>
          <h1 className="font-display text-display-md font-bold text-burgundy tracking-tight">
            Manifold Atlas
          </h1>
          <p className="font-sans text-caption text-slate mt-0.5">
            Comparative Geometry of AI Vector Spaces
          </p>
        </div>
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

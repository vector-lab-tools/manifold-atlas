"use client";

import { useState } from "react";
import { Info, X, ChevronRight } from "lucide-react";
import { ReadingListModal } from "./ReadingListModal";
import { VERSION, VERSION_DATE } from "@/lib/version";

export function AboutModal() {
  const [open, setOpen] = useState(false);
  const [readingListOpen, setReadingListOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-editorial-ghost px-3 py-2"
        title="About Manifold Atlas"
      >
        <Info size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setOpen(false)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[calc(100vw-2rem)] card-editorial shadow-editorial-lg animate-fade-in flex flex-col"
            style={{ maxHeight: "calc(100vh - 2rem)" }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/vector-lab-manifold-atlas.svg"
                  alt=""
                  width={40}
                  height={40}
                  aria-hidden="true"
                  className="block flex-shrink-0 mt-1"
                />
                <div>
                  <h2 className="font-display text-display-lg font-bold text-burgundy">Manifold Atlas</h2>
                  <p className="font-sans text-caption text-muted-foreground mt-0.5">
                    Comparative Geometry of AI Vector Spaces
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="btn-editorial-ghost px-2 py-1">
                <X size={16} />
              </button>
            </div>

            <div className="thin-rule mx-6" />

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

            {/* Details */}
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-y-2 font-sans text-body-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">{VERSION}</span>

                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{VERSION_DATE}</span>

                <span className="text-muted-foreground">Author</span>
                <span className="font-medium">David M. Berry</span>

                <span className="text-muted-foreground">Affiliation</span>
                <span className="font-medium">University of Sussex</span>

                <span className="text-muted-foreground">Implemented with</span>
                <span className="font-medium">Claude Code 4.6</span>

                <span className="text-muted-foreground">Design system</span>
                <span className="font-medium">CCS-WB Editorial</span>

                <span className="text-muted-foreground">Licence</span>
                <span className="font-medium">MIT</span>
              </div>
            </div>

            <div className="thin-rule mx-6" />

            {/* Description */}
            <div className="px-6 py-4">
              <p className="font-body text-body-sm text-slate leading-relaxed">
                Manifold Atlas is a vector-native research tool for studying how large language
                models organise meaning geometrically. It operationalises{" "}
                <a
                  href="https://stunlaw.blogspot.com/2026/02/vector-theory.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-burgundy underline underline-offset-2"
                >
                  Vector Theory
                </a>{" "}
                by using embedding APIs as a telescope to observe the manifold, cosine
                similarity as the primary instrument, and critical theory as the interpretive
                framework. Without the framework, the numbers are curiosities. With it, they
                are evidence for geometric ideology, the negation deficit, and the proprietary
                encoding of human language.
              </p>
              <p className="font-body text-body-sm text-slate leading-relaxed mt-3">
                The <strong>Library</strong> (fourth tab group) runs curated sequences of
                operations in one click. Every step is editable before running, so you can
                substitute your own claims, anchors, or terms. Add your own protocols via
                markdown (paste or file upload); they persist in your browser and can be
                edited or removed alongside the built-ins.
              </p>
            </div>

            <div className="thin-rule mx-6" />

            {/* Reading List */}
            <div className="px-6 py-4">
              <button
                onClick={() => setReadingListOpen(true)}
                className="flex items-center gap-1.5 font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors"
              >
                <ChevronRight size={12} />
                Suggested Reading List...
              </button>
            </div>

            <div className="thin-rule mx-6" />

            {/* Vector Lab family */}
            <div className="px-6 py-4">
              <h3 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Part of the Vector Lab
              </h3>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/vector-lab-logo-mark.svg"
                  alt=""
                  width={32}
                  height={32}
                  aria-hidden="true"
                  className="block flex-shrink-0 mt-0.5 opacity-90"
                />
                <div className="font-body text-body-sm text-slate leading-relaxed">
                  <p>
                    Manifold Atlas is one of five research instruments in the{" "}
                    <a
                      href="https://vector-lab-tools.github.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
                    >
                      Vector Lab
                    </a>. <strong>Manifold Atlas maps the terrain between models.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="thin-rule mx-6" />

            {/* Links */}
            <div className="px-6 py-4 flex items-center gap-4 font-sans text-body-sm">
              <a
                href="https://github.com/vector-lab-tools/manifold-atlas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
              >
                GitHub
              </a>
              <a
                href="https://stunlaw.blogspot.com/2026/02/vector-theory.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
              >
                Vector Theory
              </a>
              <a
                href="https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
              >
                What is Vector Space?
              </a>
              <a
                href="https://stunlaw.blogspot.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-burgundy underline underline-offset-2 hover:text-burgundy-900"
              >
                Stunlaw
              </a>
            </div>

            <div className="thin-rule mx-6" />

            {/* Acknowledgements */}
            <div className="px-6 py-4">
              <h3 className="font-sans text-caption text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Acknowledgements
              </h3>
              <p className="font-body text-body-sm text-slate">
                Many thanks to Michael Castelle, Michael Dieter, Richard Rogers,
                Wolfgang Ernst, and others for feedback and comments on the Manifold
                Atlas.
              </p>
            </div>

            {/* Easter egg hint */}
            <div className="px-6 pb-5">
              <p className="font-sans text-[10px] text-muted-foreground italic">
                Try typing clippy, hacker, hinton, or marx anywhere outside a text field.
              </p>
            </div>

            {/* /Scrollable body */}
            </div>
          </div>
        </>
      )}

      {/* Reading List modal */}
      <ReadingListModal open={readingListOpen} onClose={() => setReadingListOpen(false)} />
    </>
  );
}

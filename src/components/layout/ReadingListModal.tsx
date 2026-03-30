"use client";

import { X } from "lucide-react";

interface ReadingListModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReadingListModal({ open, onClose }: ReadingListModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[560px] max-w-[90vw] max-h-[80vh] overflow-y-auto card-editorial shadow-editorial-lg animate-fade-in">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h2 className="font-display text-display-md font-bold">Suggested Reading List</h2>
          <button onClick={onClose} className="btn-editorial-ghost px-2 py-1">
            <X size={16} />
          </button>
        </div>
        <div className="thin-rule mx-6" />
        <div className="px-6 py-5 space-y-3 font-body text-body-sm text-slate">
          <p>Ackerman, A., Gefen, A., Somaini, A. and Viewing, P. (eds) (2025) <em>The World Through AI: Exploring Latent Spaces</em>, exhibition catalogue. Paris: Jeu de Paume / JBE Books.</p>
          <p>Beguš, N. (2025) <em>Artificial Humanities</em>. University of Michigan Press.</p>
          <p>Berry, D.M. (2026) &lsquo;<a href="https://stunlaw.blogspot.com/2026/03/the-vector-medium.html" target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-2">The Vector Medium</a>&rsquo;, <em>Stunlaw</em>.</p>
          <p>Berry, D.M. (2026) &lsquo;<a href="https://stunlaw.blogspot.com/2026/02/vector-theory.html" target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-2">Vector Theory</a>&rsquo;, <em>Stunlaw</em>.</p>
          <p>Berry, D.M. (2026) &lsquo;<a href="https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html" target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-2">What is Vector Space?</a>&rsquo;, <em>Stunlaw</em>.</p>
          <p>Goriunova, O. (2025) <em>Ideal Subjects: The Abstract People of AI</em>. University of Minnesota Press.</p>
          <p>Impett, L. and Offert, F. (2026) <em>Vector Media</em>. University of Minnesota Press.</p>
          <p>Manovich, L. and Arielli, E. (2024) <em><a href="https://manovich.net/index.php/projects/artificial-aesthetics" target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-2">Artificial Aesthetics: Generative AI, Arts and Visual Media</a></em>.</p>
          <p>Pasquinelli, M. (2023) <em>The Eye of the Master: A Social History of AI</em>. Verso.</p>
          <p>Somaini, A. (2023) &lsquo;A Theory of Latent Spaces&rsquo;, <em>Grey Room</em>, 93.</p>
          <p>Steyerl, H. (2025) <em>Medium Hot: Images in the Age of Heat</em>. London: Verso.</p>
        </div>
      </div>
    </>
  );
}

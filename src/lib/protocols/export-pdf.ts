/**
 * Protocol Run PDF export.
 *
 * Produces a researcher-oriented PDF bundle for a single Protocol run:
 * title page with run metadata, the protocol description, and then
 * each step with its full deep-dive data (per-model tables, matrices,
 * nearest-concept rankings, agonism and battery matrices, Hegemony
 * Compass images rendered from the static SVG pipeline, and Distance
 * Matrix heatmaps of numeric values).
 *
 * Uses jsPDF + jspdf-autotable. SVG compass snapshots are rasterised
 * to PNG via an off-screen canvas before embedding so the output is
 * consistent across viewers.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Protocol, ProtocolRun, ProtocolStepResult } from "@/types/protocols";
import type { ConceptDistanceResult } from "@/lib/operations/concept-distance";
import type { VectorLogicResult } from "@/lib/operations/vector-logic";
import type { NegationGaugeResult } from "@/lib/operations/negation-gauge";
import type { SemanticSectioningResult } from "@/lib/operations/semantic-sectioning";
import type { NegationBatteryResult } from "@/lib/operations/negation-battery";
import type { AgonismTestResult } from "@/lib/operations/agonism-test";
import type {
  HegemonyCompassResult,
  HegemonyCompassModelResult,
} from "@/lib/operations/hegemony-compass";
import type { DistanceMatrixResult } from "@/lib/operations/distance-matrix";
import type { GrammarOfVectorsResult } from "@/lib/operations/grammar-of-vectors";
import { semanticSectioningSignature } from "@/lib/operations/semantic-sectioning";
import { renderCompassSvgString } from "@/components/viz/CompassSvg";

// A4 in points (72 dpi). Margins 44pt on all sides.
const MARGIN = 44;
const PAGE_W = 595;
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Brand colours (CCS-WB editorial palette adapted to RGB).
const INK: [number, number, number] = [58, 51, 40];        // #3a3328
const MUTED: [number, number, number] = [120, 110, 95];
const BURGUNDY: [number, number, number] = [133, 52, 52];
const GOLD: [number, number, number] = [160, 110, 20];

/**
 * Rasterise an SVG string to a PNG data URL via an off-screen canvas.
 * Rejects on any failure so the caller can skip the image and continue.
 */
async function svgToPng(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Base64-encode so the loader is indifferent to quoting in the SVG.
    const b64 =
      typeof window !== "undefined" && typeof window.btoa === "function"
        ? window.btoa(unescape(encodeURIComponent(svg)))
        : Buffer.from(svg, "utf8").toString("base64");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2; // Retina-ish
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("SVG -> PNG rasterisation failed"));
    img.src = `data:image/svg+xml;base64,${b64}`;
  });
}

interface Cursor {
  y: number;
}

/** Ensure there's at least `needed` pt of vertical space; add a page if not. */
function ensureSpace(doc: jsPDF, cur: Cursor, needed: number) {
  if (cur.y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    cur.y = MARGIN;
  }
}

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** Write wrapped text and advance the cursor. */
function writeText(
  doc: jsPDF,
  cur: Cursor,
  text: string,
  opts: {
    size?: number;
    style?: "normal" | "bold" | "italic";
    colour?: [number, number, number];
    gapAfter?: number;
    maxWidth?: number;
  } = {}
) {
  const { size = 10, style = "normal", colour = INK, gapAfter = 4, maxWidth = CONTENT_W } = opts;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  setFill(doc, colour);
  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = size * 1.35;
  ensureSpace(doc, cur, lineHeight * lines.length);
  doc.text(lines, MARGIN, cur.y);
  cur.y += lineHeight * lines.length + gapAfter;
}

function writeDivider(doc: jsPDF, cur: Cursor) {
  ensureSpace(doc, cur, 12);
  doc.setDrawColor(210, 200, 180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cur.y + 4, MARGIN + CONTENT_W, cur.y + 4);
  cur.y += 12;
}

function writeTable(
  doc: jsPDF,
  cur: Cursor,
  head: string[][],
  body: (string | number)[][],
  opts: { columnStyles?: Record<number, { halign?: string; cellWidth?: number | "auto" }> } = {}
) {
  if (body.length === 0) return;
  autoTable(doc, {
    startY: cur.y,
    head,
    body: body.map(r => r.map(c => (typeof c === "number" ? c.toString() : c))),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      textColor: INK,
      lineColor: [210, 200, 180],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [235, 228, 212],
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8,
    },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: opts.columnStyles as Record<number, Partial<{ halign: "left" | "center" | "right"; cellWidth: number | "auto" }>> | undefined,
  });
  // Update cursor from jspdf-autotable's finalY state.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (typeof finalY === "number") cur.y = finalY + 10;
  else cur.y += 10;
}

// ---------------------------------------------------------------------------
// Per-operation deep-dive writers.
// ---------------------------------------------------------------------------

function writeHeadline(doc: jsPDF, cur: Cursor, headline: Record<string, number | string> | undefined) {
  if (!headline) return;
  const rows: string[][] = Object.entries(headline).map(([k, v]) => [k, String(v)]);
  if (rows.length === 0) return;
  writeText(doc, cur, "Headline", { size: 9, style: "bold", colour: MUTED, gapAfter: 2 });
  writeTable(doc, cur, [["metric", "value"]], rows, {
    columnStyles: { 0: { cellWidth: 160 }, 1: { cellWidth: "auto" } },
  });
}

function writeDistance(doc: jsPDF, cur: Cursor, r: ConceptDistanceResult) {
  writeText(doc, cur, `${r.termA}  vs  ${r.termB}`, { size: 10, style: "italic", colour: MUTED, gapAfter: 6 });
  writeTable(
    doc,
    cur,
    [["Model", "Cosine", "Distance", "Angular (deg)", "Euclidean", "|A|", "|B|", "Dims"]],
    r.models.map(m => [
      m.modelName,
      m.cosineSimilarity.toFixed(4),
      m.cosineDistance.toFixed(4),
      m.angularDistance.toFixed(1),
      m.euclideanDistance.toFixed(4),
      m.normA.toFixed(3),
      m.normB.toFixed(3),
      String(m.dimensions),
    ])
  );
}

function writeVectorLogic(doc: jsPDF, cur: Cursor, r: VectorLogicResult) {
  writeText(doc, cur, `${r.a}  -  ${r.b}  +  ${r.c}`, { size: 10, style: "italic", colour: MUTED, gapAfter: 6 });
  for (const m of r.models) {
    writeText(doc, cur, m.modelName, { size: 9, style: "bold", gapAfter: 2 });
    writeTable(
      doc,
      cur,
      [["Rank", "Concept", "Cosine"]],
      m.nearest.map((n, i) => [String(i + 1), n.concept, n.similarity.toFixed(4)])
    );
  }
}

function writeNegation(doc: jsPDF, cur: Cursor, r: NegationGaugeResult) {
  writeText(doc, cur, `Statement: ${r.original}`, { size: 10, gapAfter: 2 });
  writeText(doc, cur, `Negation:  ${r.negated}`, { size: 10, colour: MUTED, gapAfter: 2 });
  writeText(doc, cur, `Threshold: ${r.threshold}`, { size: 9, colour: MUTED, gapAfter: 6 });
  writeTable(
    doc,
    cur,
    [["Model", "Cosine", "Distance", "Angular (deg)", "Collapsed?"]],
    r.models.map(m => [
      m.modelName,
      m.cosineSimilarity.toFixed(4),
      m.cosineDistance.toFixed(4),
      m.angularDistance.toFixed(1),
      m.collapsed ? "yes" : "no",
    ])
  );
}

function writeSectioning(doc: jsPDF, cur: Cursor, r: SemanticSectioningResult) {
  writeText(doc, cur, `${r.anchorA}  ->  ${r.anchorB}`, { size: 10, style: "italic", colour: MUTED, gapAfter: 2 });
  writeText(doc, cur, `${r.steps + 1} interpolation points across ${r.vocabulary.length} reference concepts`, { size: 9, colour: MUTED, gapAfter: 6 });
  for (const m of r.models) {
    const signature = semanticSectioningSignature(m);
    writeText(doc, cur, `${m.modelName}  ·  anchor cosine ${m.anchorSimilarity.toFixed(4)}`, { size: 9, style: "bold", gapAfter: 2 });
    writeText(doc, cur, signature.join("  ->  "), { size: 9, gapAfter: 4 });
    writeTable(
      doc,
      cur,
      [["t", "Nearest concept", "Cosine"]],
      m.path.map(p => [p.position.toFixed(2), p.nearestConcept, p.nearestSimilarity.toFixed(4)])
    );
  }
}

function writeBattery(doc: jsPDF, cur: Cursor, r: NegationBatteryResult) {
  const modelNames = r.statements[0]?.models.map(m => m.modelName) ?? [];
  writeText(
    doc,
    cur,
    `${r.summary.totalStatements} statements · collapse rate ${(r.summary.collapseRate * 100).toFixed(1)}% · avg cosine ${r.summary.avgSimilarity.toFixed(4)} · ${r.summary.totalCollapsed} / ${r.summary.totalTests} collapsed · threshold ${r.threshold}`,
    { size: 9, colour: MUTED, gapAfter: 6 }
  );
  writeTable(
    doc,
    cur,
    [["Statement / Negation", ...modelNames]],
    r.statements.map(row => [
      `${row.statement}\n-> ${row.negated}`,
      ...row.models.map(m => (m.collapsed ? `${m.similarity.toFixed(3)} *` : m.similarity.toFixed(3))),
    ])
  );
  writeText(doc, cur, "Values marked * are at or above the collapse threshold.", { size: 8, style: "italic", colour: MUTED });
}

function writeAgonism(doc: jsPDF, cur: Cursor, r: AgonismTestResult) {
  const modelNames = r.pairs[0]?.models.map(m => m.modelName) ?? [];
  writeText(
    doc,
    cur,
    `${r.summary.totalPairs} pairs · opposition preserved ${(r.summary.preservedRate * 100).toFixed(1)}% · avg cosine ${r.summary.avgSimilarity.toFixed(4)} · threshold ${r.threshold}`,
    { size: 9, colour: MUTED, gapAfter: 6 }
  );
  writeTable(
    doc,
    cur,
    [["Pair (A vs B)", ...modelNames]],
    r.pairs.map(row => [
      row.pair.positionA.thinker || row.pair.positionB.thinker
        ? `${row.pair.label}\n(${row.pair.positionA.thinker || "A"} vs ${row.pair.positionB.thinker || "B"})`
        : row.pair.label,
      ...row.models.map(m => (!m.agonismPreserved ? `${m.similarity.toFixed(3)} *` : m.similarity.toFixed(3))),
    ])
  );
  writeText(doc, cur, "Values marked * are at or above the agonism-collapse threshold.", { size: 8, style: "italic", colour: MUTED });
}

async function writeCompass(doc: jsPDF, cur: Cursor, r: HegemonyCompassResult) {
  writeText(
    doc,
    cur,
    `${r.presetName} · ${r.concepts.length} concepts · X: ${r.xAxisLabels.negative} vs ${r.xAxisLabels.positive} · Y: ${r.yAxisLabels.negative} vs ${r.yAxisLabels.positive}`,
    { size: 9, colour: MUTED, gapAfter: 6 }
  );
  for (const m of r.models) {
    writeText(doc, cur, m.modelName, { size: 10, style: "bold", gapAfter: 2 });
    // Rasterise and embed the compass SVG.
    const svg = renderCompassSvgString(r, m, 520);
    try {
      const png = await svgToPng(svg, 520, 520);
      const imgW = 320;
      const imgH = 320;
      ensureSpace(doc, cur, imgH + 8);
      doc.addImage(png, "PNG", (PAGE_W - imgW) / 2, cur.y, imgW, imgH);
      cur.y += imgH + 8;
    } catch (err) {
      writeText(doc, cur, `(compass image could not be embedded: ${(err as Error).message})`, { size: 9, style: "italic", colour: MUTED });
    }

    await writeCompassAxisStats(doc, cur, m);
    await writeCompassPositions(doc, cur, m);
  }
}

async function writeCompassAxisStats(doc: jsPDF, cur: Cursor, m: HegemonyCompassModelResult) {
  writeText(doc, cur, "Axis statistics", { size: 9, style: "bold", colour: MUTED, gapAfter: 2 });
  writeTable(
    doc,
    cur,
    [["Axis", "Inter-pole cos", "Axis norm", `${m.xNeg.label} coh.`, `${m.xPos.label} coh.`]],
    [
      [
        `${m.xNeg.label} vs ${m.xPos.label}`,
        m.xInterPoleCosine.toFixed(4),
        m.xAxisNorm.toFixed(4),
        Number.isFinite(m.xNeg.coherence) ? m.xNeg.coherence.toFixed(4) : "-",
        Number.isFinite(m.xPos.coherence) ? m.xPos.coherence.toFixed(4) : "-",
      ],
      [
        `${m.yNeg.label} vs ${m.yPos.label}`,
        m.yInterPoleCosine.toFixed(4),
        m.yAxisNorm.toFixed(4),
        Number.isFinite(m.yNeg.coherence) ? m.yNeg.coherence.toFixed(4) : "-",
        Number.isFinite(m.yPos.coherence) ? m.yPos.coherence.toFixed(4) : "-",
      ],
    ]
  );
}

async function writeCompassPositions(doc: jsPDF, cur: Cursor, m: HegemonyCompassModelResult) {
  writeText(doc, cur, "Per-concept positions", { size: 9, style: "bold", colour: MUTED, gapAfter: 2 });
  writeTable(
    doc,
    cur,
    [["Concept", "X", "Y", `cos ${m.xNeg.label}`, `cos ${m.xPos.label}`, `cos ${m.yNeg.label}`, `cos ${m.yPos.label}`]],
    m.points.map(p => [
      p.concept,
      (p.x >= 0 ? "+" : "") + p.x.toFixed(4),
      (p.y >= 0 ? "+" : "") + p.y.toFixed(4),
      p.simXNeg.toFixed(4),
      p.simXPos.toFixed(4),
      p.simYNeg.toFixed(4),
      p.simYPos.toFixed(4),
    ])
  );
}

function writeMatrix(doc: jsPDF, cur: Cursor, r: DistanceMatrixResult) {
  writeText(
    doc,
    cur,
    `${r.concepts.length} concepts · ${(r.concepts.length * (r.concepts.length - 1)) / 2} pairs per model`,
    { size: 9, colour: MUTED, gapAfter: 6 }
  );
  for (const m of r.models) {
    writeText(doc, cur, m.modelName, { size: 10, style: "bold", gapAfter: 2 });
    writeText(
      doc,
      cur,
      `Most similar: ${m.mostSimilar.a} vs ${m.mostSimilar.b} (${m.mostSimilar.sim.toFixed(4)}) · Least similar: ${m.leastSimilar.a} vs ${m.leastSimilar.b} (${m.leastSimilar.sim.toFixed(4)}) · Avg cosine: ${m.avgSimilarity.toFixed(4)}`,
      { size: 9, gapAfter: 4 }
    );
    writeTable(
      doc,
      cur,
      [["", ...r.concepts]],
      m.matrix.map((row, i) => [r.concepts[i], ...row.map(v => v.toFixed(3))])
    );
  }
  if (r.contestedPairs.length > 0) {
    writeText(doc, cur, "Contested geometry - pairs where models disagree most", { size: 9, style: "bold", colour: MUTED, gapAfter: 2 });
    writeTable(
      doc,
      cur,
      [["Pair", "Variance", "Range", "Min", "Max"]],
      r.contestedPairs.map(p => [
        `${p.a} vs ${p.b}`,
        p.variance.toFixed(6),
        p.range.toFixed(4),
        p.min.toFixed(4),
        p.max.toFixed(4),
      ])
    );
  }
}

async function writeStep(doc: jsPDF, cur: Cursor, index: number, s: ProtocolStepResult) {
  const label = s.step.label || s.step.operation;
  writeText(doc, cur, `${index + 1}. ${label}`, { size: 13, style: "bold", colour: BURGUNDY, gapAfter: 2 });
  const statusBits: string[] = [s.step.operation];
  statusBits.push(`status: ${s.status}`);
  if (typeof s.elapsedMs === "number") {
    statusBits.push(s.elapsedMs < 1000 ? `${s.elapsedMs.toFixed(0)} ms` : `${(s.elapsedMs / 1000).toFixed(2)} s`);
  }
  if (s.models.length > 0) statusBits.push(`${s.models.length} model${s.models.length === 1 ? "" : "s"}`);
  writeText(doc, cur, statusBits.join(" · "), { size: 9, colour: MUTED, gapAfter: 6 });

  if (s.error) {
    writeText(doc, cur, s.error, { size: 10, style: "italic", colour: BURGUNDY, gapAfter: 6 });
    return;
  }
  if (s.status !== "done" || !s.details) {
    writeText(doc, cur, "(no result data)", { size: 9, style: "italic", colour: MUTED, gapAfter: 6 });
    return;
  }

  writeHeadline(doc, cur, s.headline);

  switch (s.step.operation) {
    case "distance":
      writeDistance(doc, cur, s.details as ConceptDistanceResult);
      break;
    case "analogy":
      writeVectorLogic(doc, cur, s.details as VectorLogicResult);
      break;
    case "negation":
      writeNegation(doc, cur, s.details as NegationGaugeResult);
      break;
    case "sectioning":
      writeSectioning(doc, cur, s.details as SemanticSectioningResult);
      break;
    case "battery":
      writeBattery(doc, cur, s.details as NegationBatteryResult);
      break;
    case "agonism":
      writeAgonism(doc, cur, s.details as AgonismTestResult);
      break;
    case "compass":
      await writeCompass(doc, cur, s.details as HegemonyCompassResult);
      break;
    case "matrix":
      writeMatrix(doc, cur, s.details as DistanceMatrixResult);
      break;
    case "grammar":
      writeGrammar(doc, cur, s.details as GrammarOfVectorsResult);
      break;
  }
}

function writeGrammar(doc: jsPDF, cur: Cursor, r: GrammarOfVectorsResult) {
  writeText(
    doc,
    cur,
    `${r.grammarName} · source: ${r.register ?? "custom"} · ${r.summary.totalPairs} constructions · ` +
      `opposition preserved ${(r.summary.preservedRate * 100).toFixed(1)}% · ` +
      `avg cosine ${r.summary.avgSimilarity.toFixed(4)} · threshold ${r.threshold}`,
    { size: 9, colour: MUTED, gapAfter: 6 }
  );
  if (r.summary.mostDeceptive) {
    writeText(
      doc,
      cur,
      `Most deceptive: "${r.summary.mostDeceptive.raw}" — cos ${r.summary.mostDeceptive.cosine.toFixed(3)} in ${r.summary.mostDeceptive.modelName}.`,
      { size: 9, colour: INK, gapAfter: 6, style: "italic" }
    );
  }
  const modelNames = r.pairs[0]?.models.map(m => m.modelName) ?? [];
  writeTable(
    doc,
    cur,
    [["Construction (X / Y)", ...modelNames]],
    r.pairs.map(row => [
      `${row.instance.raw}\nX: ${row.instance.parts[0]} | Y: ${row.instance.parts[1]}`,
      ...row.models.map(m => (!m.oppositionPreserved ? `${m.cosineSimilarity.toFixed(3)} *` : m.cosineSimilarity.toFixed(3))),
    ])
  );
  writeText(
    doc,
    cur,
    "Values marked * are at or above the threshold — the rhetoric of opposition exceeds the geometry of opposition.",
    { size: 8, style: "italic", colour: MUTED }
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a PDF report for a completed Protocol run and trigger a
 * browser download.
 */
export async function exportRunAsPDF(run: ProtocolRun, protocol: Protocol): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur: Cursor = { y: MARGIN };

  // Header: tool name + family badge.
  setFill(doc, GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("MANIFOLD ATLAS · VECTOR LAB", MARGIN, cur.y);
  cur.y += 14;

  // Title.
  writeText(doc, cur, protocol.title, { size: 22, style: "bold", colour: INK, gapAfter: 4 });
  writeText(doc, cur, protocol.description, { size: 10, colour: INK, gapAfter: 10 });

  // Metadata table.
  writeTable(doc, cur, [["Field", "Value"]], [
    ["Protocol", protocol.id],
    ["Category", protocol.category],
    ["Steps", String(protocol.steps.length)],
    ["Atlas version", run.atlasVersion],
    ["Started", run.startedAt],
    ["Completed", run.completedAt ?? "-"],
    ["Elapsed", run.totalElapsedMs !== undefined ? `${(run.totalElapsedMs / 1000).toFixed(2)} s` : "-"],
    ["Models", run.models.map(m => `${m.name} (${m.providerId})`).join(", ") || "-"],
    ["Unique texts embedded", String(run.stats.embeddedTexts)],
    ["Total queries", String(run.stats.totalQueries)],
  ], {
    columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: "auto" } },
  });

  writeDivider(doc, cur);

  // Steps.
  for (let i = 0; i < run.steps.length; i++) {
    const s = run.steps[i];
    await writeStep(doc, cur, i, s);
    writeDivider(doc, cur);
  }

  // Footer note on the last page.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setFill(doc, MUTED);
  doc.text(
    `Generated by Manifold Atlas v${run.atlasVersion} · vector-lab-tools.github.io`,
    MARGIN,
    PAGE_H - MARGIN / 2
  );

  // Save.
  const filename = `${protocol.id}-${Date.now()}.pdf`;
  doc.save(filename);
}

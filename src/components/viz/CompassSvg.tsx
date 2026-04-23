/**
 * Static SVG rendering of a Hegemony Compass result.
 *
 * Used in the Protocol Runner's step deep-dive (as a React component)
 * and in the PDF export pipeline (as a serialised string). Both paths
 * share renderCompassSvg() so the on-screen and on-page images stay
 * in sync.
 *
 * Rendered deliberately without theme-dependent colours: it always
 * reads as a light-on-ivory compass so that exported files look the
 * same regardless of the user's dark-mode setting. Quadrant shading
 * mirrors the standalone Hegemony Compass tab.
 */

import type {
  HegemonyCompassResult,
  HegemonyCompassModelResult,
} from "@/lib/operations/hegemony-compass";

interface CompassSvgProps {
  result: HegemonyCompassResult;
  model: HegemonyCompassModelResult;
  /** Optional size in pixels. Default 520. */
  size?: number;
}

const SIZE_DEFAULT = 520;
const MARGIN = 44;
const BG = "#f5f2ec";
const AXIS = "rgba(30,30,30,0.65)";
const GRID = "rgba(30,30,30,0.08)";
const TEXT = "#3a3328";
const MUTED = "rgba(30,30,30,0.55)";
const POINT = "rgba(160,110,20,0.92)";
const POINT_RING = "rgba(160,110,20,0.35)";

// Quadrant fills (top-left, top-right, bottom-left, bottom-right).
const Q_TL = "rgba(220,80,80,0.14)";
const Q_TR = "rgba(80,120,220,0.14)";
const Q_BL = "rgba(80,200,80,0.14)";
const Q_BR = "rgba(160,80,200,0.14)";

export interface CompassSvgElements {
  size: number;
  viewBox: string;
  body: string;
}

/**
 * Build the SVG body (everything inside the <svg> tag) for a compass.
 * Shared by the on-screen React component and the PDF export path.
 */
function buildCompassSvg(
  result: HegemonyCompassResult,
  model: HegemonyCompassModelResult,
  size: number
): CompassSvgElements {
  const inner = size - MARGIN * 2;
  const cx = size / 2;
  const cy = size / 2;

  const points = model.points;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const extent = Math.max(0.005, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.25;

  const toX = (vx: number) => cx + (vx / extent) * (inner / 2);
  const toY = (vy: number) => cy - (vy / extent) * (inner / 2);

  const halfInner = inner / 2;

  const parts: string[] = [];

  // Background
  parts.push(`<rect x="0" y="0" width="${size}" height="${size}" fill="${BG}"/>`);

  // Quadrants — shaded background rectangles.
  parts.push(`<rect x="${cx - halfInner}" y="${cy - halfInner}" width="${halfInner}" height="${halfInner}" fill="${Q_TL}"/>`);
  parts.push(`<rect x="${cx}" y="${cy - halfInner}" width="${halfInner}" height="${halfInner}" fill="${Q_TR}"/>`);
  parts.push(`<rect x="${cx - halfInner}" y="${cy}" width="${halfInner}" height="${halfInner}" fill="${Q_BL}"/>`);
  parts.push(`<rect x="${cx}" y="${cy}" width="${halfInner}" height="${halfInner}" fill="${Q_BR}"/>`);

  // Grid (four minor lines).
  for (const frac of [0.5, -0.5]) {
    const x = cx + frac * halfInner;
    parts.push(`<line x1="${x}" y1="${cy - halfInner}" x2="${x}" y2="${cy + halfInner}" stroke="${GRID}" stroke-width="1"/>`);
    const y = cy + frac * halfInner;
    parts.push(`<line x1="${cx - halfInner}" y1="${y}" x2="${cx + halfInner}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
  }

  // Zero-lines (thicker, emphasised).
  parts.push(`<line x1="${cx}" y1="${cy - halfInner}" x2="${cx}" y2="${cy + halfInner}" stroke="${AXIS}" stroke-width="1.4"/>`);
  parts.push(`<line x1="${cx - halfInner}" y1="${cy}" x2="${cx + halfInner}" y2="${cy}" stroke="${AXIS}" stroke-width="1.4"/>`);

  // Border box.
  parts.push(`<rect x="${cx - halfInner}" y="${cy - halfInner}" width="${inner}" height="${inner}" fill="none" stroke="${MUTED}" stroke-width="1"/>`);

  // Axis-edge labels.
  parts.push(labelText(cx + halfInner, cy - 6, `${result.xAxisLabels.positive} →`, { anchor: "end", weight: "bold", size: 12 }));
  parts.push(labelText(cx - halfInner, cy - 6, `← ${result.xAxisLabels.negative}`, { anchor: "start", weight: "bold", size: 12 }));
  parts.push(labelText(cx + 8, cy - halfInner + 6, `↑ ${result.yAxisLabels.positive}`, { anchor: "start", weight: "bold", size: 12, baseline: "hanging" }));
  parts.push(labelText(cx + 8, cy + halfInner - 6, `↓ ${result.yAxisLabels.negative}`, { anchor: "start", weight: "bold", size: 12 }));

  // Preset title + model subtitle at the top centre, inside margin.
  parts.push(labelText(cx, MARGIN / 2, result.presetName, { anchor: "middle", weight: "bold", size: 14, baseline: "middle" }));
  parts.push(labelText(cx, MARGIN / 2 + 16, model.modelName, { anchor: "middle", size: 11, baseline: "middle", colour: MUTED }));

  // Points + concept labels. Offset label away from centre so they
  // don't sit on the zero-lines.
  for (const p of points) {
    const px = toX(p.x);
    const py = toY(p.y);
    parts.push(`<circle cx="${px}" cy="${py}" r="5" fill="${POINT}" stroke="${POINT_RING}" stroke-width="2"/>`);
    const dy = p.y >= 0 ? -9 : 15;
    parts.push(
      labelText(px, py + dy, escapeXml(p.concept), {
        anchor: "middle",
        size: 11,
        baseline: p.y >= 0 ? "baseline" : "hanging",
        colour: TEXT,
      })
    );
  }

  return {
    size,
    viewBox: `0 0 ${size} ${size}`,
    body: parts.join(""),
  };
}

function labelText(
  x: number,
  y: number,
  text: string,
  opts: {
    anchor?: "start" | "middle" | "end";
    baseline?: "auto" | "hanging" | "middle" | "baseline";
    size?: number;
    weight?: "normal" | "bold";
    colour?: string;
  } = {}
): string {
  const {
    anchor = "start",
    baseline = "auto",
    size = 11,
    weight = "normal",
    colour = TEXT,
  } = opts;
  const extra = baseline !== "auto" ? ` dominant-baseline="${baseline}"` : "";
  const weightAttr = weight !== "normal" ? ` font-weight="${weight}"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"${extra} font-family="Inter, Helvetica, Arial, sans-serif" font-size="${size}" fill="${colour}"${weightAttr}>${escapeXml(text)}</text>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Serialise the compass as a standalone SVG string (with `<?xml?>`
 * prologue and xmlns), suitable for `Blob` download, data URIs, or
 * PDF-library ingestion.
 */
export function renderCompassSvgString(
  result: HegemonyCompassResult,
  model: HegemonyCompassModelResult,
  size: number = SIZE_DEFAULT
): string {
  const { viewBox, body } = buildCompassSvg(result, model, size);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">` +
    body +
    `</svg>`
  );
}

/**
 * React component rendering the compass as inline SVG.
 */
export function CompassSvg({ result, model, size = SIZE_DEFAULT }: CompassSvgProps) {
  const { viewBox, body } = buildCompassSvg(result, model, size);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width="100%"
      style={{ maxWidth: size, display: "block", margin: "0 auto" }}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

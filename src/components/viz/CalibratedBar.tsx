"use client";

/**
 * A cosine plotted on the scale it was measured on.
 *
 * The plain similarity bar fills from zero, which implies the whole
 * interval is available. It is not: nothing sits below the model's
 * unrelated-pair floor, so the region under the floor is drawn as
 * unreachable rather than as empty. Against that, the marks that make
 * the value readable are the floor, the topical ceiling, the control
 * ceiling where one was measured, and identity.
 */

import { MetricTerm } from "@/components/shared/MetricTerm";
import { cn } from "@/lib/utils";

export interface BarMark {
  /** Raw cosine position. */
  value: number;
  label: string;
  /** Glossary key, so the mark's legend entry carries its definition. */
  termKey?: string;
  colour: string;
  /** Dashed marks read as reference lines rather than measurements. */
  dashed?: boolean;
}

interface CalibratedBarProps {
  modelName: string;
  providerId?: string;
  /** The measurement being reported. */
  value: number;
  /** Measured unrelated-pair floor. Null renders the uncalibrated bar. */
  floor: number | null;
  /** Reference marks: ceiling, control ceiling, threshold. */
  marks?: BarMark[];
  /** Position on the floor-to-identity range, when calibrated. */
  normalised?: number | null;
  valueColour?: string;
  className?: string;
}

const W = 100; // viewBox width, so all positions are percentages

export function CalibratedBar({
  modelName,
  providerId,
  value,
  floor,
  marks = [],
  normalised,
  valueColour = "#dc2626",
  className,
}: CalibratedBarProps) {
  const x = (v: number) => Math.max(0, Math.min(W, v * W));
  const floorX = floor === null ? 0 : x(floor);
  const valueX = x(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-sans text-body-sm font-medium truncate">{modelName}</span>
          {providerId && (
            <span className="font-sans text-caption text-slate shrink-0">{providerId}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
          <span className="font-sans text-body-sm font-semibold" style={{ color: valueColour }}>
            {value.toFixed(4)}
          </span>
          {normalised !== null && normalised !== undefined && (
            <span className="font-sans text-caption text-muted-foreground">
              <MetricTerm termKey="normalisedPosition">
                {(normalised * 100).toFixed(0)}% of range
              </MetricTerm>
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} 12`}
        preserveAspectRatio="none"
        className="w-full h-5 overflow-visible"
        role="img"
        aria-label={
          floor === null
            ? `${modelName}: cosine ${value.toFixed(4)}, model not calibrated`
            : `${modelName}: cosine ${value.toFixed(4)} on a scale whose floor is ${floor.toFixed(4)}`
        }
      >
        <defs>
          <pattern
            id="unreachable"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.18" />
          </pattern>
        </defs>

        {/* Track */}
        <rect x="0" y="3" width={W} height="6" rx="1" className="fill-parchment" />

        {/* Region below the floor: no pair of real texts lands here. */}
        {floor !== null && floorX > 0 && (
          <rect
            x="0"
            y="3"
            width={floorX}
            height="6"
            rx="1"
            fill="url(#unreachable)"
            className="text-muted-foreground"
          />
        )}

        {/* Measured value, filled from the floor rather than from zero. */}
        <rect
          x={floorX}
          y="3"
          width={Math.max(0, valueX - floorX)}
          height="6"
          rx="1"
          fill={valueColour}
          opacity="0.85"
        />

        {/* Reference marks */}
        {marks.map((m, i) => (
          <line
            key={`${m.label}-${i}`}
            x1={x(m.value)}
            x2={x(m.value)}
            y1="1"
            y2="11"
            stroke={m.colour}
            strokeWidth="0.6"
            strokeDasharray={m.dashed ? "1.5 1.2" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Floor marker */}
        {floor !== null && (
          <line
            x1={floorX}
            x2={floorX}
            y1="0.5"
            y2="11.5"
            stroke="currentColor"
            strokeWidth="0.8"
            className="text-muted-foreground"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Value marker, drawn last so it reads above the references */}
        <line
          x1={valueX}
          x2={valueX}
          y1="0"
          y2="12"
          stroke={valueColour}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-sans text-[10px] text-muted-foreground">
        {floor === null ? (
          <span className="text-warning-600">
            <MetricTerm termKey="uncalibrated">
              Uncalibrated: this bar has no measured origin
            </MetricTerm>
          </span>
        ) : (
          <span>
            <span className="inline-block w-2 border-t border-muted-foreground align-middle mr-1" />
            <MetricTerm termKey="floor">floor {floor.toFixed(3)}</MetricTerm>
          </span>
        )}
        {marks.map((m, i) => (
          <span key={`legend-${m.label}-${i}`}>
            <span
              className="inline-block w-2 border-t align-middle mr-1"
              style={{ borderColor: m.colour, borderStyle: m.dashed ? "dashed" : "solid" }}
            />
            {m.termKey ? (
              <MetricTerm termKey={m.termKey}>
                {m.label} {m.value.toFixed(3)}
              </MetricTerm>
            ) : (
              <>
                {m.label} {m.value.toFixed(3)}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

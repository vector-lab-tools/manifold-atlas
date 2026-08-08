"use client";

/**
 * The model's cone, drawn as a solid cutting a sphere.
 *
 * An earlier version drew a free wedge whose radius was fixed, which
 * overflowed its box for any wide angle: at 69.6° the arc ran clean off
 * the viewport. Inscribing the cone in the unit sphere fixes that for
 * every angle by construction, and it is the truer picture anyway. The
 * vectors are unit length, so they all terminate on the sphere; the cone
 * is the region of that surface the model actually reaches, and the cap
 * is what a wedge drawing leaves out.
 *
 * Two angles are drawn and they are not the same thing:
 *
 *   the cone half-angle  how far a single text sits from the mean
 *                        direction of the space. This is the radius.
 *   the floor angle      how far apart two unrelated texts sit from each
 *                        other, arccos(floor), the widest separation any
 *                        real pair will show.
 *
 * The second follows from the first: two vectors each at angle a from
 * the mean, in unrelated directions around it, average arccos(cos²a)
 * apart. Both are drawn because a reader given only the half-angle will
 * double it and get the wrong ceiling.
 */

import type { ModelCalibration } from "@/lib/calibration/compute";
import { coneFor, floorFor, REGISTER_LABELS, type Register } from "@/lib/calibration/compute";
import { angleDegrees } from "@/lib/calibration/baseline";

const W = 280;
const H = 200;
const CX = 96;            // sphere centre, left of middle so the cap has room
const CY = H / 2;
const S = 74;             // sphere radius
const SQUASH = 0.34;      // foreshortening for circles seen near edge-on

const rad = (d: number) => (d * Math.PI) / 180;

/** A point on the sphere at `deg` from the axis, in the drawing plane. */
function onSphere(deg: number): [number, number] {
  return [CX + S * Math.cos(rad(deg)), CY - S * Math.sin(rad(deg))];
}

/**
 * The cone's rim: a circle of radius S·sin(a) standing at S·cos(a) along
 * the axis, drawn as an ellipse because it is seen at an angle.
 */
function rim(halfAngle: number) {
  const ry = S * Math.sin(rad(halfAngle));
  return { cx: CX + S * Math.cos(rad(halfAngle)), ry, rx: Math.max(1.5, ry * SQUASH) };
}

export interface ConeDiagramProps {
  cal: ModelCalibration;
  register: Register;
  /** Optional measured value, drawn as a separation inside the cone. */
  value?: { cosine: number; label: string } | null;
  compact?: boolean;
}

export function ConeDiagram({ cal, register, value = null, compact = false }: ConeDiagramProps) {
  const half = coneFor(cal, register);
  const floor = floorFor(cal, register).mean;
  const floorAngle = angleDegrees(floor);
  const ceilingAngle = angleDegrees(cal.topicalCeiling.mean);
  const valueAngle = value ? angleDegrees(value.cosine) : null;

  const r = rim(half);
  const [ex, ey] = onSphere(half);
  const [ex2, ey2] = onSphere(-half);

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${cal.modelName}: cone half-angle ${half.toFixed(1)} degrees for ${REGISTER_LABELS[register]}`}
      >
        {/* The sphere the vectors all terminate on. */}
        <circle cx={CX} cy={CY} r={S} className="fill-foreground/[0.04] stroke-muted-foreground/25" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {/* Equator, for depth. */}
        <ellipse cx={CX} cy={CY} rx={S} ry={S * SQUASH} className="stroke-muted-foreground/15" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />

        {/* The cap the model reaches: filled surface, then the cone body. */}
        <path
          d={`M ${ex} ${ey} A ${S} ${S} 0 ${half > 90 ? 1 : 0} 0 ${ex2} ${ey2} A ${r.rx} ${r.ry} 0 0 1 ${ex} ${ey} Z`}
          className="fill-burgundy/25"
        />
        <path
          d={`M ${CX} ${CY} L ${ex} ${ey} A ${r.rx} ${r.ry} 0 0 0 ${ex2} ${ey2} Z`}
          className="fill-burgundy/15"
        />
        {/* Cone edges. */}
        <line x1={CX} y1={CY} x2={ex} y2={ey} className="stroke-burgundy" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <line x1={CX} y1={CY} x2={ex2} y2={ey2} className="stroke-burgundy" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {/* The rim, front half solid and back half dashed, which is what makes it read as a solid. */}
        <ellipse cx={r.cx} cy={CY} rx={r.rx} ry={r.ry} className="stroke-burgundy/70" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />

        {/* Mean direction. */}
        <line x1={CX} y1={CY} x2={CX + S} y2={CY} className="stroke-burgundy/60" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />

        {/* Two unrelated texts, at the measured floor angle apart. */}
        <line x1={CX} y1={CY} x2={onSphere(floorAngle / 2)[0]} y2={onSphere(floorAngle / 2)[1]} className="stroke-foreground/75" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <line x1={CX} y1={CY} x2={onSphere(-floorAngle / 2)[0]} y2={onSphere(-floorAngle / 2)[1]} className="stroke-foreground/75" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />

        {/* A measured pair, when one was supplied. */}
        {valueAngle !== null && (
          <>
            <line x1={CX} y1={CY} x2={onSphere(valueAngle / 2)[0] } y2={onSphere(valueAngle / 2)[1]} className="stroke-gold" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            <line x1={CX} y1={CY} x2={onSphere(-valueAngle / 2)[0]} y2={onSphere(-valueAngle / 2)[1]} className="stroke-gold" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </>
        )}

        {/* Apex. */}
        <circle cx={CX} cy={CY} r="2" className="fill-burgundy" />

        <text x={CX + 5} y={CY - 5} className="fill-burgundy" fontSize="8.5" fontWeight="700">
          {half.toFixed(1)}°
        </text>
        <text x={W - 4} y={H - 5} textAnchor="end" className="fill-muted-foreground" fontSize="7">
          dashed sphere = all directions
        </text>
      </svg>

      {!compact && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-sans text-[10px] tabular-nums">
          <dt className="text-muted-foreground">Radius (half-angle)</dt>
          <dd className="text-right font-semibold">{half.toFixed(1)}°</dd>
          <dt className="text-muted-foreground">Unrelated pair sits at</dt>
          <dd className="text-right">{floorAngle.toFixed(1)}° &middot; cos {floor.toFixed(3)}</dd>
          <dt className="text-muted-foreground">Same subject sits at</dt>
          <dd className="text-right">
            {ceilingAngle.toFixed(1)}° &middot; cos {cal.topicalCeiling.mean.toFixed(3)}
          </dd>
          {value && valueAngle !== null && (
            <>
              <dt className="text-gold font-semibold truncate">{value.label}</dt>
              <dd className="text-right text-gold font-semibold">
                {valueAngle.toFixed(1)}° &middot; cos {value.cosine.toFixed(3)}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Surface unreached</dt>
          <dd className="text-right">
            {(((1 - (1 - Math.cos(rad(half))) / 2) * 100)).toFixed(0)}%
          </dd>
        </dl>
      )}
    </div>
  );
}

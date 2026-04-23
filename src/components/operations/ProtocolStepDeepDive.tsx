"use client";

/**
 * Deep-dive renderer for Protocol Runner step cards.
 *
 * Dispatches on step.operation and renders a compact, tabular deep
 * dive of the step's full result (stored in ProtocolStepResult.details).
 * Mirrors the collapsible deep-dive convention used across the tool's
 * standalone operation views.
 */

import type { ProtocolStepResult } from "@/types/protocols";
import type { ConceptDistanceResult } from "@/lib/operations/concept-distance";
import type { VectorLogicResult } from "@/lib/operations/vector-logic";
import type { NegationGaugeResult } from "@/lib/operations/negation-gauge";
import type { SemanticSectioningResult } from "@/lib/operations/semantic-sectioning";
import { semanticSectioningSignature } from "@/lib/operations/semantic-sectioning";
import type { NegationBatteryResult } from "@/lib/operations/negation-battery";
import type { AgonismTestResult } from "@/lib/operations/agonism-test";

interface ProtocolStepDeepDiveProps {
  step: ProtocolStepResult;
}

export function ProtocolStepDeepDive({ step }: ProtocolStepDeepDiveProps) {
  if (step.status !== "done" || step.details == null) return null;

  switch (step.step.operation) {
    case "distance":
      return <DistanceDeepDive result={step.details as ConceptDistanceResult} />;
    case "analogy":
      return <VectorLogicDeepDive result={step.details as VectorLogicResult} />;
    case "negation":
      return <NegationDeepDive result={step.details as NegationGaugeResult} />;
    case "sectioning":
      return <SectioningDeepDive result={step.details as SemanticSectioningResult} />;
    case "battery":
      return <BatteryDeepDive result={step.details as NegationBatteryResult} />;
    case "agonism":
      return <AgonismDeepDive result={step.details as AgonismTestResult} />;
    default:
      return null;
  }
}

// --- Generic table primitives --------------------------------------

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-sans text-caption">{children}</table>
    </div>
  );
}

function Th({
  children,
  align = "left",
  tip,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  /** Hover description for the column. Rendered via the native title attribute. */
  tip?: string;
}) {
  return (
    <th
      title={tip}
      className={`${
        align === "right" ? "text-right" : "text-left"
      } px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold ${
        tip ? "cursor-help decoration-dotted underline-offset-2 decoration-muted-foreground/40 underline" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-2 py-1 ${align === "right" ? "text-right" : "text-left"} ${
        mono ? "tabular-nums" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="font-sans text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
      {children}
    </h5>
  );
}

// --- Per-operation renderers ---------------------------------------

function DistanceDeepDive({ result }: { result: ConceptDistanceResult }) {
  return (
    <div className="space-y-3">
      <SectionHeading>Per-model metrics</SectionHeading>
      <Table>
        <thead>
          <tr className="border-b border-parchment">
            <Th tip="Embedding model that produced this row">Model</Th>
            <Th align="right" tip="Cosine similarity between the two vectors. 1.0 = identical direction, 0.0 = orthogonal, -1.0 = opposite. Ignores magnitude.">Cosine</Th>
            <Th align="right" tip="Cosine distance = 1 − cosine similarity. Lower means closer in the manifold.">Distance</Th>
            <Th align="right" tip="Angular distance in degrees between the two vectors. 0° = identical direction, 90° = orthogonal, 180° = opposite.">Angular (°)</Th>
            <Th align="right" tip="Euclidean (L2) distance between the two vectors. Depends on both direction and magnitude, unlike cosine.">Euclidean</Th>
            <Th align="right" tip="L2 norm (magnitude) of the vector for term A.">‖A‖</Th>
            <Th align="right" tip="L2 norm (magnitude) of the vector for term B.">‖B‖</Th>
            <Th align="right" tip="Number of dimensions in this model's embedding space.">Dims</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment">
          {result.models.map(m => (
            <tr key={m.modelId}>
              <Td>{m.modelName}</Td>
              <Td align="right" mono>{m.cosineSimilarity.toFixed(4)}</Td>
              <Td align="right" mono>{m.cosineDistance.toFixed(4)}</Td>
              <Td align="right" mono>{m.angularDistance.toFixed(1)}</Td>
              <Td align="right" mono>{m.euclideanDistance.toFixed(4)}</Td>
              <Td align="right" mono>{m.normA.toFixed(3)}</Td>
              <Td align="right" mono>{m.normB.toFixed(3)}</Td>
              <Td align="right" mono>{m.dimensions}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function VectorLogicDeepDive({ result }: { result: VectorLogicResult }) {
  return (
    <div className="space-y-4">
      {result.models.map(m => (
        <div key={m.modelId}>
          <SectionHeading>
            {m.modelName} — nearest to{" "}
            <span className="text-foreground normal-case">
              {m.a} − {m.b} + {m.c}
            </span>
          </SectionHeading>
          <Table>
            <thead>
              <tr className="border-b border-parchment">
                <Th tip="Rank in the nearest-neighbours list. 1 = closest to the computed A − B + C vector.">Rank</Th>
                <Th tip="Candidate concept from this model's reference vocabulary.">Concept</Th>
                <Th align="right" tip="Cosine similarity between this candidate and the computed A − B + C vector.">Cosine</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment">
              {m.nearest.map((n, i) => (
                <tr key={i}>
                  <Td mono>{i + 1}</Td>
                  <Td className="font-medium">{n.concept}</Td>
                  <Td align="right" mono>{n.similarity.toFixed(4)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
}

function NegationDeepDive({ result }: { result: NegationGaugeResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[110px_1fr] gap-y-1 text-caption">
        <span className="text-muted-foreground">Statement</span>
        <span>{result.original}</span>
        <span className="text-muted-foreground">Negation</span>
        <span>{result.negated}</span>
        <span className="text-muted-foreground">Threshold</span>
        <span className="tabular-nums">{result.threshold}</span>
      </div>
      <SectionHeading>Per-model collapse</SectionHeading>
      <Table>
        <thead>
          <tr className="border-b border-parchment">
            <Th tip="Embedding model that produced this row.">Model</Th>
            <Th align="right" tip="Cosine similarity between the claim and its negation. Closer to 1.0 means the manifold treats the claim and its negation as near-identical.">Cosine</Th>
            <Th align="right" tip="Cosine distance = 1 − cosine similarity. Tiny distance means the negation has barely moved the position.">Distance</Th>
            <Th align="right" tip="Angular distance in degrees between the claim and its negation. Geometric negation should be close to 180°; in practice it is usually only a few degrees.">Angular (°)</Th>
            <Th align="right" tip="Yes when cosine similarity is at or above the threshold, i.e. the manifold does not represent negation of these concepts as distinctive.">Collapsed?</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment">
          {result.models.map(m => (
            <tr key={m.modelId}>
              <Td>{m.modelName}</Td>
              <Td align="right" mono>{m.cosineSimilarity.toFixed(4)}</Td>
              <Td align="right" mono>{m.cosineDistance.toFixed(4)}</Td>
              <Td align="right" mono>{m.angularDistance.toFixed(1)}</Td>
              <Td align="right">
                {m.collapsed ? (
                  <span className="text-error-600 font-semibold">yes</span>
                ) : (
                  <span className="text-success-600 font-semibold">no</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function SectioningDeepDive({ result }: { result: SemanticSectioningResult }) {
  return (
    <div className="space-y-4">
      <div className="font-sans text-caption text-muted-foreground">
        {result.steps + 1} interpolation points from{" "}
        <span className="text-foreground font-medium">{result.anchorA}</span> to{" "}
        <span className="text-foreground font-medium">{result.anchorB}</span>, nearest-concept
        search against {result.vocabulary.length} reference concepts.
      </div>
      {result.models.map(m => {
        const signature = semanticSectioningSignature(m);
        return (
          <div key={m.modelId} className="space-y-2">
            <SectionHeading>
              {m.modelName} — anchor cosine {m.anchorSimilarity.toFixed(4)}
            </SectionHeading>
            <p className="font-body text-body-sm text-slate leading-relaxed">
              {signature.join(" → ")}
            </p>
            <details>
              <summary className="cursor-pointer font-sans text-caption text-muted-foreground hover:text-foreground">
                Full path ({m.path.length} points)
              </summary>
              <Table>
                <thead>
                  <tr className="border-b border-parchment">
                    <Th align="right" tip="Interpolation parameter from 0 to 1. t = 0 is anchor A, t = 1 is anchor B, intermediate values walk linearly through embedding space.">t</Th>
                    <Th tip="Concept from the reference vocabulary whose embedding is closest to the interpolated point at this t.">Nearest concept</Th>
                    <Th align="right" tip="Cosine similarity between the interpolated vector and the nearest-concept vector.">Cosine</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {m.path.map((p, i) => (
                    <tr key={i}>
                      <Td align="right" mono>{p.position.toFixed(2)}</Td>
                      <Td>{p.nearestConcept}</Td>
                      <Td align="right" mono>{p.nearestSimilarity.toFixed(4)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </details>
          </div>
        );
      })}
    </div>
  );
}

function BatteryDeepDive({ result }: { result: NegationBatteryResult }) {
  const modelNames = result.statements[0]?.models.map(m => m.modelName) ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-caption">
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Statements</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">{result.summary.totalStatements}</div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Collapse rate</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">
            {(result.summary.collapseRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg cosine</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">{result.summary.avgSimilarity.toFixed(4)}</div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Collapsed / total</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">
            {result.summary.totalCollapsed} / {result.summary.totalTests}
          </div>
        </div>
      </div>

      <SectionHeading>Per-statement cosines</SectionHeading>
      <Table>
        <thead>
          <tr className="border-b border-parchment">
            <Th tip="The original claim. The row below the label shows its auto-generated negation (after the arrow).">Statement</Th>
            {modelNames.map(n => (
              <Th key={n} align="right" tip={`Cosine similarity between the claim and its negation, as reported by ${n}. Red means the value is at or above the collapse threshold — the manifold has given this negation geometrically trivial space.`}>{n}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment">
          {result.statements.map((row, i) => (
            <tr key={i}>
              <Td>
                <div className="font-medium">{row.statement}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">→ {row.negated}</div>
              </Td>
              {row.models.map(m => (
                <Td key={m.modelId} align="right" mono>
                  <span className={m.collapsed ? "text-error-600 font-semibold" : ""}>
                    {m.similarity.toFixed(3)}
                  </span>
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function AgonismDeepDive({ result }: { result: AgonismTestResult }) {
  const modelNames = result.pairs[0]?.models.map(m => m.modelName) ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-caption">
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pairs</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">{result.summary.totalPairs}</div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Opposition preserved</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">
            {(result.summary.preservedRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg cosine</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">{result.summary.avgSimilarity.toFixed(4)}</div>
        </div>
        <div className="bg-muted rounded-sm p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Threshold</div>
          <div className="font-sans text-body-sm font-bold tabular-nums">{result.threshold}</div>
        </div>
      </div>

      <SectionHeading>Per-pair cosines</SectionHeading>
      <Table>
        <thead>
          <tr className="border-b border-parchment">
            <Th tip="Opposed philosophical pair. Below the label: the two thinkers whose positions are being compared.">Pair</Th>
            {modelNames.map(n => (
              <Th key={n} align="right" tip={`Cosine similarity between the two opposed positions, as reported by ${n}. Red means the value is at or above the threshold — the manifold has collapsed genuine philosophical opposition into geometric proximity.`}>{n}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment">
          {result.pairs.map((row, i) => (
            <tr key={i}>
              <Td>
                <div className="font-medium">{row.pair.label}</div>
                {row.pair.positionA.thinker && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {row.pair.positionA.thinker} vs {row.pair.positionB.thinker}
                  </div>
                )}
              </Td>
              {row.models.map(m => (
                <Td key={m.modelId} align="right" mono>
                  <span className={!m.agonismPreserved ? "text-error-600 font-semibold" : ""}>
                    {m.similarity.toFixed(3)}
                  </span>
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

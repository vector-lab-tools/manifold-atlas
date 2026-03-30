/**
 * Unified similarity scale used across all components.
 * Designed to make clear that high similarity between concepts
 * that SHOULD be distinct is a problem, not a feature.
 */

export interface SimilarityLevel {
  label: string;
  color: string;
  bgColor: string;
  severity: "critical" | "high" | "moderate" | "low" | "none";
}

/**
 * For concept distance: high similarity between different concepts
 * is noteworthy but not necessarily problematic.
 */
export function conceptSimilarityLevel(similarity: number): SimilarityLevel {
  if (similarity >= 0.95) return {
    label: "Indistinguishable",
    color: "#dc2626", bgColor: "rgba(220,38,38,0.08)", severity: "critical",
  };
  if (similarity >= 0.85) return {
    label: "Very Similar",
    color: "#ea580c", bgColor: "rgba(234,88,12,0.08)", severity: "high",
  };
  if (similarity >= 0.7) return {
    label: "Somewhat Similar",
    color: "#d97706", bgColor: "rgba(217,119,6,0.08)", severity: "moderate",
  };
  if (similarity >= 0.5) return {
    label: "Moderate Distinction",
    color: "#65a30d", bgColor: "rgba(101,163,13,0.08)", severity: "low",
  };
  if (similarity >= 0.3) return {
    label: "High Distinction",
    color: "#16a34a", bgColor: "rgba(22,163,74,0.08)", severity: "none",
  };
  return {
    label: "Distinctive Concepts",
    color: "#15803d", bgColor: "rgba(21,128,61,0.08)", severity: "none",
  };
}

/**
 * For negation gauge: high similarity between a claim and its
 * negation is ALWAYS a problem. The scale reflects this.
 */
export function negationSimilarityLevel(similarity: number, threshold: number): SimilarityLevel {
  if (similarity >= threshold) return {
    label: "Collapsed: the geometry barely registers the negation",
    color: "#dc2626", bgColor: "rgba(220,38,38,0.1)", severity: "critical",
  };
  if (similarity >= threshold - 0.05) return {
    label: "Near-collapse: the negation nudges the position but little more",
    color: "#ea580c", bgColor: "rgba(234,88,12,0.08)", severity: "high",
  };
  if (similarity >= 0.7) return {
    label: "Weak distinction: the claim and its negation remain close neighbours",
    color: "#d97706", bgColor: "rgba(217,119,6,0.08)", severity: "moderate",
  };
  if (similarity >= 0.5) return {
    label: "Partial distinction: some separation, but far less than logic would require",
    color: "#65a30d", bgColor: "rgba(101,163,13,0.08)", severity: "low",
  };
  return {
    label: "Adequate separation: claim and negation occupy distinct regions",
    color: "#16a34a", bgColor: "rgba(22,163,74,0.08)", severity: "none",
  };
}

/**
 * Colour for a similarity value on the unified scale.
 */
export function similarityColor(similarity: number): string {
  if (similarity >= 0.85) return "#dc2626";
  if (similarity >= 0.7) return "#ea580c";
  if (similarity >= 0.5) return "#d97706";
  if (similarity >= 0.3) return "#65a30d";
  return "#16a34a";
}

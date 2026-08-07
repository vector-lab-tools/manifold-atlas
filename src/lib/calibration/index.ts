/**
 * Calibration layer.
 *
 * Measures the shape of each model's embedding space so that a cosine
 * reported anywhere in the application has a scale behind it. Import
 * from here rather than from the individual modules.
 */

export {
  CORPUS_VERSION,
  CALIBRATION_TEXT_COUNT,
  calibrationTextList,
  stratumRanges,
  SHORT_DECLARATIVE,
  NEUTRAL_PROSE,
  TOPICAL_PAIRS,
} from "./corpus";

export {
  describe,
  pairwiseCosines,
  pairCosinesAt,
  normalisedPosition,
  floorZ,
  angularFraction,
  angleDegrees,
  EMPTY_DISTRIBUTION,
  type Distribution,
} from "./baseline";

export {
  computeModelRadius,
  rawCosineComparable,
  describeRadius,
  type ModelRadius,
} from "./radius";

export {
  computeCalibration,
  floorFor,
  isStale,
  type ModelCalibration,
  type Register,
} from "./compute";

export {
  loadCalibrations,
  loadCalibration,
  saveCalibration,
  clearCalibration,
  clearAllCalibrations,
} from "./store";

export {
  resolveThreshold,
  structuralControls,
  DEFAULT_THRESHOLD_MODE,
  DEFAULT_FLOOR_RELATIVE_K,
  LEGACY_FIXED_THRESHOLD,
  type ThresholdMode,
  type ResolvedThreshold,
} from "./threshold";

export { GLOSSARY, glossary, tipText, type GlossaryEntry } from "./glossary";

export { radiusLine, negationReportLine, negationReportBlock } from "./report";

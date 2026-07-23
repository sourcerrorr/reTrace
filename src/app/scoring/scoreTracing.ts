/* ─── tracing scorer ──────────────────────────────────────────────────────── */
/**
 * Scores a shape-tracing attempt by comparing the drawn stroke against the
 * exercise's guide path. Pure: (exercise, metrics, durationMs) in, ScoreResult
 * out. No React/DOM/canvas.
 *
 * Three simple, explainable ideas:
 *   accuracy    how closely the drawn line hugged the guide (missed guide
 *               counts as far, so you must both cover the shape and stay on it)
 *   completion  how much of the guide the stroke actually reached (coverage)
 *   smoothness  how steady the drawing speed was (a control proxy)
 *
 * Everything tunable lives in TUNING; the weights are accuracy-led on purpose —
 * this is rehab practice, not a speed run.
 *
 * ── Coupling with the tracing runtime ─────────────────────────────────────────
 * `useTracingRuntime` gates ink to a guide corridor: it only records a fingertip
 * sample into `metrics.points` while the tip is within PATH_CORRIDOR_PX (≈52) of
 * the guide, starts drawing from the start marker, and drops long jump chords.
 * So the scorer only ever sees *valid in-corridor drawing* — off-path scribbling
 * never reaches it. That is why this module no longer carries an "overdraw"
 * penalty: there is nothing off-path left to penalise, and a term that fired only
 * on the corridor rim would score noise, not behaviour.
 *
 * INVARIANT: keep `tolerancePx` and `coveragePx` ≤ the runtime's corridor width.
 * If PATH_CORRIDOR_PX changes significantly, revisit these constants (and this
 * whole scorer) — a wider corridor admits looser drawing that this scorer would
 * otherwise still reward as "on the line".
 */

import { shapePoints, type Point, type TracingExercise } from "../exercises";
import type { ScoreResult, TracingMetrics } from "./types";
import { clamp, distance, weighted } from "./util";

const TUNING = {
  /** Max distance (px) a drawn point may sit from the guide and still count as
   *  "on the line". ≈ guide half-width (3) + pen half-width (5) + hand jitter.
   *  Must stay ≤ the runtime's PATH_CORRIDOR_PX so adherence still discriminates
   *  inside the corridor rather than flattening to full marks everywhere. */
  tolerancePx: 44,
  /** A guide sample is "covered" if some drawn point lands within this band. */
  coveragePx: 48,
  /** Segment length variability that maps to zero smoothness (coefficient of
   *  variation). Below it, smoothness scales linearly toward 100. */
  smoothnessCvCeil: 1,
  /** Blend into `overall` — accuracy first, then coverage, then control. */
  weights: { accuracy: 0.5, completion: 0.35, smoothness: 0.15 },
};

/** Nearest distance from point `p` to any point in `guide`. */
function nearest(p: Point, guide: Point[]): number {
  let min = Infinity;
  for (const g of guide) {
    const d = distance(p, g);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Steadiness of drawing speed via the coefficient of variation of step lengths:
 * even, flowing motion has consistent steps; hesitant or jerky motion doesn't.
 * Shape-independent, so curves aren't unfairly penalised.
 */
function smoothnessScore(points: Point[]): number {
  const steps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (d >= 0.5) steps.push(d); // drop sub-pixel noise from a still fingertip
  }
  if (steps.length < 3) return 0; // too little movement to judge

  const mean = steps.reduce((s, d) => s + d, 0) / steps.length;
  if (mean <= 0) return 0;
  const variance =
    steps.reduce((s, d) => s + (d - mean) ** 2, 0) / steps.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp((1 - cv / TUNING.smoothnessCvCeil) * 100);
}

export function scoreTracing(
  exercise: TracingExercise,
  metrics: TracingMetrics,
  durationMs: number
): ScoreResult {
  const guide = shapePoints(exercise);
  const drawn = metrics.points;

  // Nothing drawn → an honest zero rather than a fabricated score.
  if (drawn.length === 0 || guide.length === 0) {
    return {
      overall: 0,
      accuracy: 0,
      completion: 0,
      durationMs,
      details: { smoothness: 0, coverage: 0, deviationPx: 0 },
    };
  }

  // Coverage + positional accuracy, walking the guide: each guide sample looks
  // for its nearest drawn point. Far/uncovered samples score low, so a tidy but
  // partial trace can't pass as accurate.
  //
  // With the runtime's corridor gating (see the coupling note up top), every
  // drawn point is already in-corridor, so this guide-walk carries accuracy on
  // its own — there is no off-path scribbling left for a separate overdraw term
  // to catch. Adherence *within* the corridor still discriminates: a drawn line
  // that hugs the far edge (near tolerancePx away) lowers each guide sample's
  // closeness, and coveragePx keeps corridor-edge riding from counting as
  // "reached". Wobble that still passes near the guide is caught by smoothness.
  let closenessSum = 0;
  let deviationSum = 0;
  let covered = 0;
  for (const g of guide) {
    const d = nearest(g, drawn);
    closenessSum += clamp(1 - d / TUNING.tolerancePx, 0, 1);
    deviationSum += d;
    if (d <= TUNING.coveragePx) covered += 1;
  }
  const accuracy = clamp((closenessSum / guide.length) * 100);
  const completion = (covered / guide.length) * 100;
  const meanDeviation = deviationSum / guide.length;

  const smoothness = smoothnessScore(drawn);

  const overall = weighted([
    [accuracy, TUNING.weights.accuracy],
    [completion, TUNING.weights.completion],
    [smoothness, TUNING.weights.smoothness],
  ]);

  return {
    overall: Math.round(overall),
    accuracy: Math.round(accuracy),
    completion: Math.round(completion),
    durationMs,
    details: {
      smoothness: Math.round(smoothness),
      coverage: Math.round(completion),
      deviationPx: Math.round(meanDeviation),
    },
  };
}

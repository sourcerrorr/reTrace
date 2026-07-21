/* ─── hold scorer ─────────────────────────────────────────────────────────── */
/**
 * Scores the hold (stability) variation from the metrics `useHoldRuntime`
 * collects. Pure: (exercise, metrics, durationMs) in, ScoreResult out.
 *
 *   completion  how close the *longest continuous* hold got to the requirement
 *   stability   penalised by interruptions — one calm hold beats leaving and
 *               re-entering the target several times
 *
 * `exercise.dwellMs` carries the required hold duration for this variation.
 */

import type { ReachExercise } from "../exercises";
import type { HoldMetrics, ScoreResult } from "./types";
import { clamp, ratio, weighted } from "./util";

const TUNING = {
  /** Each interruption (leaving then re-entering) costs this many stability
   *  points — the core "steady beats fidgety" signal. */
  interruptionPenalty: 20,
  /** Completion leads; stability (control) is the rest. */
  weights: { completion: 0.6, stability: 0.4 },
};

export function scoreHold(
  exercise: ReachExercise,
  metrics: HoldMetrics,
  durationMs: number
): ScoreResult {
  const requiredMs = exercise.dwellMs;
  const { longestHoldMs, interruptions, completed } = metrics;

  // Credit for the best unbroken hold, so cumulative dabbing can't fake it.
  const completion = completed
    ? 100
    : clamp(ratio(longestHoldMs, requiredMs) * 100);

  const stability = clamp(100 - interruptions * TUNING.interruptionPenalty);

  const overall = weighted([
    [completion, TUNING.weights.completion],
    [stability, TUNING.weights.stability],
  ]);

  return {
    overall: Math.round(overall),
    accuracy: Math.round(stability),
    completion: Math.round(completion),
    durationMs,
    details: {
      stability: Math.round(stability),
      efficiency: Math.round(stability),
      interruptions,
      // Best continuous hold, in seconds, for the Results screen's time stat.
      avgSeconds: longestHoldMs / 1000,
    },
  };
}

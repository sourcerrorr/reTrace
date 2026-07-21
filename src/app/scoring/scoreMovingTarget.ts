/* ─── moving-target scorer ────────────────────────────────────────────────── */
/**
 * Scores the moving-target variation. Completion for a moving target flows
 * through the reach runtime's dwell logic, so it reads the same ReachMetrics —
 * but judges tracking *quality*, not reaction speed. Pure function.
 *
 *   completion  did the fingertip stay on the target long enough to clear it
 *   stability   share of the session spent on the moving target, minus a
 *               penalty for each time contact was lost
 *
 * `exercise.dwellMs` carries the sustained-contact requirement.
 */

import type { ReachExercise } from "../exercises";
import type { ReachMetrics, ScoreResult } from "./types";
import { clamp, ratio, weighted } from "./util";

const TUNING = {
  /** Each lost-contact event costs this many stability points. */
  dropoutPenalty: 8,
  /** Completion leads; tracking stability is the rest. No speed term. */
  weights: { completion: 0.6, stability: 0.4 },
};

export function scoreMovingTarget(
  exercise: ReachExercise,
  metrics: ReachMetrics,
  durationMs: number
): ScoreResult {
  const requiredMs = exercise.dwellMs;
  const { targetsCompleted, dropouts, onTargetMs } = metrics;

  // Cleared it → full marks; otherwise partial credit for accumulated contact.
  const completion =
    targetsCompleted >= 1 ? 100 : clamp(ratio(onTargetMs, requiredMs) * 100);

  // How much of the time the fingertip actually rode the target, less a nudge
  // down for every time it fell off.
  const trackRatio = ratio(onTargetMs, durationMs) * 100;
  const stability = clamp(trackRatio - dropouts * TUNING.dropoutPenalty);

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
      dropouts,
      // Time spent tracking the target, in seconds, for the Results time stat.
      avgSeconds: onTargetMs / 1000,
    },
  };
}

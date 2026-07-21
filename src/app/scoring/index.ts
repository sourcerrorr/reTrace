/* ─── scoring engine ──────────────────────────────────────────────────────── */
/**
 * Public entry point. `scoreSession` picks the right scorer for an exercise and
 * feeds it the metrics collected during the session, returning one ScoreResult
 * the Results screen renders. Every scorer is a pure function; nothing here
 * touches React, the DOM, canvas, or MediaPipe.
 */

import type { Exercise } from "../exercises";
import type { ScoreResult, SessionMetrics } from "./types";
import { scoreTracing } from "./scoreTracing";
import { scoreReach } from "./scoreReach";
import { scoreHold } from "./scoreHold";
import { scoreMovingTarget } from "./scoreMovingTarget";

export * from "./types";
export { scoreTracing, scoreReach, scoreHold, scoreMovingTarget };

// Fallbacks for a session abandoned before any metric was recorded — keeps
// scoring deterministic (an honest zero) instead of throwing on undefined.
const EMPTY_TRACING = { points: [], strokeCount: 0 };
const EMPTY_REACH = {
  targetsTotal: 0,
  targetsCompleted: 0,
  dropouts: 0,
  onTargetMs: 0,
  paths: [],
};
const EMPTY_HOLD = {
  timeInsideMs: 0,
  longestHoldMs: 0,
  interruptions: 0,
  completed: false,
};

/**
 * Route an exercise + its session metrics to the matching scorer. Tracing goes
 * to the tracing scorer; the reach family splits by variation (hold and moving
 * have their own mechanics, everything else is a static reach).
 */
export function scoreSession(
  exercise: Exercise,
  metrics: SessionMetrics
): ScoreResult {
  const { durationMs } = metrics;

  if (exercise.category === "tracing") {
    return scoreTracing(exercise, metrics.tracing ?? EMPTY_TRACING, durationMs);
  }

  switch (exercise.variation) {
    case "hold":
      return scoreHold(exercise, metrics.hold ?? EMPTY_HOLD, durationMs);
    case "moving":
      return scoreMovingTarget(
        exercise,
        metrics.reach ?? EMPTY_REACH,
        durationMs
      );
    default:
      return scoreReach(exercise, metrics.reach ?? EMPTY_REACH, durationMs);
  }
}

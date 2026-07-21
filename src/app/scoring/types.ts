/* ─── scoring contract ────────────────────────────────────────────────────── */
/**
 * The types that connect metric *collection* (the runtime hooks) to metric
 * *scoring* (the pure functions in this folder). The hooks fill these shapes in
 * during a session; the scorers read them afterwards and never touch anything
 * else — no React, DOM, canvas, or MediaPipe.
 */

import type { Point } from "../exercises";

/**
 * The generic result every scorer returns and the Results screen renders.
 * `accuracy` and `completion` are the two universal 0–100 dimensions; anything
 * exercise-specific (smoothness, stability, avg time…) rides along in `details`.
 */
export interface ScoreResult {
  overall: number; // 0–100
  accuracy: number; // 0–100
  completion: number; // 0–100
  durationMs: number;

  details?: Record<string, number>;
}

/* ─── raw metrics collected during a session ──────────────────────────────── */
/* Each block is "what the hand did", not "how good it was" — analysis is the   */
/* scorer's job, so these stay dumb tallies and point buffers.                  */

/** Tracing: the stroke the user drew, to be compared against the guide shape. */
export interface TracingMetrics {
  /** Fingertip positions sampled while the pen was down, in screen px. */
  points: Point[];
  /** Number of separate pen-down→up strokes (a clean trace is one stroke). */
  strokeCount: number;
}

/**
 * Reach: dwell tallies for the static variations, plus `onTargetMs`/`dropouts`
 * which also let the moving-target scorer judge tracking quality.
 */
export interface ReachMetrics {
  targetsTotal: number;
  targetsCompleted: number;
  /** Times the fingertip left the active target before its dwell completed. */
  dropouts: number;
  /** Cumulative time the fingertip was inside the active target, ms. */
  onTargetMs: number;
  /**
   * Fingertip travel captured per completed reach, in screen px. Element `i` is
   * the path from the previous target (or the session start) to target `i`,
   * sampled while travelling and finalized the instant that target is cleared.
   * The static-reach scorer derives path efficiency and wobble from these; the
   * moving/hold scorers ignore them. Raw samples only — the runtime buffers,
   * the scorer analyses.
   */
  paths: Point[][];
}

/** Hold: how steadily the fingertip stayed inside a single target. */
export interface HoldMetrics {
  /** Cumulative time inside the target across all attempts, ms. */
  timeInsideMs: number;
  /** Longest *single continuous* time inside the target, ms. */
  longestHoldMs: number;
  /** Times the fingertip left the target after having been inside. */
  interruptions: number;
  /** The required continuous hold was reached. */
  completed: boolean;
}

/**
 * Everything a finished (or abandoned) session hands to `scoreSession`. Only the
 * block matching the exercise is populated; `durationMs` is the session length.
 */
export interface SessionMetrics {
  durationMs: number;
  tracing?: TracingMetrics;
  reach?: ReachMetrics;
  hold?: HoldMetrics;
}

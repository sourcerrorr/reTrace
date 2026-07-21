/* ─── reach scorer ────────────────────────────────────────────────────────── */
/**
 * Scores the static reach variations (lateral / upward / scatter). Pure:
 * (exercise, metrics, durationMs) in, ScoreResult out.
 *
 *   completion    how many targets were cleared
 *   consistency   clean completions vs. bail-outs — reaching a target and
 *                 holding it, rather than brushing it and drifting off (stability)
 *   efficiency    how *directly* the hand travelled from one target to the next
 *   smoothness    how free of corrections/oscillation that travel was
 *
 * Completion and consistency come from dwell tallies; efficiency and smoothness
 * are derived purely from the per-target fingertip paths the runtime buffers —
 * the runtime collects, the scorer analyses. Speed is deliberately kept out of
 * the score: average time per target is reported as a stat only, so a steady,
 * complete session outscores a frantic one and a slow-but-controlled reach beats
 * a fast-but-erratic one.
 */

import type { Point, ReachExercise } from "../exercises";
import type { ReachMetrics, ScoreResult } from "./types";
import { clamp, distance, ratio, weighted } from "./util";

const TUNING = {
  /**
   * Blend into `overall`. Completion is the single largest term on purpose —
   * clearing targets matters most; consistency and the two movement-quality
   * terms shade the score up or down. completion:consistency is kept at 60:40
   * (0.39:0.26) so that when a session has no usable path data the movement terms
   * drop out and `weighted` renormalises to *exactly* the pre-trajectory reach
   * score (completion 0.6 / consistency 0.4).
   */
  weights: {
    completion: 0.39,
    consistency: 0.26,
    pathEfficiency: 0.2,
    smoothness: 0.15,
  },
  /**
   * Resampling step (px) for path analysis. Coarse enough to suppress fingertip
   * jitter and to make the measured geometry roughly independent of frame
   * rate / sampling density (heading is estimated over a fixed distance, not a
   * fixed number of frames); fine enough to preserve real corrections.
   */
  resampleStepPx: 16,
  /**
   * A resampled reach shorter than this travelled essentially nowhere (e.g. a
   * target cleared from point-blank). Skipped so a degenerate straight/actual
   * ratio can't distort the averages.
   */
  minSegmentPx: 24,
  /**
   * Mean absolute curvature — radians of heading change per px of travel — that
   * maps smoothness to 0. A dead-straight reach curves ~0 → 100; sharp
   * corrections and direction reversals (turn angles approaching π) pile up fast.
   */
  wobbleCeilRadPerPx: 0.02,
};

/**
 * Down-sample a raw fingertip path to roughly uniform `step`-px spacing. This
 * (a) collapses the near-stationary cluster left while settling on the target,
 * and (b) normalises sampling density, so the heading changes measured below
 * reflect the hand's actual geometry rather than the capture frame rate.
 */
function resample(path: Point[], step: number): Point[] {
  if (path.length < 2) return path.slice();
  const out: Point[] = [path[0]];
  let last = path[0];
  for (let i = 1; i < path.length; i++) {
    if (distance(last, path[i]) >= step) {
      out.push(path[i]);
      last = path[i];
    }
  }
  return out;
}

/**
 * Absolute turn (0..π) between heading a→b and heading b→c. Uses atan2 of the
 * 2-D cross and dot products, which is numerically stable across the full range
 * (unlike acos of a normalised dot near ±1).
 */
function turnAngle(a: Point, b: Point, c: Point): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const cross = ux * vy - uy * vx;
  const dot = ux * vx + uy * vy;
  return Math.abs(Math.atan2(cross, dot));
}

interface PathStats {
  /** Mean per-reach path efficiency (straight-line / actual), 0..1. */
  efficiency: number;
  /** Movement smoothness, 0..100 (100 = no wobble). */
  smoothness: number;
  /** Reaches that contributed real travel; 0 ⇒ no usable movement data. */
  segments: number;
}

/**
 * Turn the per-target fingertip paths into two movement-quality figures.
 *
 * Path efficiency (per reach, then averaged equally):
 *   straight-line distance / actual path length. 1.0 is a perfectly straight
 *   reach; lower values mean the hand wandered on the way to the target.
 *
 * Smoothness (length-weighted across reaches):
 *   Σ|heading change| ÷ Σ(path length) = mean absolute curvature (rad/px),
 *   mapped through `wobbleCeilRadPerPx`. Reversals and mid-reach corrections
 *   turn the heading sharply and dominate the sum, while a smooth, deliberate
 *   reach barely turns. Normalising by *length* rather than sample count is what
 *   keeps the metric stable across frame rates and rewards control over speed.
 */
function analysePaths(paths: Point[][]): PathStats {
  let effSum = 0;
  let effCount = 0;
  let turningSum = 0;
  let lengthSum = 0;

  for (const raw of paths) {
    const p = resample(raw, TUNING.resampleStepPx);
    if (p.length < 2) continue;

    let actual = 0;
    for (let i = 1; i < p.length; i++) actual += distance(p[i - 1], p[i]);
    if (actual < TUNING.minSegmentPx) continue; // essentially no travel

    const straight = distance(p[0], p[p.length - 1]);
    effSum += clamp(straight / actual, 0, 1);
    effCount += 1;

    // Cumulative heading change along this reach (needs ≥3 points for a turn).
    for (let i = 2; i < p.length; i++) {
      turningSum += turnAngle(p[i - 2], p[i - 1], p[i]);
    }
    lengthSum += actual;
  }

  if (effCount === 0) return { efficiency: 0, smoothness: 0, segments: 0 };

  const efficiency = effSum / effCount;
  const curvature = lengthSum > 0 ? turningSum / lengthSum : 0;
  const smoothness = clamp((1 - curvature / TUNING.wobbleCeilRadPerPx) * 100);
  return { efficiency, smoothness, segments: effCount };
}

export function scoreReach(
  exercise: ReachExercise,
  metrics: ReachMetrics,
  durationMs: number
): ScoreResult {
  const { targetsTotal, targetsCompleted, dropouts } = metrics;

  const completion = clamp(ratio(targetsCompleted, targetsTotal) * 100);

  // Of every target the hand settled on, how many were seen through without
  // slipping off first. dropouts = mid-dwell exits, so completions / (those + 1
  // per completion) captures "committed reaches" (target stability).
  const consistency = clamp(
    ratio(targetsCompleted, targetsCompleted + dropouts) * 100
  );

  const { efficiency, smoothness, segments } = analysePaths(metrics.paths ?? []);
  const pathEfficiency = efficiency * 100; // 0..1 → 0..100 for blending/display

  const avgSeconds = ratio(durationMs, targetsCompleted) / 1000;

  // Movement quality only joins the blend when there is real path data; with
  // none, `weighted` renormalises over completion + consistency (old behaviour).
  const parts: Array<[number, number]> = [
    [completion, TUNING.weights.completion],
    [consistency, TUNING.weights.consistency],
  ];
  if (segments > 0) {
    parts.push([pathEfficiency, TUNING.weights.pathEfficiency]);
    parts.push([smoothness, TUNING.weights.smoothness]);
  }
  const overall = weighted(parts);

  return {
    overall: Math.round(overall),
    accuracy: Math.round(consistency),
    completion: Math.round(completion),
    durationMs,
    details: {
      // Left unrounded so the Results screen can show one decimal of seconds.
      avgSeconds,
      // Real path efficiency now backs the Results "Path efficiency" card.
      efficiency: Math.round(pathEfficiency),
      smoothness: Math.round(smoothness),
      consistency: Math.round(consistency),
      dropouts,
      targetsCompleted,
      variationTargets: exercise.targets.length,
    },
  };
}

/* ─── reach runtime ───────────────────────────────────────────────────────── */
/**
 * Owns the dwell-based reach mechanic: the input subscription for the reaching
 * phase, proximity detection, dwell timers, target activation, and hit
 * progress. No rendering — SessionScreen reads the returned state.
 *
 * This hook runs the reaching-phase input subscription for *every* reach
 * variation (including "hold"): it drives the cursor and publishes the latest
 * fingertip into `lastPointRef` so the hold runtime can read it. Dwell
 * detection itself is skipped when `isHold` is set — the hold runtime takes
 * over completion in that case.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  createHandTrackingInputSource,
  createMouseInputSource,
  type HandPoint,
} from "../input";
import { isPointOnTarget, type ReachExercise } from "../exercises";
import { USE_HAND_TRACKING } from "../runtime/config";
import { moveCursor } from "../runtime/cursor";
import type { SessionPhase } from "../runtime/types";
import type { ReachMetrics } from "../scoring/types";

export interface ReachRuntime {
  hitsCount: number;
  approaching: boolean;
  hitFlash: boolean;
  displayTargetIdx: number;
  /** Dwell/tracking tallies for the scoring engine; not read by rendering. */
  metrics: RefObject<ReachMetrics>;
}

// Cap per-frame on-target accrual so a stalled tab (large dt) can't inflate the
// tracking time — the loop normally ticks ~16ms.
const MAX_FRAME_MS = 100;

// Minimum travel (px) between buffered trajectory samples. Purely a memory
// guard: it drops the near-duplicate points a resting fingertip emits (e.g.
// while dwelling on a target) so a completed reach stays a handful of points,
// not hundreds. Trajectory *analysis* — resampling, geometry — is the scorer's
// job; this only keeps collection lightweight.
const MIN_SAMPLE_DIST = 3;

export function useReachRuntime(opts: {
  reach: ReachExercise | null;
  phase: SessionPhase;
  isHold: boolean;
  video: HTMLVideoElement | null;
  cursorRef: RefObject<HTMLDivElement | null>;
  /** Shared with the hold runtime: latest fingertip position, updated per frame. */
  lastPointRef: RefObject<HandPoint | null>;
  /** Fired when the final target has been cleared. */
  onComplete: () => void;
}): ReachRuntime {
  const { reach, phase, isHold, video, cursorRef, lastPointRef, onComplete } =
    opts;

  const totalTargets = reach ? reach.targets.length : 0;

  const [hitsCount, setHitsCount] = useState(0);
  const [approaching, setApproaching] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [displayTargetIdx, setDisplayTargetIdx] = useState(0);

  const currentTargetIdx = useRef(0);
  const approachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Metrics for scoring: completions, mid-dwell drop-outs, cumulative time on
  // the active target (the middle two also feed the moving-target scorer), and
  // the per-target fingertip paths the reach scorer analyses.
  const metrics = useRef<ReachMetrics>({
    targetsTotal: totalTargets,
    targetsCompleted: 0,
    dropouts: 0,
    onTargetMs: 0,
    paths: [],
  });
  const lastFrameTs = useRef(0);
  // Fingertip samples for the reach in progress. Finalized into `metrics.paths`
  // on each hit and reset for the next target, so only the active reach is held.
  const activePath = useRef<HandPoint[]>([]);

  // Proximity detection (reach)
  const doHit = useCallback(() => {
    approachTimer.current = null;
    setApproaching(false);
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 300);

    // Finalize the path travelled to reach this target and start a fresh buffer
    // for the next one. The runtime only hands off raw samples; efficiency and
    // wobble are computed later by the scorer.
    metrics.current.paths.push(activePath.current);
    activePath.current = [];

    const next = currentTargetIdx.current + 1;
    currentTargetIdx.current = next;
    setDisplayTargetIdx(next);
    setHitsCount(next);
    metrics.current.targetsCompleted = next;

    if (next >= totalTargets) {
      setTimeout(() => onComplete(), 420);
    }
  }, [totalTargets, onComplete]);

  /**
   * Every reach hit test funnels through here, fed by whichever
   * HandInputSource is active (mouse today, hand tracking later).
   */
  const onHandPoint = useCallback(
    (x: number, y: number) => {
      if (!reach || currentTargetIdx.current >= reach.targets.length) return;
      const now = performance.now();
      const dt = Math.min(MAX_FRAME_MS, now - lastFrameTs.current);
      lastFrameTs.current = now;

      const target = reach.targets[currentTargetIdx.current];
      const over = isPointOnTarget({ x, y }, target, reach.motion, now);
      if (over) metrics.current.onTargetMs += dt;

      // Buffer the fingertip trail for this reach (collection only). Skip samples
      // that barely moved so a resting hand doesn't bloat the buffer.
      const path = activePath.current;
      const prev = path.length > 0 ? path[path.length - 1] : null;
      if (!prev || Math.hypot(x - prev.x, y - prev.y) >= MIN_SAMPLE_DIST) {
        path.push({ x, y });
      }

      if (over && !approachTimer.current) {
        setApproaching(true);
        approachTimer.current = setTimeout(doHit, reach.dwellMs);
      } else if (!over && approachTimer.current) {
        // Left the target before the dwell completed — a drop-out.
        clearTimeout(approachTimer.current);
        approachTimer.current = null;
        setApproaching(false);
        metrics.current.dropouts += 1;
      }
    },
    [reach, doHit]
  );

  useEffect(() => {
    if (phase !== "reaching") return;
    if (USE_HAND_TRACKING && !video) return; // camera not up yet
    // Fresh tallies for this reaching run.
    metrics.current = {
      targetsTotal: totalTargets,
      targetsCompleted: 0,
      dropouts: 0,
      onTargetMs: 0,
      paths: [],
    };
    activePath.current = [];
    lastFrameTs.current = performance.now();
    const source = USE_HAND_TRACKING
      ? createHandTrackingInputSource(video!)
      : createMouseInputSource();
    source.start({
      onMove: (p) => {
        moveCursor(cursorRef.current, p, false);
        lastPointRef.current = p;
        // Hold runs its own stability loop; every other variation uses dwell.
        if (!isHold) onHandPoint(p.x, p.y);
      },
    });
    return () => {
      source.stop();
      if (approachTimer.current) clearTimeout(approachTimer.current);
    };
  }, [phase, onHandPoint, video, isHold, cursorRef, lastPointRef, totalTargets]);

  return { hitsCount, approaching, hitFlash, displayTargetIdx, metrics };
}

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

export interface ReachRuntime {
  hitsCount: number;
  approaching: boolean;
  hitFlash: boolean;
  displayTargetIdx: number;
}

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

  // Proximity detection (reach)
  const doHit = useCallback(() => {
    approachTimer.current = null;
    setApproaching(false);
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 300);

    const next = currentTargetIdx.current + 1;
    currentTargetIdx.current = next;
    setDisplayTargetIdx(next);
    setHitsCount(next);

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
      const target = reach.targets[currentTargetIdx.current];
      const over = isPointOnTarget({ x, y }, target, reach.motion, performance.now());

      if (over && !approachTimer.current) {
        setApproaching(true);
        approachTimer.current = setTimeout(doHit, reach.dwellMs);
      } else if (!over && approachTimer.current) {
        clearTimeout(approachTimer.current);
        approachTimer.current = null;
        setApproaching(false);
      }
    },
    [reach, doHit]
  );

  useEffect(() => {
    if (phase !== "reaching") return;
    if (USE_HAND_TRACKING && !video) return; // camera not up yet
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
  }, [phase, onHandPoint, video, isHold, cursorRef, lastPointRef]);

  return { hitsCount, approaching, hitFlash, displayTargetIdx };
}

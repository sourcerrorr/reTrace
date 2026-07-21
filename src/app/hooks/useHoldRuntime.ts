/* ─── hold runtime ────────────────────────────────────────────────────────── */
/**
 * Owns the hold (stability) mechanic: a requestAnimationFrame loop that
 * accumulates continuous time inside the target, drives the fill progress, and
 * tracks metrics (time held, interruptions, completion). It reads the latest
 * fingertip from `lastPointRef` (published by the reach runtime's input
 * subscription) rather than subscribing to input a second time.
 *
 * `insideTarget` is the hold equivalent of reach's "approaching" glow — kept
 * separate so the two mechanics don't share mutable UI state. The metrics ref
 * is returned unused today, structured so the scoring engine can read it later.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { isPointOnTarget, type ReachExercise } from "../exercises";
import type { HandPoint } from "../input";
import type { SessionPhase } from "../runtime/types";

export interface HoldMetrics {
  timeInsideMs: number;
  interruptions: number;
  completed: boolean;
}

export interface HoldRuntime {
  holdProgress: number;
  /** Finger currently inside the target (drives the target glow while holding). */
  insideTarget: boolean;
  /** Kept for the future scoring engine; not read by rendering today. */
  metrics: RefObject<HoldMetrics>;
}

export function useHoldRuntime(opts: {
  reach: ReachExercise | null;
  phase: SessionPhase;
  isHold: boolean;
  lastPointRef: RefObject<HandPoint | null>;
  /** Fired once the required continuous hold is met. */
  onComplete: () => void;
}): HoldRuntime {
  const { reach, phase, isHold, lastPointRef, onComplete } = opts;

  const [holdProgress, setHoldProgress] = useState(0);
  const [insideTarget, setInsideTarget] = useState(false);
  const metrics = useRef<HoldMetrics>({
    timeInsideMs: 0,
    interruptions: 0,
    completed: false,
  });

  // Hold (stability) loop: accumulate continuous time inside the target;
  // reset and count an interruption whenever the fingertip leaves.
  useEffect(() => {
    if (phase !== "reaching" || !isHold || !reach) return;
    const target = reach.targets[0];
    const holdMs = reach.dwellMs;
    metrics.current = { timeInsideMs: 0, interruptions: 0, completed: false };

    let raf = 0;
    let last = performance.now();
    let elapsed = 0; // continuous ms inside the target
    let wasInside = false;
    let shownProgress = -1;
    let shownInside = false;

    const loop = () => {
      const t = performance.now();
      const dt = t - last;
      last = t;

      const p = lastPointRef.current;
      const inside = p ? isPointOnTarget(p, target, null, t) : false;

      if (inside) {
        elapsed += dt;
        metrics.current.timeInsideMs += dt;
        const prog = Math.min(1, elapsed / holdMs);
        if (prog !== shownProgress) { setHoldProgress(prog); shownProgress = prog; }
        if (!shownInside) { setInsideTarget(true); shownInside = true; }
        if (elapsed >= holdMs) {
          metrics.current.completed = true;
          onComplete();
          return; // stop the loop
        }
      } else {
        if (wasInside && elapsed > 0) metrics.current.interruptions += 1;
        elapsed = 0;
        if (shownProgress !== 0) { setHoldProgress(0); shownProgress = 0; }
        if (shownInside) { setInsideTarget(false); shownInside = false; }
      }
      wasInside = inside;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, isHold, reach, lastPointRef, onComplete]);

  return { holdProgress, insideTarget, metrics };
}

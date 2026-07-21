/* ─── moving target runtime ───────────────────────────────────────────────── */
/**
 * Owns the animation clock for moving reach targets. A moving target's on-screen
 * position is a pure function of time (see `targetPositionAt` in exercises.ts);
 * this hook runs the requestAnimationFrame loop that advances `now` each frame
 * so SessionScreen can re-render the target along its path. Idle (no rAF) for
 * static targets and during tracing.
 *
 * Interpolation math itself stays in the pure exercise model — this hook only
 * drives the clock that feeds it.
 */

import { useEffect, useState } from "react";
import type { ReachExercise } from "../exercises";
import type { SessionPhase } from "../runtime/types";

export interface MovingTargetRuntime {
  /** Current animation timestamp; feed to `targetPositionAt` to place the target. */
  now: number;
}

export function useMovingTargetRuntime(opts: {
  reach: ReachExercise | null;
  phase: SessionPhase;
}): MovingTargetRuntime {
  const { reach, phase } = opts;
  const [now, setNow] = useState(() => performance.now());

  // Animate moving targets
  useEffect(() => {
    if (phase !== "reaching" || !reach?.motion) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, reach]);

  return { now };
}

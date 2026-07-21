/* ─── fingertip cursor helper ─────────────────────────────────────────────── */
/**
 * Imperative positioning for the fingertip cursor. The cursor is a single DOM
 * node owned by SessionScreen; both the tracing and reach runtimes drive it
 * every frame without triggering React re-renders. Kept here so that "how the
 * cursor looks/moves" lives in one place rather than being duplicated across
 * the runtime hooks.
 */

import type { HandPoint } from "../input";
import { P } from "../theme";

/**
 * Move the cursor to `p` (screen px). While `drawing`, it fills clay to signal
 * an engaged stroke; otherwise it's a hollow sage ring.
 */
export function moveCursor(
  cur: HTMLDivElement | null,
  p: HandPoint,
  drawing: boolean
) {
  if (!cur) return;
  cur.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  cur.style.opacity = "1";
  cur.style.background = drawing ? P.clay : "transparent";
  cur.style.borderColor = drawing ? P.clay : P.sage300;
}

/** Return the cursor to its idle (hollow) look without moving it. */
export function idleCursor(cur: HTMLDivElement | null) {
  if (!cur) return;
  cur.style.background = "transparent";
  cur.style.borderColor = P.sage300;
}

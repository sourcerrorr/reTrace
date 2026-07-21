/* ─── scoring helpers ─────────────────────────────────────────────────────── */
/**
 * The handful of pure math helpers the scorers share, so every formula clamps
 * and averages the same way. Nothing here knows about exercises.
 */

/** Constrain a value to a range (defaults to the 0–100 score range). */
export const clamp = (v: number, lo = 0, hi = 100): number =>
  Math.min(hi, Math.max(lo, v));

/** Safe division: a zero (or missing) denominator yields 0 rather than NaN. */
export const ratio = (num: number, den: number): number =>
  den > 0 ? num / den : 0;

/** Straight-line distance between two points. */
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Weighted average of `[value, weight]` pairs. Used to blend a few 0–100
 * sub-scores into one `overall`, keeping the weights visible at the call site.
 */
export const weighted = (parts: Array<[value: number, weight: number]>): number => {
  let sum = 0;
  let total = 0;
  for (const [value, weight] of parts) {
    sum += value * weight;
    total += weight;
  }
  return total > 0 ? sum / total : 0;
};

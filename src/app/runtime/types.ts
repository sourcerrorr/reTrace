/* ─── shared session runtime types ────────────────────────────────────────── */
/**
 * Phase types shared between SessionScreen and the runtime hooks. Kept in a
 * neutral module so the hooks don't have to import from SessionScreen (which
 * imports them), avoiding a cycle.
 */

export type SessionPhase =
  | "tracing"
  | "tracing-complete"
  | "reaching"
  | "reaching-complete";

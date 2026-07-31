/* ─── session runtime config ──────────────────────────────────────────────── */

/**
 * Which input source drives a session: hand tracking (webcam + MediaPipe) or the
 * mouse. This is a *runtime* choice now — the user picks it on the setup screen,
 * App holds it in state, and it flows down as a prop to SessionScreen and into
 * the tracing/reach runtime hooks (which source to create, and whether to wait
 * for video). No compile-time flag, so both input methods ship in every build.
 */
export type InputMode = "hand" | "mouse";

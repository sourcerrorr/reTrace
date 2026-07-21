/* ─── session runtime config ──────────────────────────────────────────────── */

/**
 * Input source toggle: hand tracking (webcam + MediaPipe) vs mouse. Mouse is
 * kept as a dev fallback until hand tracking is the proven default.
 *
 * Read by SessionScreen (which layer to render) and by the tracing/reach
 * runtime hooks (which input source to create, and whether to wait for video).
 */
export const USE_HAND_TRACKING = true;

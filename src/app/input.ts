/* ─── hand input abstraction ──────────────────────────────────────────────── */
/**
 * Exercise logic consumes hand input only through `HandInputHandlers`; it
 * never subscribes to DOM events itself. An input *source* is anything that
 * feeds those handlers points in screen px — the mouse today, MediaPipe hand
 * tracking later. Swapping sources must not touch exercise code.
 *
 * Event mapping:
 *
 *   handler      mouse               hand tracking
 *   onMove       mousemove           index fingertip position, every frame
 *   onEngage     mousedown           pinch start (thumb tip meets index tip)
 *   onRelease    mouseup             pinch end / hand lost
 *
 * `createHandTrackingInputSource(video)` maps landmark 8 (index fingertip)
 * from normalized video coordinates to viewport px (mirrored in X — the
 * camera preview is mirrored) and emits onMove each processed frame.
 * Pinch uses the original tip-distance-in-reference-px method (landmarks 4↔8).
 */

import type { HandLandmarker } from "@mediapipe/tasks-vision";

export interface HandPoint {
  x: number;
  y: number;
}

export interface HandInputHandlers {
  /** Streaming position update. */
  onMove?: (p: HandPoint) => void;
  /** "Pen down": begin a stroke / deliberate contact. */
  onEngage?: (p: HandPoint) => void;
  /** "Pen up". */
  onRelease?: () => void;
}

export interface HandInputSource {
  /** Begin emitting to `handlers`. Calling start while running is a no-op. */
  start: (handlers: HandInputHandlers) => void;
  /** Detach everything. Safe to call when not running. */
  stop: () => void;
}

/**
 * The mouse-backed source.
 *
 * `engageElement` scopes where an engage may begin (the drawing canvas);
 * moves and releases are tracked window-wide so a stroke that leaves the
 * element still updates and ends correctly.
 */
export function createMouseInputSource(
  opts: { engageElement?: HTMLElement } = {}
): HandInputSource {
  let detach: (() => void) | null = null;

  return {
    start(handlers) {
      if (detach) return;
      const engageEl: GlobalEventHandlers = opts.engageElement ?? window;

      const down = (e: MouseEvent) =>
        handlers.onEngage?.({ x: e.clientX, y: e.clientY });
      const move = (e: MouseEvent) =>
        handlers.onMove?.({ x: e.clientX, y: e.clientY });
      const up = () => handlers.onRelease?.();

      engageEl.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      detach = () => {
        engageEl.removeEventListener("mousedown", down);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
    },
    stop() {
      detach?.();
      detach = null;
    },
  };
}

/* ─── MediaPipe hand tracking source ──────────────────────────────────────── */

// Pinned to the installed @mediapipe/tasks-vision version — keep in sync with
// package.json. The wasm bundle and model are fetched at runtime (no backend;
// nothing of the user's is uploaded — detection runs entirely in-browser).
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const INDEX_FINGERTIP = 8; // MediaPipe hand landmark index
const THUMB_TIP = 4; // MediaPipe hand landmark index

// Pinch thresholds are expressed in px at this reference frame width, then the
// live measurement is scaled to it — so the same numbers hold whether the
// camera streams 640- or 1280-wide.
const PINCH_REF_WIDTH = 640;

export interface HandTrackingOptions {
  /** Pinch closes (onEngage) when tip distance falls below this, in reference px. */
  pinchStartPx?: number;
  /** Pinch opens (onRelease) when tip distance rises above this, in reference px. */
  pinchEndPx?: number;
  /**
   * Exponential smoothing factor for the fingertip, 0–1. Higher = snappier /
   * less smoothing; lower = smoother / laggier. Light smoothing ≈ 0.5.
   */
  smoothing?: number;
}

const DEFAULT_OPTIONS: Required<HandTrackingOptions> = {
  pinchStartPx: 30, // engage below 30px
  pinchEndPx: 40, // release above 40px — the gap is hysteresis, no flicker at the edge
  smoothing: 0.5,
};

// One landmarker for the whole app: model load takes seconds, and sources are
// created/destroyed per exercise phase. Failed init clears the cache so a
// later start() can retry.
let landmarkerPromise: Promise<HandLandmarker> | null = null;

function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      // Dynamic import keeps MediaPipe out of the bundle's critical path.
      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      return HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * The hand-tracking-backed source. `video` is the playing webcam element from
 * HandCamera's `onVideoReady`.
 *
 * Emits onMove every processed frame with the index fingertip (landmark 8)
 * mapped to viewport px — X mirrored to match the mirrored preview, then
 * exponentially smoothed to tame jitter. A pinch between the thumb tip
 * (landmark 4) and index tip drives onEngage/onRelease: it closes below
 * `pinchStartPx` and opens above `pinchEndPx`, the gap between them being
 * hysteresis so fingers hovering near the boundary don't flicker the state.
 *
 * All gesture logic lives here; consumers see only onMove/onEngage/onRelease.
 */
export function createHandTrackingInputSource(
  video: HTMLVideoElement,
  options: HandTrackingOptions = {}
): HandInputSource {
  const { pinchStartPx, pinchEndPx, smoothing } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let running = false;
  let rafId = 0;
  let engaged = false;
  // Smoothed fingertip position (screen px); null until the first sighting or
  // after the hand is lost, so tracking doesn't lerp across a gap.
  let smooth: HandPoint | null = null;

  // Tip-to-tip distance in reference px (resolution-independent).
  const pinchDistance = (
    thumb: { x: number; y: number },
    index: { x: number; y: number }
  ): number => {
    const w = video.videoWidth || PINCH_REF_WIDTH;
    const scale = PINCH_REF_WIDTH / w;
    const dx = (thumb.x - index.x) * w * scale;
    const dy = (thumb.y - index.y) * video.videoHeight * scale;
    return Math.hypot(dx, dy);
  };

  return {
    start(handlers) {
      if (running) return;
      running = true;

      getHandLandmarker()
        .then((landmarker) => {
          if (!running) return;
          let lastVideoTime = -1;

          const loop = () => {
            if (!running) return;
            // Only detect on fresh frames; rAF outpaces the camera.
            if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              const result = landmarker.detectForVideo(
                video,
                performance.now()
              );
              const hand = result.landmarks[0];
              const tip = hand?.[INDEX_FINGERTIP];
              const thumb = hand?.[THUMB_TIP];

              if (tip && thumb) {
                // Map to screen px, mirror X to match the preview.
                const raw: HandPoint = {
                  x: (1 - tip.x) * window.innerWidth,
                  y: tip.y * window.innerHeight,
                };
                // Exponential smoothing: new = prev + a·(raw − prev).
                smooth = smooth
                  ? {
                      x: smooth.x + smoothing * (raw.x - smooth.x),
                      y: smooth.y + smoothing * (raw.y - smooth.y),
                    }
                  : raw;
                handlers.onMove?.(smooth);

                // Pinch → engage/release with hysteresis.
                const dist = pinchDistance(thumb, tip);
                if (!engaged && dist < pinchStartPx) {
                  engaged = true;
                  handlers.onEngage?.(smooth);
                } else if (engaged && dist > pinchEndPx) {
                  engaged = false;
                  handlers.onRelease?.();
                }
              } else {
                // Hand lost: end any stroke and forget the smoothed position.
                if (engaged) {
                  engaged = false;
                  handlers.onRelease?.();
                }
                smooth = null;
              }
            }
            rafId = requestAnimationFrame(loop);
          };
          rafId = requestAnimationFrame(loop);
        })
        .catch((err) => {
          console.error("Hand tracking failed to start:", err);
        });
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      engaged = false;
      smooth = null;
    },
  };
}

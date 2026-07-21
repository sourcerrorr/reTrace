/* ─── tracing runtime ─────────────────────────────────────────────────────── */
/**
 * Owns everything behind the tracing exercise: the drawing canvas, pen
 * engage/release, stroke accumulation, and the "mode" (Drawing/Hovering/Paused)
 * indicator. SessionScreen renders the canvas + cursor and hands their refs in;
 * this hook wires input to them and returns only what the UI needs.
 *
 * Ink rules:
 *  - First stroke must begin on the green start dot.
 *  - After that, pinch again anywhere on the guide corridor to continue.
 *  - Ink is only laid while the fingertip stays near the guide path — so an
 *    accidental pinch off the spiral leaves no scribbles.
 *
 * Completion for tracing is user-driven (the "Finish tracing" button lives in
 * SessionScreen), so this hook doesn't own phase — it exposes drawing state and
 * a clear action, plus the mode indicator + setter (the keyboard's space toggle
 * writes through the setter).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  createHandTrackingInputSource,
  createMouseInputSource,
  type HandPoint,
} from "../input";
import {
  shapePoints,
  type Exercise,
  type Point,
  type TracingExercise,
} from "../exercises";
import { USE_HAND_TRACKING } from "../runtime/config";
import { idleCursor, moveCursor } from "../runtime/cursor";
import type { SessionPhase } from "../runtime/types";
import type { TracingMetrics } from "../scoring/types";

/** How close the fingertip must be to the green start dot to begin the first stroke. */
const START_DOT_HIT_RADIUS = 72;
/** How far from the guide path the fingertip may stray and still leave ink. */
const PATH_CORRIDOR_PX = 52;
/** Resume a stroke by pinching near the last drawn point (not only the path). */
const RESUME_NEAR_LAST_PX = 56;

export type ModeIndicator = "Drawing" | "Hovering" | "Paused";

export interface TracingRuntime {
  modeIndicator: ModeIndicator;
  setModeIndicator: Dispatch<SetStateAction<ModeIndicator>>;
  hasDrawn: boolean;
  /** Reset the current attempt: wipe the stroke, redraw the guide. */
  clearDrawing: () => void;
  /** Drawn stroke for the scoring engine; not read by rendering. */
  metrics: RefObject<TracingMetrics>;
}

/** Paints the guide shape (corridor underlay + path + start dot). */
function drawShapeGuide(
  ctx: CanvasRenderingContext2D,
  ex: TracingExercise,
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);
  const pts = shapePoints(ex);
  if (pts.length === 0) return;

  // Soft corridor so the allowed drawing band is visible.
  ctx.strokeStyle = "rgba(168, 196, 160, 0.14)";
  ctx.lineWidth = PATH_CORRIDOR_PX * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(168, 196, 160, 0.45)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // Start dot
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(168,196,160,0.95)";
  ctx.fill();
}

function isNearStartDot(p: HandPoint, guide: Point[]): boolean {
  const start = guide[0];
  if (!start) return false;
  return Math.hypot(p.x - start.x, p.y - start.y) <= START_DOT_HIT_RADIUS;
}

/** True when `p` lies within PATH_CORRIDOR_PX of any guide sample. */
function isOnGuidePath(p: HandPoint, guide: Point[]): boolean {
  const r2 = PATH_CORRIDOR_PX * PATH_CORRIDOR_PX;
  for (const g of guide) {
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

export function useTracingRuntime(opts: {
  plan: Exercise;
  phase: SessionPhase;
  video: HTMLVideoElement | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cursorRef: RefObject<HTMLDivElement | null>;
}): TracingRuntime {
  const { plan, phase, video, canvasRef, cursorRef } = opts;

  const [modeIndicator, setModeIndicator] = useState<ModeIndicator>("Paused");
  const [hasDrawn, setHasDrawn] = useState(false);
  const hasDrawnRef = useRef(false);

  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  /** Last place ink was actually laid — used to resume after a release. */
  const lastInkRef = useRef<HandPoint | null>(null);

  // Raw stroke for scoring: the fingertip positions drawn since the last clear,
  // plus how many separate strokes it took. Collected only — scoreTracing does
  // the guide comparison later.
  const metrics = useRef<TracingMetrics>({ points: [], strokeCount: 0 });

  // Size canvas once per session
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, [canvasRef]);

  // Draw shape guide when tracing starts
  useEffect(() => {
    if (phase !== "tracing" || plan.category !== "tracing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawShapeGuide(ctx, plan, canvas.width, canvas.height);
  }, [phase, plan, canvasRef]);

  // Tracing input: engage / move / release with path-corridor ink gating.
  useEffect(() => {
    if (phase !== "tracing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (USE_HAND_TRACKING && !video) return; // camera not up yet
    if (plan.category !== "tracing") return;

    const guide = shapePoints(plan);

    const source = USE_HAND_TRACKING
      ? createHandTrackingInputSource(video!)
      : createMouseInputSource({ engageElement: canvas });
    source.start({
      onEngage: (p: HandPoint) => {
        // First stroke: green start only.
        // Later: on the guide corridor, OR near where the line left off.
        const nearLast =
          !!lastInkRef.current &&
          Math.hypot(p.x - lastInkRef.current.x, p.y - lastInkRef.current.y) <=
            RESUME_NEAR_LAST_PX;
        const canStart = hasDrawnRef.current
          ? isOnGuidePath(p, guide) || nearLast
          : isNearStartDot(p, guide);
        if (!canStart) return;

        isDrawing.current = true;
        lastPos.current = p;
        hasDrawnRef.current = true;
        setHasDrawn(true);
        setModeIndicator("Drawing");
        moveCursor(cursorRef.current, p, true);
        metrics.current.strokeCount += 1;
        metrics.current.points.push({ x: p.x, y: p.y });
      },
      onMove: (p: HandPoint) => {
        moveCursor(cursorRef.current, p, isDrawing.current);
        if (!isDrawing.current) return;

        // Off the path — skip ink but keep the stroke alive (don't clear
        // lastPos), so a brief wobble doesn't split the line.
        if (!isOnGuidePath(p, guide)) {
          return;
        }

        if (!lastPos.current) {
          lastPos.current = p;
          lastInkRef.current = p;
          metrics.current.points.push({ x: p.x, y: p.y });
          return;
        }

        // If we wandered far off and came back elsewhere, start a fresh
        // segment instead of drawing a long chord across the shape.
        const gap = Math.hypot(p.x - lastPos.current.x, p.y - lastPos.current.y);
        if (gap > PATH_CORRIDOR_PX * 3) {
          lastPos.current = p;
          lastInkRef.current = p;
          metrics.current.points.push({ x: p.x, y: p.y });
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "oklch(0.68 0.07 55)";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        lastPos.current = p;
        lastInkRef.current = p;
        metrics.current.points.push({ x: p.x, y: p.y });
      },
      onRelease: () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        lastPos.current = null;
        if (hasDrawnRef.current) setModeIndicator("Hovering");
        idleCursor(cursorRef.current);
      },
    });
    return () => source.stop();
  }, [phase, plan, video, canvasRef, cursorRef]);

  // Reset the current tracing attempt — wipe the stroke, redraw the guide,
  // keep the same generated exercise.
  const clearDrawing = useCallback(() => {
    if (plan.category !== "tracing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawShapeGuide(ctx, plan, canvas.width, canvas.height); // clears, then redraws guide
    isDrawing.current = false;
    lastPos.current = null;
    lastInkRef.current = null;
    hasDrawnRef.current = false;
    setHasDrawn(false);
    // Score only the attempt that's actually on the canvas.
    metrics.current = { points: [], strokeCount: 0 };
  }, [plan, canvasRef]);

  return { modeIndicator, setModeIndicator, hasDrawn, clearDrawing, metrics };
}

/* ─── tracing runtime ─────────────────────────────────────────────────────── */
/**
 * Owns everything behind the tracing exercise: the drawing canvas, pen
 * engage/release, stroke accumulation, and the "mode" (Drawing/Hovering/Paused)
 * indicator. SessionScreen renders the canvas + cursor and hands their refs in;
 * this hook wires input to them and returns only what the UI needs.
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
import { shapePoints, type Exercise, type TracingExercise } from "../exercises";
import { USE_HAND_TRACKING } from "../runtime/config";
import { idleCursor, moveCursor } from "../runtime/cursor";
import type { SessionPhase } from "../runtime/types";

export type ModeIndicator = "Drawing" | "Hovering" | "Paused";

export interface TracingRuntime {
  modeIndicator: ModeIndicator;
  setModeIndicator: Dispatch<SetStateAction<ModeIndicator>>;
  hasDrawn: boolean;
  /** Reset the current attempt: wipe the stroke, redraw the guide. */
  clearDrawing: () => void;
}

/** Paints the guide shape (dashed path + start dot) for the current exercise. */
function drawShapeGuide(
  ctx: CanvasRenderingContext2D,
  ex: TracingExercise,
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);
  const pts = shapePoints(ex);
  if (pts.length === 0) return;

  ctx.strokeStyle = "rgba(168, 196, 160, 0.4)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // start dot
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(168,196,160,0.8)";
  ctx.fill();
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

  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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

  // Tracing input: engage = pen down, move = extend stroke, release = pen up.
  useEffect(() => {
    if (phase !== "tracing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (USE_HAND_TRACKING && !video) return; // camera not up yet

    const source = USE_HAND_TRACKING
      ? createHandTrackingInputSource(video!)
      : createMouseInputSource({ engageElement: canvas });
    source.start({
      // Pen down (pinch / mousedown): begin a stroke.
      onEngage: (p: HandPoint) => {
        isDrawing.current = true;
        lastPos.current = p;
        setHasDrawn(true);
        setModeIndicator("Drawing");
        moveCursor(cursorRef.current, p, true);
      },
      // Every frame: move the cursor; only draw while engaged.
      onMove: (p: HandPoint) => {
        moveCursor(cursorRef.current, p, isDrawing.current);
        if (!isDrawing.current || !lastPos.current) return;
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
      },
      // Pen up (pinch release / mouseup): end the stroke.
      onRelease: () => {
        isDrawing.current = false;
        lastPos.current = null;
        if (hasDrawn) setModeIndicator("Hovering");
        idleCursor(cursorRef.current);
      },
    });
    return () => source.stop();
  }, [phase, hasDrawn, video, canvasRef, cursorRef]);

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
    setHasDrawn(false);
  }, [plan, canvasRef]);

  return { modeIndicator, setModeIndicator, hasDrawn, clearDrawing };
}

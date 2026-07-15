/* ─── exercise generation ─────────────────────────────────────────────────── */
/**
 * The user still picks the *category* (ExercisesScreen). Everything that makes
 * up the *specific* exercise — shape, size, position, target layout, dwell time
 * — is rolled here.
 *
 * `generateExercise` is pure: category + viewport in, plain data out. Nothing in
 * this file touches React or the DOM, so the same description can drive both the
 * rendering (App.tsx) and, later, MediaPipe-based completion checks.
 */

export type ExerciseCategory = "tracing" | "reach";

export type TraceShape =
  | "circle"
  | "square"
  | "triangle"
  | "line"
  | "spiral"
  | "wave";

/** Add a shape here plus a branch in `shapePoints` and it joins the rotation. */
export const TRACE_SHAPES: readonly TraceShape[] = [
  "circle",
  "square",
  "triangle",
  "line",
  "spiral",
  "wave",
];

export type ReachVariation =
  | "lateral"
  | "upward"
  | "moving"
  | "hold"
  | "scatter";

/** Add a variation here plus a branch in `generateReach` and it joins the rotation. */
export const REACH_VARIATIONS: readonly ReachVariation[] = [
  "lateral",
  "upward",
  "moving",
  "hold",
  "scatter",
];

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface TracingExercise {
  id: string;
  category: "tracing";
  instruction: string;
  shape: TraceShape;
  /** Radius-ish scale in px. Every shape is laid out relative to this. */
  size: number;
  center: Point;
}

export interface ReachTarget extends Point {
  id: number;
  radius: number;
}

export interface TargetMotion {
  axis: "x" | "y";
  amplitude: number;
  periodMs: number;
}

export interface ReachExercise {
  id: string;
  category: "reach";
  instruction: string;
  variation: ReachVariation;
  targets: ReachTarget[];
  /** How long the hand must stay on a target before it counts as a hit. */
  dwellMs: number;
  motion: TargetMotion | null;
}

export type Exercise = TracingExercise | ReachExercise;

/* ─── random helpers ──────────────────────────────────────────────────────── */

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Random point in [lo, hi], collapsing to the midpoint when the range inverts
 *  on small viewports (rand() would otherwise return an out-of-bounds value). */
const between = (lo: number, hi: number) => (hi <= lo ? (lo + hi) / 2 : rand(lo, hi));

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

const DEFAULT_DWELL_MS = 420;
const HOLD_DWELL_MS = 3000;

/* ─── tracing ─────────────────────────────────────────────────────────────── */

function generateTracing(vp: Viewport): TracingExercise {
  const shape = pick(TRACE_SHAPES);
  const span = Math.min(vp.width, vp.height);
  const size = rand(span * 0.16, span * 0.3);

  // Widest shape (wave) reaches 1.3x size horizontally; tallest reach 1x size.
  // The vertical margins clear the mode pill up top and the cue/finish button below.
  const halfW = size * 1.35;
  const halfH = size * 1.1;

  return {
    id: nextId("trace"),
    category: "tracing",
    instruction: "Trace this shape — start at the green dot.",
    shape,
    size,
    center: {
      x: between(halfW + 24, vp.width - halfW - 24),
      y: between(halfH + 96, vp.height - halfH - 176),
    },
  };
}

/* ─── reaching ────────────────────────────────────────────────────────────── */

/** Keeps targets fully on-screen and clear of the session HUD. */
function targetBounds(vp: Viewport, radius: number) {
  return {
    minX: radius + 140,
    maxX: vp.width - radius - 140,
    minY: radius + 80,
    maxY: vp.height - radius - 240,
  };
}

function makeTargets(
  count: number,
  make: () => Omit<ReachTarget, "id">
): ReachTarget[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, ...make() }));
}

function generateReach(vp: Viewport): ReachExercise {
  const variation = pick(REACH_VARIATIONS);
  const radius = rand(48, 76);
  const b = targetBounds(vp, radius);
  const base = {
    id: nextId("reach"),
    category: "reach" as const,
    variation,
    dwellMs: DEFAULT_DWELL_MS,
    motion: null,
  };

  switch (variation) {
    case "lateral": {
      const side = pick(["left", "right"] as const);
      const band = (b.maxX - b.minX) * 0.28;
      const lo = side === "left" ? b.minX : b.maxX - band;
      const hi = side === "left" ? b.minX + band : b.maxX;
      return {
        ...base,
        instruction: `Reach out to the target on your ${side}.`,
        targets: makeTargets(randInt(4, 8), () => ({
          x: between(lo, hi),
          y: between(b.minY, b.maxY),
          radius,
        })),
      };
    }

    case "upward": {
      const band = (b.maxY - b.minY) * 0.3;
      return {
        ...base,
        instruction: "Reach up to the target.",
        targets: makeTargets(randInt(4, 8), () => ({
          x: between(b.minX, b.maxX),
          y: between(b.minY, b.minY + band),
          radius,
        })),
      };
    }

    case "moving":
      return {
        ...base,
        instruction: "Follow the moving target.",
        motion: {
          axis: "x",
          amplitude: Math.max(0, (b.maxX - b.minX) / 2),
          periodMs: rand(4200, 7000),
        },
        targets: [
          {
            id: 0,
            x: (b.minX + b.maxX) / 2,
            y: between(b.minY, b.maxY),
            radius,
          },
        ],
      };

    case "hold":
      return {
        ...base,
        instruction: "Hold your hand over the target for 3 seconds.",
        dwellMs: HOLD_DWELL_MS,
        targets: [
          {
            id: 0,
            x: between(b.minX, b.maxX),
            y: between(b.minY, b.maxY),
            radius,
          },
        ],
      };

    case "scatter":
    default:
      return {
        ...base,
        variation: "scatter",
        instruction: "Touch the targets as they appear.",
        targets: makeTargets(randInt(6, 10), () => ({
          x: between(b.minX, b.maxX),
          y: between(b.minY, b.maxY),
          radius,
        })),
      };
  }
}

/**
 * Rolls a specific exercise for a category the user already chose.
 * Called once per session; a fresh session re-rolls.
 */
export function generateExercise(
  category: ExerciseCategory,
  vp: Viewport
): Exercise {
  return category === "tracing" ? generateTracing(vp) : generateReach(vp);
}

/* ─── geometry ────────────────────────────────────────────────────────────── */
/* Shared by rendering today and by hand-tracking validation later.           */

function sampleEdge(a: Point, b: Point, steps: number): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / steps;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

function samplePolygon(corners: Point[], perEdge = 40): Point[] {
  const pts = corners.flatMap((c, i) =>
    sampleEdge(c, corners[(i + 1) % corners.length], perEdge)
  );
  return [...pts, { ...corners[0] }];
}

/**
 * The guide path as an ordered point list, in screen px.
 *
 * `points[0]` is where the user should start (the green dot). Returning geometry
 * rather than drawing commands is what lets the canvas renderer and a future
 * accuracy check work from one definition of the shape.
 */
export function shapePoints(ex: TracingExercise): Point[] {
  const { shape, size: r, center } = ex;
  const { x: cx, y: cy } = center;

  switch (shape) {
    case "line":
      return sampleEdge(
        { x: cx - r * 1.2, y: cy + r * 0.6 },
        { x: cx + r * 1.2, y: cy - r * 0.6 },
        60
      );

    case "circle": {
      const n = 220;
      return Array.from({ length: n + 1 }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      });
    }

    case "square": {
      const h = r * 0.85;
      return samplePolygon([
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx + h, y: cy + h },
        { x: cx - h, y: cy + h },
      ]);
    }

    case "triangle":
      return samplePolygon(
        [0, 1, 2].map((i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        })
      );

    case "spiral": {
      const n = 200;
      return Array.from({ length: n + 1 }, (_, i) => {
        const a = (i / n) * Math.PI * 4;
        const rad = r * 0.08 + r * 0.92 * (i / n);
        return {
          x: cx + rad * Math.cos(a - Math.PI / 2),
          y: cy + rad * Math.sin(a - Math.PI / 2),
        };
      });
    }

    case "wave":
    default: {
      const n = 160;
      const startX = cx - r * 1.3;
      const endX = cx + r * 1.3;
      return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return {
          x: startX + (endX - startX) * t,
          y: cy + Math.sin(t * Math.PI * 3) * r * 0.55,
        };
      });
    }
  }
}

/** Where a target sits right now — `motion` targets orbit their anchor point. */
export function targetPositionAt(
  target: ReachTarget,
  motion: TargetMotion | null,
  now: number
): Point {
  if (!motion) return { x: target.x, y: target.y };
  const phase = (now % motion.periodMs) / motion.periodMs;
  const offset = Math.sin(phase * Math.PI * 2) * motion.amplitude;
  return motion.axis === "x"
    ? { x: target.x + offset, y: target.y }
    : { x: target.x, y: target.y + offset };
}

/**
 * Hit test for a single point against the active target.
 *
 * This is the seam hand tracking plugs into: pass a fingertip landmark mapped to
 * screen px and the answer is the same as for a mouse cursor.
 */
export function isPointOnTarget(
  p: Point,
  target: ReachTarget,
  motion: TargetMotion | null,
  now: number,
  slop = 12
): boolean {
  const c = targetPositionAt(target, motion, now);
  return Math.hypot(p.x - c.x, p.y - c.y) <= target.radius + slop;
}

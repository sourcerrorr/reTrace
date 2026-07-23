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

export type Difficulty = "easy" | "medium" | "hard";

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

/**
 * A language-agnostic description of the on-screen cue for an exercise. The
 * exercise generator stays free of UI copy: it emits this descriptor and the
 * session screen resolves it to translated text (see i18n/translations.ts).
 */
export type InstructionSpec =
  | { key: "tracing" }
  | { key: "lateral"; side: "left" | "right" }
  | { key: "upward" }
  | { key: "moving" }
  | { key: "hold"; seconds: number }
  | { key: "scatter" };

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
  instruction: InstructionSpec;
  shape: TraceShape;
  /** Radius-ish scale in px. Every shape is laid out relative to this. */
  size: number;
  center: Point;
}

export interface ReachTarget extends Point {
  id: number;
  radius: number;
}

export type MotionPath = "horizontal" | "vertical" | "circular";

export interface TargetMotion {
  /** Shape of the path the target sweeps. */
  path: MotionPath;
  /** Amplitude for linear paths, circle radius for circular — in px. */
  radius: number;
  /** Time for one full cycle. Derived from a difficulty-scaled linear speed so
   *  bigger paths don't move faster (keeps tracking realistic for the hand). */
  periodMs: number;
}

export interface ReachExercise {
  id: string;
  category: "reach";
  instruction: InstructionSpec;
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

/* ─── difficulty tuning ───────────────────────────────────────────────────── */
/**
 * One place that turns the chosen difficulty into concrete exercise parameters.
 * Every reach variation reads from here rather than branching on difficulty,
 * so scaling stays consistent and tweakable.
 *
 *   radiusScale  target size (bigger = easier)
 *   dwellScale   how long to confirm a static/tracking hit (longer = harder)
 *   countScale   how many targets (more = harder)
 *   trackSpeedPx linear speed of the moving target, px/s (faster = harder)
 *   holdMs       required continuous hold for the stability exercise
 */
interface DifficultyTuning {
  radiusScale: number;
  dwellScale: number;
  countScale: number;
  trackSpeedPx: number;
  holdMs: number;
}

const DIFFICULTY_TUNING: Record<Difficulty, DifficultyTuning> = {
  easy:   { radiusScale: 1.28, dwellScale: 0.7, countScale: 0.6, trackSpeedPx: 110, holdMs: 2500 },
  medium: { radiusScale: 1.0,  dwellScale: 1.0, countScale: 1.0, trackSpeedPx: 175, holdMs: 3500 },
  hard:   { radiusScale: 0.74, dwellScale: 1.4, countScale: 1.45, trackSpeedPx: 260, holdMs: 5000 },
};

// Base values at medium difficulty; the tuning scalers move around these.
const BASE_RADIUS = 60;
const BASE_DWELL_MS = 480;
const BASE_TRACK_DWELL_MS = 1600; // sustained contact to clear a moving target
const MIN_TARGET_RADIUS = 40; // keep targets catchable under fingertip jitter

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
    instruction: { key: "tracing" },
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

/** Difficulty-scaled target count from a medium-difficulty base range. */
function scaledCount(loBase: number, hiBase: number, scale: number): number {
  const lo = Math.max(2, Math.round(loBase * scale));
  const hi = Math.max(lo, Math.round(hiBase * scale));
  return randInt(lo, hi);
}

function generateReach(vp: Viewport, difficulty: Difficulty): ReachExercise {
  const t = DIFFICULTY_TUNING[difficulty];
  const variation = pick(REACH_VARIATIONS);

  const radius = clamp(BASE_RADIUS * t.radiusScale, MIN_TARGET_RADIUS, 120);
  const dwellMs = Math.round(BASE_DWELL_MS * t.dwellScale);
  const b = targetBounds(vp, radius);
  const base = {
    id: nextId("reach"),
    category: "reach" as const,
    variation,
    dwellMs,
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
        instruction: { key: "lateral", side },
        targets: makeTargets(scaledCount(4, 7, t.countScale), () => ({
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
        instruction: { key: "upward" },
        targets: makeTargets(scaledCount(4, 7, t.countScale), () => ({
          x: between(b.minX, b.maxX),
          y: between(b.minY, b.minY + band),
          radius,
        })),
      };
    }

    case "moving": {
      const path = pick(["horizontal", "vertical", "circular"] as const);
      const availHalfX = (b.maxX - b.minX) / 2;
      const availHalfY = (b.maxY - b.minY) / 2;
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;

      // Path amplitude, capped so the whole sweep stays inside the play area
      // (and not so wide that even slow motion outruns the hand).
      let motionRadius: number;
      let anchor: Point;
      if (path === "horizontal") {
        motionRadius = Math.min(availHalfX, 300);
        anchor = { x: cx, y: between(b.minY, b.maxY) };
      } else if (path === "vertical") {
        motionRadius = Math.min(availHalfY, 240);
        anchor = { x: between(b.minX, b.maxX), y: cy };
      } else {
        motionRadius = Math.min(availHalfX, availHalfY, 200);
        anchor = { x: cx, y: cy };
      }

      // Period from a fixed linear speed: one cycle travels the whole path
      // length (circumference, or 4×amplitude back-and-forth for a sine).
      const pathLength =
        path === "circular" ? 2 * Math.PI * motionRadius : 4 * motionRadius;
      const periodMs = Math.round((pathLength / t.trackSpeedPx) * 1000);

      // A touch larger so it stays catchable while moving.
      const movingRadius = clamp(radius * 1.15, MIN_TARGET_RADIUS, 130);

      return {
        ...base,
        // Tracking is about sustained contact, so it takes longer than a tap.
        dwellMs: Math.round(BASE_TRACK_DWELL_MS * t.dwellScale),
        instruction: { key: "moving" },
        motion: { path, radius: motionRadius, periodMs },
        targets: [{ id: 0, x: anchor.x, y: anchor.y, radius: movingRadius }],
      };
    }

    case "hold":
      return {
        ...base,
        // Hold duration is the stability requirement; dwellMs carries it so the
        // definition stays data-only and App runs the stability loop.
        dwellMs: t.holdMs,
        instruction: { key: "hold", seconds: Math.round(t.holdMs / 1000) },
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
        instruction: { key: "scatter" },
        targets: makeTargets(scaledCount(6, 9, t.countScale), () => ({
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
  vp: Viewport,
  difficulty: Difficulty
): Exercise {
  return category === "tracing"
    ? generateTracing(vp)
    : generateReach(vp, difficulty);
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

/**
 * Where a target sits right now. A `motion` target sweeps a continuous path
 * anchored at (target.x, target.y): a horizontal/vertical sine, or a circle.
 * All paths are smooth and periodic — no jumps.
 */
export function targetPositionAt(
  target: ReachTarget,
  motion: TargetMotion | null,
  now: number
): Point {
  if (!motion) return { x: target.x, y: target.y };
  const angle = ((now % motion.periodMs) / motion.periodMs) * Math.PI * 2;
  switch (motion.path) {
    case "horizontal":
      return { x: target.x + Math.sin(angle) * motion.radius, y: target.y };
    case "vertical":
      return { x: target.x, y: target.y + Math.sin(angle) * motion.radius };
    case "circular":
    default:
      return {
        x: target.x + Math.cos(angle) * motion.radius,
        y: target.y + Math.sin(angle) * motion.radius,
      };
  }
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

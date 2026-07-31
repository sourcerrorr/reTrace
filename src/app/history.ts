/* ─── session history persistence ─────────────────────────────────────────── */
/**
 * Client-side, append-only history of completed sessions, kept in localStorage.
 * Mirrors the guarded read/write pattern in LanguageProvider so a disabled or
 * erroring localStorage (private mode, etc.) degrades to an empty history rather
 * than throwing.
 *
 * One entry = one completed session (a full plan of same-type exercises),
 * reduced to just the values the Progress screen renders — deliberately *not*
 * the raw `ScoreResult[]`, whose `details` shape is free to evolve with the
 * scoring engine. The data flow is:
 *
 *   exercise runtime → ScoreResult[] → aggregateSession → SessionHistoryEntry
 *   → appendSession (localStorage) → Progress screen (loadSessions).
 */

import type { ScoreResult } from "./scoring";
import type { ExerciseCategory } from "./exercises";

export interface SessionHistoryEntry {
  id: string;
  /** Display label, e.g. "Mon Jul 7". The chart drops the leading weekday. */
  date: string;
  type: ExerciseCategory;
  /** Total session length: the sum of every exercise's duration, ms. */
  durationMs: number;
  /** Session-average accuracy, 0–100. */
  accuracy: number;
  /**
   * Session-average secondary quality, 0–100: smoothness for tracing,
   * path efficiency for reach (see QUALITY_KEY).
   */
  quality: number;
}

const STORAGE_KEY = "retrace.sessions";

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** The per-exercise `details` key that backs the Progress "quality" column. */
const QUALITY_KEY: Record<ExerciseCategory, string> = {
  tracing: "smoothness",
  reach: "efficiency",
};

/** "Mon Jul 7" — weekday + short month + day, matching the old mock labels. */
function formatDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${month} ${d.getDate()}`;
}

// `crypto.randomUUID` needs a secure context (https/localhost); optional
// chaining covers an absent `crypto` or `randomUUID` (e.g. plain-http hosting)
// by falling back to a timestamp+random id.
function makeId(): string {
  return (
    crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Guards against hand-edited or version-skewed storage before we trust a row. */
function isEntry(v: unknown): v is SessionHistoryEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    (e.type === "tracing" || e.type === "reach") &&
    typeof e.durationMs === "number" &&
    typeof e.accuracy === "number" &&
    typeof e.quality === "number"
  );
}

/**
 * All stored sessions, oldest first. Returns an empty list on a fresh browser,
 * unreadable storage, or corrupt data — never throws.
 */
export function loadSessions(): SessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

/**
 * Reduce a completed session's per-exercise results into one history entry.
 * `type` selects which `details` metric becomes `quality`; `when` is injectable
 * for testing.
 */
export function aggregateSession(
  results: ScoreResult[],
  type: ExerciseCategory,
  when: Date = new Date()
): SessionHistoryEntry {
  const qualityKey = QUALITY_KEY[type];
  return {
    id: makeId(),
    date: formatDate(when),
    type,
    durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    accuracy: mean(results.map((r) => r.accuracy)),
    quality: mean(results.map((r) => r.details?.[qualityKey] ?? 0)),
  };
}

/**
 * Append one entry to the stored history and return the new list. Read → push
 * → write, so existing history is never overwritten. Best-effort persistence:
 * if the write fails, the returned list still reflects the append in memory.
 */
export function appendSession(
  entry: SessionHistoryEntry
): SessionHistoryEntry[] {
  const next = [...loadSessions(), entry];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* persistence best-effort; the in-memory list still reflects the append */
  }
  return next;
}

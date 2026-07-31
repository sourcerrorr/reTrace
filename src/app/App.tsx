import { useState } from "react";
import { Activity, TrendingUp, Check } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  generateSessionPlan,
  SESSION_LENGTH,
  type Difficulty,
  type Exercise,
  type ExerciseCategory,
} from "./exercises";
import { P } from "./theme";
import {
  PrimaryButton,
  SecondaryButton,
  PrivacyChip,
} from "./components/primitives";
import type { InputMode } from "./runtime/config";
import { SessionScreen } from "./SessionScreen";
import type { ScoreResult } from "./scoring";
import {
  loadSessions,
  aggregateSession,
  appendSession,
  type SessionHistoryEntry,
} from "./history";
import { useLanguage } from "./i18n/useLanguage";
import { LanguageSwitch } from "./i18n/LanguageSwitch";
import type { Translations } from "./i18n/translations";

/* ─── types ───────────────────────────────────────────────────────────────── */
type Screen = "exercises" | "session" | "results" | "progress";
type ExerciseType = ExerciseCategory;

/* ─── session duration formatting ────────────────────────────────────────── */
// Sub-minute sessions (common while testing) read better in seconds than as
// "0 min", so fall back to seconds below one minute.
const formatDuration = (ms: number): string => {
  const min = Math.round(ms / 60000);
  return min >= 1 ? `${min} min` : `${Math.round(ms / 1000)} s`;
};

/* ─── global animation styles ─────────────────────────────────────────────── */
const GlobalStyle = () => (
  <style>{`
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes slideFade {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes hitBurst {
      0% { transform: scale(1); opacity: 1; }
      60% { transform: scale(1.3); opacity: 0.6; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    * { box-sizing: border-box; }
    :focus-visible { outline: 3px solid oklch(0.48 0.06 150); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `}</style>
);


/* ─── nav rail ────────────────────────────────────────────────────────────── */

// `key` is a stable identifier (drives the active-state logic and React keys);
// the visible label comes from the dictionary via `nav[key]`.
const NAV = [
  { key: "exercises" as const, screen: "exercises" as Screen, Icon: Activity },
  { key: "progress" as const,  screen: "progress" as Screen,  Icon: TrendingUp },
] as const;

function NavRail({
  current,
  onNavigate,
}: {
  current: Screen;
  onNavigate: (s: Screen) => void;
}) {
  const { t } = useLanguage();
  return (
    <nav
      style={{
        width: 240,
        minHeight: "100vh",
        background: P.paper,
        borderRight: `1px solid ${P.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "32px 0",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "0 24px 24px" }}>
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            fontSize: 28,
            color: P.ink,
            letterSpacing: "-0.02em",
          }}
        >
          reTrace
        </span>
      </div>

      {/* Language switch kept near the top so it's always reachable without
          scrolling, even on tall pages like Progress. */}
      <div style={{ padding: "0 16px 28px" }}>
        <LanguageSwitch />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", flex: 1 }}>
        {NAV.map(({ key, screen, Icon }) => {
          const active = current === screen;
          return (
            <button
              key={key}
              onClick={() => onNavigate(screen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                background: active ? P.sage50 : "transparent",
                color: active ? P.sage : P.ink2,
                border: "none",
                cursor: "pointer",
                fontSize: 17,
                fontFamily: "'Inter', sans-serif",
                fontWeight: active ? 600 : 400,
                minHeight: 56,
                textAlign: "left",
                transition: "background 160ms ease-out",
              }}
            >
              <span style={{ color: active ? P.sage : P.ink3, display: "flex" }}>
                <Icon size={20} />
              </span>
              {t.nav[key]}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 16px" }}>
        <PrivacyChip />
      </div>
    </nav>
  );
}

/* ─── dev nav ─────────────────────────────────────────────────────────────── */

function DevNav({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [open, setOpen] = useState(false);
  const screens: Screen[] = ["exercises", "session", "results", "progress"];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {open && (
        <div
          style={{
            background: P.ink,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {screens.map((s) => (
            <button
              key={s}
              onClick={() => { onNavigate(s); setOpen(false); }}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                minWidth: 120,
              }}
            >
              /{s}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: P.ink,
          border: "none",
          color: "#fff",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        DEV
      </button>
    </div>
  );
}

/* ─── screen 1: exercise + difficulty select ─────────────────────────────── */
/**
 * The single entry point for starting a session. The old separate Setup page is
 * gone — exercise type and difficulty now both live here, and "Start session"
 * rolls a full plan of multiple exercises of the chosen type (see App).
 */

function ExercisesScreen({
  onStart,
}: {
  onStart: (
    category: ExerciseType,
    difficulty: Difficulty,
    input: InputMode
  ) => void;
}) {
  const { t } = useLanguage();
  const [type, setType] = useState<ExerciseType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [input, setInput] = useState<InputMode | null>(null);
  const ready = type !== null && difficulty !== null && input !== null;

  const difficulties: { id: Difficulty; title: string; desc: string }[] = [
    { id: "easy",   title: t.setup.easyTitle,   desc: t.setup.easyDesc },
    { id: "medium", title: t.setup.mediumTitle, desc: t.setup.mediumDesc },
    { id: "hard",   title: t.setup.hardTitle,   desc: t.setup.hardDesc },
  ];

  return (
    <div
      style={{
        flex: 1,
        background: P.bone,
        padding: "40px 64px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 32 }}>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            color: P.ink3,
            fontWeight: 500,
          }}
        >
          {t.exercises.chooseHint}
        </p>

        {/* Exercise type */}
        <div style={{ display: "flex", gap: 32 }}>
          <ExerciseCard
            title={t.exerciseName.tracing}
            description={t.exercises.tracingDesc}
            preview={<TracingPreview />}
            selected={type === "tracing"}
            onSelect={() => setType("tracing")}
          />
          <ExerciseCard
            title={t.exerciseName.reach}
            description={t.exercises.reachDesc}
            preview={<ReachPreview />}
            selected={type === "reach"}
            onSelect={() => setType("reach")}
          />
        </div>

        {/* Difficulty */}
        <div
          style={{
            background: P.paper,
            border: `1px solid ${P.border}`,
            borderRadius: 20,
            padding: 32,
          }}
        >
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: P.ink,
              marginBottom: 24,
            }}
          >
            {t.setup.question}
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            {difficulties.map(({ id, title, desc }) => {
              const sel = difficulty === id;
              return (
                <button
                  key={id}
                  onClick={() => setDifficulty(id)}
                  style={{
                    position: "relative",
                    flex: 1,
                    height: 180,
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    gap: 8,
                    borderRadius: 16,
                    background: sel ? P.sage50 : P.bone,
                    border: sel ? `3px solid ${P.sage}` : `1px solid ${P.border}`,
                    cursor: "pointer",
                    transition: "all 200ms ease-out",
                    textAlign: "left",
                  }}
                >
                  {sel && (
                    <span
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: P.sage,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 600,
                      fontSize: 28,
                      color: sel ? P.sage : P.ink,
                    }}
                  >
                    {title}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 16,
                      color: P.ink2,
                      lineHeight: 1.5,
                    }}
                  >
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input method — a required, explicit choice (like exercise type) that
            decides which input source drives the session. */}
        <div
          style={{
            background: P.paper,
            border: `1px solid ${P.border}`,
            borderRadius: 20,
            padding: 32,
          }}
        >
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: P.ink,
              marginBottom: 24,
            }}
          >
            {t.inputMethod.question}
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: 6,
              padding: 6,
              borderRadius: 9999,
              background: P.bone,
              border: `1px solid ${P.border}`,
            }}
          >
            {([
              { id: "hand" as const, label: t.inputMethod.hand },
              { id: "mouse" as const, label: t.inputMethod.mouse },
            ]).map(({ id, label }) => {
              const sel = input === id;
              return (
                <button
                  key={id}
                  onClick={() => setInput(id)}
                  aria-pressed={sel}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 52,
                    padding: "0 28px",
                    borderRadius: 9999,
                    background: sel ? P.sage : "transparent",
                    border: "none",
                    color: sel ? "#fff" : P.ink2,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 17,
                    fontWeight: sel ? 600 : 400,
                    cursor: "pointer",
                    transition: "background 160ms ease-out, color 160ms ease-out",
                  }}
                >
                  {sel && <Check size={16} strokeWidth={3} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              color: P.ink3,
            }}
          >
            {t.exercises.sessionLength(SESSION_LENGTH)}
          </p>
          <PrimaryButton
            onClick={() => ready && onStart(type!, difficulty!, input!)}
            disabled={!ready}
            fullWidth
            height={64}
          >
            {t.exercises.startSession}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({
  title,
  description,
  preview,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  preview: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        position: "relative",
        flex: 1,
        textAlign: "left",
        padding: 0,
        cursor: "pointer",
        background: P.paper,
        border: selected ? `3px solid ${P.sage}` : `1px solid ${P.border}`,
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered ? "0 12px 32px rgba(26,26,26,.06)" : "none",
        transition: "box-shadow 220ms ease-out, border-color 160ms ease-out",
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: P.sage,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={16} color="#fff" strokeWidth={3} />
        </span>
      )}
      <div
        style={{
          height: 260,
          background: P.bone,
          borderBottom: `1px solid ${P.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {preview}
      </div>
      <div
        style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            fontSize: 32,
            color: P.ink,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            color: P.ink2,
            lineHeight: 1.6,
            margin: 0,
            flex: 1,
          }}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

function TracingPreview() {
  return (
    <svg width="220" height="180" viewBox="0 0 220 180" fill="none">
      <circle cx="110" cy="90" r="70" stroke={P.sage300} strokeWidth="4" strokeDasharray="8 5" opacity="0.6" />
      <path
        d="M110 20 A70 70 0 0 1 180 90 A70 70 0 0 1 145 150"
        stroke={P.sage}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="110" cy="20" r="7" fill={P.sage} />
    </svg>
  );
}

function ReachPreview() {
  return (
    <svg width="220" height="180" viewBox="0 0 220 180" fill="none">
      <circle cx="110" cy="88" r="52" fill={P.sage50} stroke={P.sage700} strokeWidth="3" />
      <circle cx="170" cy="148" r="10" fill={P.clay} opacity="0.85" />
      <line x1="160" y1="138" x2="124" y2="112" stroke={P.clay} strokeWidth="2.5" strokeDasharray="5 4" opacity="0.5" />
    </svg>
  );
}


/* ─── screen 4: results ──────────────────────────────────────────────────── */

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

function ResultsScreen({
  results,
  exercise,
  onRetry,
  onBack,
}: {
  results: ScoreResult[];
  exercise: ExerciseType;
  onRetry: () => void;
  onBack: () => void;
}) {
  // A session is now several exercises of one type; the two summary cards show
  // the session *average* of the same dimensions each individual exercise
  // scored. Individual results are kept and listed below the summary.
  const { t } = useLanguage();
  const isTracing = exercise === "tracing";
  const detail = (k: string) => mean(results.map((r) => r.details?.[k] ?? 0));

  const avgAccuracy = mean(results.map((r) => r.accuracy));
  const avgCompletion = mean(results.map((r) => r.completion));

  const primary = isTracing
    ? {
        value: String(Math.round(avgAccuracy)),
        unit: "%",
        pct: avgAccuracy,
        sentenceVal: avgAccuracy,
      }
    : {
        value: detail("avgSeconds").toFixed(1),
        unit: "s",
        pct: avgCompletion,
        sentenceVal: avgCompletion,
      };
  const secondaryVal = isTracing ? detail("smoothness") : detail("efficiency");

  const accLabel = isTracing ? t.metrics.accuracy : t.results.avgTimePerTarget;
  const smoothLabel = isTracing ? t.metrics.smoothness : t.results.pathEfficiency;

  const sentence = (val: number, kind: "acc" | "smooth", ex: ExerciseType) => {
    if (kind === "acc" && ex === "tracing") {
      if (val >= 80) return t.results.accTracingHigh;
      if (val >= 50) return t.results.accTracingMid;
      return "";
    }
    if (kind === "acc" && ex === "reach") {
      if (val >= 80) return t.results.accReachHigh;
      if (val >= 50) return t.results.accReachMid;
      return "";
    }
    if (kind === "smooth") {
      if (val >= 80) return t.results.smoothHigh;
      if (val >= 50) return t.results.smoothMid;
      return t.results.smoothLow;
    }
    return "";
  };

  return (
    <div
      style={{
        flex: 1,
        background: P.bone,
        padding: "40px 64px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: P.ink3,
              marginBottom: 8,
            }}
          >
            {t.results.sessionComplete} · {t.results.sessionCount(results.length)}
          </p>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 40,
              color: P.ink,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {t.results.headline}
          </h1>
        </div>

        <ScoreCard
          label={accLabel}
          value={primary.value}
          unit={primary.unit}
          sentence={sentence(primary.sentenceVal, "acc", exercise)}
          pct={primary.pct}
        />
        <ScoreCard
          label={smoothLabel}
          value={String(Math.round(secondaryVal))}
          unit="%"
          sentence={sentence(secondaryVal, "smooth", exercise)}
          pct={secondaryVal}
        />

        {/* Per-exercise breakdown — the individual results behind the average. */}
        {results.length > 1 && (
          <div
            style={{
              background: P.paper,
              border: `1px solid ${P.border}`,
              borderRadius: 16,
              padding: "24px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: P.ink3,
                marginBottom: 12,
              }}
            >
              {t.results.thisSession}
            </p>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${P.border}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 17,
                    color: P.ink2,
                  }}
                >
                  {t.results.exerciseLabel(i + 1)}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 15,
                    color: P.sage,
                    fontWeight: 600,
                  }}
                >
                  {Math.round(r.overall)}%
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <PrimaryButton onClick={onRetry} fullWidth height={72}>
              {t.common.tryAgain}
            </PrimaryButton>
          </div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <SecondaryButton onClick={onBack} fullWidth height={72}>
              {t.results.backToExercises}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  unit,
  sentence,
  pct,
}: {
  label: string;
  value: string;
  unit: string;
  sentence: string;
  pct: number;
}) {
  return (
    <div
      style={{
        background: P.paper,
        border: `1px solid ${P.border}`,
        borderRadius: 16,
        padding: "32px 32px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          marginBottom: 20,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: P.ink3,
              marginBottom: 6,
            }}
          >
            {label}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
                fontSize: 72,
                color: P.sage,
                lineHeight: 1,
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 28,
                color: P.sage,
              }}
            >
              {unit}
            </span>
          </div>
        </div>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 19,
            color: P.ink2,
            maxWidth: 280,
            lineHeight: 1.55,
            textAlign: "right",
            marginTop: 24,
          }}
        >
          {sentence}
        </p>
      </div>
      <div
        style={{
          height: 8,
          background: P.sage50,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: P.sage,
            borderRadius: 4,
            transition: "width 900ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

/* ─── screen 5: progress ─────────────────────────────────────────────────── */

function ProgressScreen({ onStartExercise }: { onStartExercise: () => void }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | "tracing" | "reach">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  // Read once per mount. The screen unmounts on navigation, so returning here
  // after finishing a session re-reads the freshly appended history.
  const [sessions] = useState(loadSessions);

  const filtered = sessions.filter(
    (s) => filter === "all" || s.type === filter
  );
  const chartData = filtered.map((s) => ({
    date: s.date.replace(/^\w+ /, ""),
    Accuracy: Math.round(s.accuracy),
    Smoothness: Math.round(s.quality),
  }));

  const filters: { id: "all" | "tracing" | "reach"; label: string }[] = [
    { id: "all",     label: t.progress.filterAll },
    { id: "tracing", label: t.exerciseName.tracing },
    { id: "reach",   label: t.exerciseName.reach },
  ];

  return (
    <div
      style={{
        flex: 1,
        background: P.bone,
        padding: "40px 64px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 40,
              color: P.ink,
              margin: 0,
              marginBottom: 4,
            }}
          >
            {t.progress.title}
          </h1>
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 12 }}>
          {filters.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 9999,
                background: filter === id ? P.sage : P.paper,
                border: `1px solid ${filter === id ? P.sage : P.border}`,
                color: filter === id ? "#fff" : P.ink2,
                fontFamily: "'Inter', sans-serif",
                fontSize: 16,
                fontWeight: filter === id ? 600 : 400,
                cursor: "pointer",
                transition: "all 200ms ease-out",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chart — hidden until there's at least one session to plot. */}
        {filtered.length > 0 && (
        <div
          style={{
            background: P.paper,
            border: `1px solid ${P.border}`,
            borderRadius: 20,
            padding: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 18,
                color: P.ink,
              }}
            >
              {t.progress.sessionScores}
            </p>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: t.metrics.accuracy, color: P.sage700 },
                { label: t.metrics.smoothness, color: P.clay },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 14,
                    color: P.ink2,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid key="grid" vertical={false} stroke={P.border} strokeDasharray="0" />
              <XAxis
                key="xaxis"
                dataKey="date"
                tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fill: P.ink3 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                key="yaxis"
                domain={[0, 100]}
                ticks={[25, 50, 75, 100]}
                tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fill: P.ink3 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                key="tooltip"
                contentStyle={{
                  background: P.paper,
                  border: `1px solid ${P.border}`,
                  borderRadius: 12,
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: "0 8px 24px rgba(26,26,26,0.08)",
                }}
              />
              <Line
                key="accuracy-line"
                type="monotone"
                dataKey="Accuracy"
                name={t.metrics.accuracy}
                stroke={P.sage700}
                strokeWidth={3}
                dot={{ fill: P.sage700, strokeWidth: 0, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                key="smoothness-line"
                type="monotone"
                dataKey="Smoothness"
                name={t.metrics.smoothness}
                stroke={P.clay}
                strokeWidth={3}
                dot={{ fill: P.clay, strokeWidth: 0, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Session list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? (
            <EmptyState onStart={onStartExercise} />
          ) : (
            filtered.map((session, i) => (
              <SessionRow
                key={i}
                session={session}
                expanded={expanded === i}
                onClick={() => setExpanded(expanded === i ? null : i)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  expanded,
  onClick,
}: {
  session: SessionHistoryEntry;
  expanded: boolean;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 72,
        padding: "0 24px",
        background: P.paper,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 24,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "box-shadow 200ms ease-out",
      }}
    >
      <span
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 600,
          fontSize: 20,
          color: P.ink,
          minWidth: 132,
          flexShrink: 0,
        }}
      >
        {session.date}
      </span>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          color: P.ink2,
          flex: 1,
        }}
      >
        {t.exerciseName[session.type]}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          color: P.ink3,
          minWidth: 56,
          flexShrink: 0,
        }}
      >
        {formatDuration(session.durationMs)}
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            borderRadius: 9999,
            padding: "4px 12px",
            background: P.sage50,
            color: P.sage,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
          }}
        >
          {t.metrics.accuracy} {Math.round(session.accuracy)}%
        </span>
        <span
          style={{
            borderRadius: 9999,
            padding: "4px 12px",
            background: "#FFF7EE",
            color: P.clay,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
          }}
        >
          {t.metrics.smoothness} {Math.round(session.quality)}%
        </span>
      </div>
    </button>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "64px 0",
        gap: 20,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="50" stroke={P.sage} strokeWidth="3" strokeDasharray="8 5" />
        <path
          d="M60 10 A50 50 0 0 1 110 60 A50 50 0 0 1 85 103"
          stroke={P.clay}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <h2
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 600,
          fontSize: 32,
          color: P.ink,
          margin: 0,
        }}
      >
        {t.progress.noSessionsTitle}
      </h2>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          color: P.ink2,
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        {t.progress.noSessionsBody}
      </p>
      <PrimaryButton onClick={onStart} height={64}>
        {t.progress.startExercise}
      </PrimaryButton>
    </div>
  );
}

/* ─── app root ────────────────────────────────────────────────────────────── */

export default function App() {
  const [screen, setScreen] = useState<Screen>("exercises");
  const [category, setCategory] = useState<ExerciseType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  // The user picks this on the setup screen (required); it's always set before a
  // session starts. Defaulted so the SessionScreen prop is never null.
  const [inputMode, setInputMode] = useState<InputMode>("hand");

  // A session is a plan of several same-type exercises. We walk `plan` by
  // `index`, collecting one ScoreResult each, and only show Results at the end.
  const [plan, setPlan] = useState<Exercise[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ScoreResult[]>([]);
  // Bumped per session so SessionScreen's key changes even on a retry of the
  // same type/index, forcing a fresh remount of the runtime hooks.
  const [runId, setRunId] = useState(0);

  const startSession = (
    cat: ExerciseType,
    diff: Difficulty,
    input: InputMode
  ) => {
    setCategory(cat);
    setDifficulty(diff);
    setInputMode(input);
    setPlan(
      generateSessionPlan(
        cat,
        { width: window.innerWidth, height: window.innerHeight },
        diff
      )
    );
    setIndex(0);
    setResults([]);
    setRunId((n) => n + 1);
    setScreen("session");
  };

  // Record this exercise's result, then either advance to the next exercise or,
  // if it was the last (or the user ended the session early), show Results.
  // Only a naturally completed full plan (not an early exit) is persisted to
  // history — setResults is async, so aggregate from the full list explicitly.
  const finishExercise = (r: ScoreResult, endSession: boolean) => {
    const all = [...results, r];
    setResults(all);
    if (!endSession && index + 1 < plan.length) {
      setIndex((i) => i + 1);
    } else {
      const completedFullPlan = !endSession;
      if (completedFullPlan && category) {
        appendSession(aggregateSession(all, category));
      }
      setScreen("results");
    }
  };

  const handleRetry = () => {
    if (category) startSession(category, difficulty, inputMode);
  };

  const isSession = screen === "session";

  return (
    <>
      <GlobalStyle />
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: P.bone,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {!isSession && (
          <NavRail current={screen} onNavigate={setScreen} />
        )}

        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {screen === "exercises" && (
            <ExercisesScreen onStart={startSession} />
          )}
          {screen === "session" && plan[index] && (
            <SessionScreen
              key={`${runId}-${index}`}
              plan={plan[index]}
              inputMode={inputMode}
              exerciseIndex={index}
              exerciseTotal={plan.length}
              isLastExercise={index === plan.length - 1}
              onComplete={(r) => finishExercise(r, false)}
              onExit={(r) => finishExercise(r, true)}
            />
          )}
          {screen === "results" && category && results.length > 0 && (
            <ResultsScreen
              results={results}
              exercise={category}
              onRetry={handleRetry}
              onBack={() => setScreen("exercises")}
            />
          )}
          {screen === "progress" && (
            <ProgressScreen onStartExercise={() => setScreen("exercises")} />
          )}
        </main>

        <DevNav onNavigate={setScreen} />
      </div>
    </>
  );
}


import { useState } from "react";
import { Home, Activity, TrendingUp, Settings, Check } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type Difficulty, type ExerciseCategory } from "./exercises";
import { P } from "./theme";
import {
  PrimaryButton,
  SecondaryButton,
  PrivacyChip,
} from "./components/primitives";
import { SessionScreen } from "./SessionScreen";
import type { ScoreResult } from "./scoring";

/* ─── types ───────────────────────────────────────────────────────────────── */
type Screen = "setup" | "exercises" | "session" | "results" | "progress";
type ExerciseType = ExerciseCategory;

/* ─── mock data ──────────────────────────────────────────────────────────── */
const SESSIONS = [
  { date: "Mon Jul 7",  label: "Tracing",         dur: "8 min",  acc: 72, smooth: 68 },
  { date: "Wed Jul 9",  label: "Reach to target",  dur: "6 min",  acc: 78, smooth: 74 },
  { date: "Thu Jul 10", label: "Tracing",          dur: "9 min",  acc: 75, smooth: 71 },
  { date: "Mon Jul 14", label: "Reach to target",  dur: "7 min",  acc: 82, smooth: 77 },
  { date: "Tue Jul 15", label: "Tracing",          dur: "8 min",  acc: 85, smooth: 80 },
];
const CHART_DATA = SESSIONS.map((s) => ({
  date: s.date.replace(/^\w+ /, ""),
  Accuracy: s.acc,
  Smoothness: s.smooth,
}));

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

const NAV = [
  { id: "setup" as Screen,     label: "Home",      Icon: Home },
  { id: "exercises" as Screen, label: "Exercises", Icon: Activity },
  { id: "progress" as Screen,  label: "Progress",  Icon: TrendingUp },
  { id: "setup" as Screen,     label: "Settings",  Icon: Settings },
] as const;

function NavRail({
  current,
  onNavigate,
}: {
  current: Screen;
  onNavigate: (s: Screen) => void;
}) {
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
      <div style={{ padding: "0 24px 40px" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", flex: 1 }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id && label !== "Settings";
          return (
            <button
              key={label}
              onClick={() => onNavigate(id)}
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
              {label}
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
  const screens: Screen[] = ["setup", "exercises", "session", "results", "progress"];
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

/* ─── screen 1: setup ─────────────────────────────────────────────────────── */

function SetupScreen({
  onNext,
}: {
  onNext: (d: Difficulty) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const ready = difficulty !== null;

  const difficulties: { id: Difficulty; title: string; desc: string }[] = [
    { id: "easy",   title: "Easy",   desc: "Larger targets, more time." },
    { id: "medium", title: "Medium", desc: "Balanced practice." },
    { id: "hard",   title: "Hard",   desc: "Smaller targets, faster pace." },
  ];

  return (
    <div
      style={{
        flex: 1,
        background: P.bone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 64px",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 32 }}>
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
            How challenging should today feel?
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

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              color: P.ink3,
            }}
          >
            You can change this anytime.
          </p>
          <PrimaryButton
            onClick={() => ready && onNext(difficulty!)}
            disabled={!ready}
            fullWidth
            height={64}
          >
            Continue →
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ─── screen 2: exercise select ──────────────────────────────────────────── */

function ExercisesScreen({ onStart }: { onStart: (e: ExerciseType) => void }) {
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
      <div style={{ maxWidth: 1120, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            color: P.ink3,
            fontWeight: 500,
            marginBottom: 32,
          }}
        >
          Choose today's exercise.
        </p>

        <div style={{ display: "flex", gap: 32, flex: 1 }}>
          <ExerciseCard
            title="Tracing"
            description="Follow shapes in the air. Good for smooth, controlled movement."
            buttonLabel="Start tracing"
            preview={<TracingPreview />}
            onClick={() => onStart("tracing")}
          />
          <ExerciseCard
            title="Reach to target"
            description="Touch circles as they appear. Good for range and speed."
            buttonLabel="Start reaching"
            preview={<ReachPreview />}
            onClick={() => onStart("reach")}
          />
        </div>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 16,
            color: P.ink3,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Recommended: Tracing on Mondays and Thursdays.
        </p>
      </div>
    </div>
  );
}

function ExerciseCard({
  title,
  description,
  buttonLabel,
  preview,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  preview: React.ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        background: P.paper,
        border: `1px solid ${P.border}`,
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered ? "0 12px 32px rgba(26,26,26,.06)" : "none",
        transition: "box-shadow 220ms ease-out",
      }}
    >
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
        <PrimaryButton onClick={onClick} fullWidth height={64}>
          {buttonLabel}
        </PrimaryButton>
      </div>
    </div>
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

function ResultsScreen({
  results,
  exercise,
  onRetry,
  onBack,
}: {
  results: ScoreResult;
  exercise: ExerciseType;
  onRetry: () => void;
  onBack: () => void;
}) {
  // Same two-card layout as before — only the data source changed. The real
  // ScoreResult drives both cards; the reach headline keeps its "avg time per
  // target" reading (a stat), while the bar reflects task completion, not speed.
  const d = results.details ?? {};
  const isTracing = exercise === "tracing";

  const primary = isTracing
    ? {
        value: String(Math.round(results.accuracy)),
        unit: "%",
        pct: results.accuracy,
        sentenceVal: results.accuracy,
      }
    : {
        value: (d.avgSeconds ?? 0).toFixed(1),
        unit: "s",
        pct: results.completion,
        sentenceVal: results.completion,
      };
  const secondaryVal = isTracing ? d.smoothness ?? 0 : d.efficiency ?? 0;

  const accLabel = isTracing ? "Accuracy" : "Avg. time per target";
  const smoothLabel = isTracing ? "Smoothness" : "Path efficiency";

  const sentence = (val: number, kind: "acc" | "smooth", ex: ExerciseType) => {
    if (kind === "acc" && ex === "tracing") {
      if (val >= 80) return "Your line stayed close to the shape most of the way. Nice control.";
      if (val >= 50) return "You followed the shape well. A few small drifts — that's normal.";
      return "This one was harder today. Your effort still counts.";
    }
    if (kind === "acc" && ex === "reach") {
      if (val >= 80) return "You reached the targets quickly and accurately. Great range.";
      if (val >= 50) return "Solid reach and timing. Keep building on this.";
      return "This one was harder today. Your effort still counts.";
    }
    if (kind === "smooth") {
      if (val >= 80) return "Your movement was steady throughout — excellent control.";
      if (val >= 50) return "Your movement was steady with a few small wobbles — that's expected.";
      return "Your movements showed some variation today. This gets easier with practice.";
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
            Session complete
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
            Nicely done, that's another one in the bank.
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

        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <PrimaryButton onClick={onRetry} fullWidth height={72}>
              Try again
            </PrimaryButton>
          </div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <SecondaryButton onClick={onBack} fullWidth height={72}>
              Back to exercises
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
  const [filter, setFilter] = useState<"all" | "tracing" | "reach">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = SESSIONS.filter((s) => {
    if (filter === "all") return true;
    if (filter === "tracing") return s.label === "Tracing";
    return s.label === "Reach to target";
  });

  const filters: { id: "all" | "tracing" | "reach"; label: string }[] = [
    { id: "all",     label: "All exercises" },
    { id: "tracing", label: "Tracing" },
    { id: "reach",   label: "Reach to target" },
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
            Progress
          </h1>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: P.ink3,
            }}
          >
            Everything stays on this computer.
          </p>
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

        {/* Chart */}
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
              Session scores
            </p>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Accuracy", color: P.sage700 },
                { label: "Smoothness", color: P.clay },
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
            <LineChart data={CHART_DATA} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
                stroke={P.sage700}
                strokeWidth={3}
                dot={{ fill: P.sage700, strokeWidth: 0, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                key="smoothness-line"
                type="monotone"
                dataKey="Smoothness"
                stroke={P.clay}
                strokeWidth={3}
                dot={{ fill: P.clay, strokeWidth: 0, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

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
  session: (typeof SESSIONS)[0];
  expanded: boolean;
  onClick: () => void;
}) {
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
        {session.label}
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
        {session.dur}
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
          Accuracy {session.acc}%
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
          Smoothness {session.smooth}%
        </span>
      </div>
    </button>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
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
        No sessions yet.
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
        Finish your first exercise to start seeing your progress here.
      </p>
      <PrimaryButton onClick={onStart} height={64}>
        Start an exercise
      </PrimaryButton>
    </div>
  );
}

/* ─── app root ────────────────────────────────────────────────────────────── */

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [exercise, setExercise] = useState<ExerciseType | null>(null);
  const [results, setResults] = useState<ScoreResult | null>(null);

  const handleSetupDone = (d: Difficulty) => {
    setDifficulty(d);
    setScreen("exercises");
  };

  const handleStartExercise = (e: ExerciseType) => {
    setExercise(e);
    setScreen("session");
  };

  const handleSessionComplete = (r: ScoreResult) => {
    setResults(r);
    setScreen("results");
  };

  const handleRetry = () => {
    setScreen("session");
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
          {screen === "setup" && (
            <SetupScreen onNext={handleSetupDone} />
          )}
          {screen === "exercises" && (
            <ExercisesScreen onStart={handleStartExercise} />
          )}
          {screen === "session" && exercise && (
            <SessionScreen
              key={`${exercise}-${Date.now()}`}
              exercise={exercise}
              difficulty={difficulty ?? "medium"}
              onComplete={handleSessionComplete}
            />
          )}
          {screen === "results" && results && exercise && (
            <ResultsScreen
              results={results}
              exercise={exercise}
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

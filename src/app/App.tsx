import { useState, useRef, useEffect, useCallback } from "react";
import { Home, Activity, TrendingUp, Settings, X, Check } from "lucide-react";
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
  generateExercise,
  isPointOnTarget,
  shapePoints,
  targetPositionAt,
  type Exercise,
  type ExerciseCategory,
  type TracingExercise,
} from "./exercises";

/* ─── palette ─────────────────────────────────────────────────────────────── */
const P = {
  bone: "#F6F4EF",
  paper: "#FFFDF8",
  border: "#E4DFD3",
  ink: "#1A1A1A",
  ink2: "#4A4A45",
  ink3: "#8A8880",
  sage: "oklch(0.48 0.06 150)",
  sage50: "#EEF3EC",
  sage300: "#A8C4A0",
  sage700: "oklch(0.38 0.06 150)",
  clay: "oklch(0.68 0.07 55)",
  terracotta: "oklch(0.60 0.14 30)",
  amber: "oklch(0.78 0.11 85)",
} as const;

/* ─── types ───────────────────────────────────────────────────────────────── */
type Screen = "setup" | "exercises" | "session" | "results" | "progress";
type Hand = "left" | "right";
type Difficulty = "easy" | "medium" | "hard";
type ExerciseType = ExerciseCategory;
type SessionPhase =
  | "tracing"
  | "tracing-complete"
  | "reaching"
  | "reaching-complete";

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

/* ─── shared components ──────────────────────────────────────────────────── */

function PrivacyChip({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 9999,
        background: dark ? "rgba(26,26,26,0.72)" : P.paper,
        border: dark ? "none" : `1px solid ${P.border}`,
        backdropFilter: dark ? "blur(12px)" : "none",
        color: dark ? "rgba(255,255,255,0.8)" : P.ink3,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        letterSpacing: "0.01em",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: P.sage300,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      Recording locally · nothing uploaded
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  height = 64,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  height?: number;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height,
        width: fullWidth ? "100%" : "auto",
        padding: "0 32px",
        background: disabled ? P.sage50 : P.sage,
        color: disabled ? P.ink3 : "#fff",
        border: "none",
        borderRadius: 12,
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 160ms ease-out",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  height = 64,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  height?: number;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height,
        width: fullWidth ? "100%" : "auto",
        padding: "0 32px",
        background: P.paper,
        color: P.ink,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 500,
        cursor: "pointer",
        transition: "opacity 160ms ease-out",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

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
  onNext: (h: Hand, d: Difficulty) => void;
}) {
  const [hand, setHand] = useState<Hand | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const ready = hand !== null && difficulty !== null;

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
        {/* Q1 */}
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
            Which hand are you working on today?
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            {(["left", "right"] as Hand[]).map((h) => (
              <button
                key={h}
                onClick={() => setHand(h)}
                style={{
                  position: "relative",
                  width: 200,
                  height: 160,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  borderRadius: 16,
                  background: hand === h ? P.sage50 : P.bone,
                  border: hand === h ? `3px solid ${P.sage}` : `1px solid ${P.border}`,
                  cursor: "pointer",
                  transition: "all 200ms ease-out",
                }}
              >
                {hand === h && (
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
                <HandSilhouette hand={h} active={hand === h} />
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: 20,
                    color: hand === h ? P.sage : P.ink2,
                    textTransform: "capitalize",
                  }}
                >
                  {h} hand
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Q2 */}
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
            onClick={() => ready && onNext(hand!, difficulty!)}
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

function HandSilhouette({ hand, active }: { hand: Hand; active: boolean }) {
  const fill = active ? P.sage300 : P.ink3;
  return hand === "right" ? (
    <svg width="52" height="68" viewBox="0 0 52 68" fill="none">
      <path
        d="M26 62C10 62 6 50 6 38L6 18C6 15 8 14 10 14C12 14 14 15 14 18L14 30C14 30 13 14 16 12C18 10 22 11 22 14L22 28C22 28 21 12 24 11C26 10 30 11 30 14L30 28C30 28 29 14 32 14C35 14 38 15 38 19L38 30L40 24C41 21 44 21 45 24L46 38C46 50 42 62 26 62Z"
        fill={fill}
      />
    </svg>
  ) : (
    <svg width="52" height="68" viewBox="0 0 52 68" fill="none">
      <path
        d="M26 62C42 62 46 50 46 38L46 18C46 15 44 14 42 14C40 14 38 15 38 18L38 30C38 30 39 14 36 12C34 10 30 11 30 14L30 28C30 28 31 12 28 11C26 10 22 11 22 14L22 28C22 28 23 14 20 14C17 14 14 15 14 19L14 30L12 24C11 21 8 21 7 24L6 38C6 50 10 62 26 62Z"
        fill={fill}
      />
    </svg>
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

/* ─── session sub-components ─────────────────────────────────────────────── */

function ModePill({ mode }: { mode: "Drawing" | "Hovering" | "Paused" }) {
  const dot: Record<string, string> = {
    Drawing: P.sage,
    Hovering: P.amber,
    Paused: P.ink3,
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "0 20px",
        height: 56,
        borderRadius: 9999,
        background: "rgba(26,26,26,0.72)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 20,
        animation: "slideFade 220ms ease-out",
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: dot[mode],
          flexShrink: 0,
        }}
      />
      {mode}
    </div>
  );
}

function CuePill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0 32px",
        height: 64,
        borderRadius: 9999,
        background: "rgba(26,26,26,0.72)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 22,
        whiteSpace: "nowrap",
        animation: "slideFade 220ms ease-out",
      }}
    >
      {text}
    </div>
  );
}

function ExitDialog({
  onKeepGoing,
  onEnd,
}: {
  onKeepGoing: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(26,26,26,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 10,
      }}
    >
      <style>{`
        .exit-dialog-card { padding: 40px; }
        .exit-dialog-actions { display: flex; gap: 16px; }
        /* basis 0 + equal grow keeps both buttons the same width regardless of label length */
        .exit-dialog-action { flex: 1 1 0; min-width: 0; }
        @media (max-width: 520px) {
          .exit-dialog-card { padding: 28px 20px; }
          .exit-dialog-actions { flex-direction: column; }
          .exit-dialog-action { flex: 0 0 auto; width: 100%; }
        }
      `}</style>
      <div
        className="exit-dialog-card"
        style={{
          background: P.paper,
          border: `1px solid ${P.border}`,
          borderRadius: 20,
          maxWidth: 480,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <p
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            fontSize: 28,
            color: P.ink,
            lineHeight: 1.3,
          }}
        >
          End this exercise? Your progress is saved.
        </p>
        <div className="exit-dialog-actions">
          <div className="exit-dialog-action">
            <PrimaryButton onClick={onKeepGoing} fullWidth height={64}>
              Keep going
            </PrimaryButton>
          </div>
          <div className="exit-dialog-action">
            <button
              onClick={onEnd}
              style={{
                width: "100%",
                height: 64,
                padding: "0 16px",
                background: "transparent",
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                color: P.terracotta,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              End now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── canvas shape drawing ────────────────────────────────────────────────── */

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

/* ─── screen 3: session ──────────────────────────────────────────────────── */

function SessionScreen({
  exercise: category,
  onComplete,
}: {
  exercise: ExerciseType;
  onComplete: (r: { accuracy: number; smoothness: number }) => void;
}) {
  // The user chose the category; the specific exercise is rolled here, once.
  // App remounts this component per session, so every start re-rolls.
  const [plan] = useState<Exercise>(() =>
    generateExercise(category, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
  );
  const reach = plan.category === "reach" ? plan : null;
  const totalTargets = reach ? reach.targets.length : 0;

  const [phase, setPhase] = useState<SessionPhase>(
    plan.category === "tracing" ? "tracing" : "reaching"
  );
  const [showExit, setShowExit] = useState(false);
  const [modeIndicator, setModeIndicator] = useState<"Drawing" | "Hovering" | "Paused">("Paused");
  const [hasDrawn, setHasDrawn] = useState(false);

  // Reach state
  const [hitsCount, setHitsCount] = useState(0);
  const [approaching, setApproaching] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [now, setNow] = useState(() => performance.now());

  const currentTargetIdx = useRef(0);
  const approachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayTargetIdx, setDisplayTargetIdx] = useState(0);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Size canvas once per session
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  // Draw shape guide when tracing starts
  useEffect(() => {
    if (phase !== "tracing" || plan.category !== "tracing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawShapeGuide(ctx, plan, canvas.width, canvas.height);
  }, [phase, plan]);

  // Mouse drawing (tracing)
  useEffect(() => {
    if (phase !== "tracing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const down = (e: MouseEvent) => {
      isDrawing.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setHasDrawn(true);
      setModeIndicator("Drawing");
    };
    const move = (e: MouseEvent) => {
      if (!isDrawing.current || !lastPos.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.strokeStyle = "oklch(0.68 0.07 55)";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      isDrawing.current = false;
      lastPos.current = null;
      if (hasDrawn) setModeIndicator("Hovering");
    };

    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      canvas.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [phase, hasDrawn]);

  // Proximity detection (reach)
  const doHit = useCallback(() => {
    approachTimer.current = null;
    setApproaching(false);
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 300);

    const next = currentTargetIdx.current + 1;
    currentTargetIdx.current = next;
    setDisplayTargetIdx(next);
    setHitsCount(next);

    if (next >= totalTargets) {
      setTimeout(() => setPhase("reaching-complete"), 420);
    }
  }, [totalTargets]);

  /**
   * Every reach hit test funnels through here. Mouse events drive it today;
   * hand tracking will call it with a fingertip landmark in screen px.
   */
  const onHandPoint = useCallback(
    (x: number, y: number) => {
      if (!reach || currentTargetIdx.current >= reach.targets.length) return;
      const target = reach.targets[currentTargetIdx.current];
      const over = isPointOnTarget({ x, y }, target, reach.motion, performance.now());

      if (over && !approachTimer.current) {
        setApproaching(true);
        approachTimer.current = setTimeout(doHit, reach.dwellMs);
      } else if (!over && approachTimer.current) {
        clearTimeout(approachTimer.current);
        approachTimer.current = null;
        setApproaching(false);
      }
    },
    [reach, doHit]
  );

  useEffect(() => {
    if (phase !== "reaching") return;
    const move = (e: MouseEvent) => onHandPoint(e.clientX, e.clientY);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      if (approachTimer.current) clearTimeout(approachTimer.current);
    };
  }, [phase, onHandPoint]);

  // Animate moving targets
  useEffect(() => {
    if (phase !== "reaching" || !reach?.motion) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, reach]);

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setModeIndicator((m) => m === "Paused" ? "Hovering" : "Paused"); }
      if (e.key === "Escape") setShowExit(true);
      if (e.key === "Enter" && showExit) setShowExit(false);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [showExit]);

  const handleSeeResults = () =>
    onComplete({
      accuracy: 76 + Math.floor(Math.random() * 14),
      smoothness: 68 + Math.floor(Math.random() * 14),
    });

  const isComplete = phase === "tracing-complete" || phase === "reaching-complete";
  const currentTarget =
    reach && displayTargetIdx < reach.targets.length
      ? reach.targets[displayTargetIdx]
      : null;
  const currentTargetPos =
    reach && currentTarget ? targetPositionAt(currentTarget, reach.motion, now) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: P.ink,
      }}
    >
      {/* Webcam placeholder — dark green gradient, mirrored */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(140deg, #222e1a 0%, #19240f 35%, #0e1808 65%, #1c2814 100%)",
          filter: "saturate(0.85) brightness(0.95)",
          transform: "scaleX(-1)",
        }}
      />
      {/* Ambient light glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 30% 35%, rgba(168,196,160,0.18) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 72% 62%, rgba(168,196,160,0.12) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          opacity: phase === "tracing" || phase === "tracing-complete" ? 1 : 0,
          cursor: phase === "tracing" ? "crosshair" : "default",
          pointerEvents: phase === "tracing" ? "auto" : "none",
        }}
      />

      {/* Reach target */}
      {phase === "reaching" && currentTarget && currentTargetPos && (
        <div
          onClick={doHit}
          style={{
            position: "absolute",
            left: currentTargetPos.x - currentTarget.radius,
            top: currentTargetPos.y - currentTarget.radius,
            width: currentTarget.radius * 2,
            height: currentTarget.radius * 2,
            borderRadius: "50%",
            background: approaching ? P.sage : P.sage50,
            border: `${approaching ? 6 : 4}px solid ${approaching ? P.sage : P.sage700}`,
            boxShadow: approaching
              ? `0 0 32px rgba(168,196,160,0.45), 0 0 64px rgba(168,196,160,0.2)`
              : "none",
            cursor: "pointer",
            // A moving target can't ease its position or it lags behind the hit test.
            transition: reach?.motion
              ? "background 200ms ease-out, border-color 200ms ease-out"
              : "all 200ms ease-out",
            animation: approaching ? "none" : "breathe 1.6s ease-in-out infinite",
            transform: hitFlash ? "scale(1.25)" : "scale(1)",
          }}
        />
      )}

      {/* Top-left mode indicator */}
      {(phase === "tracing" || phase === "reaching") && (
        <div style={{ position: "absolute", top: 24, left: 24 }}>
          <ModePill mode={phase === "reaching" ? "Hovering" : modeIndicator} />
        </div>
      )}

      {/* Top-right exit */}
      <button
        onClick={() => setShowExit(true)}
        aria-label="Exit exercise"
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: P.paper,
          border: `1px solid ${P.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          color: P.ink,
          zIndex: 5,
        }}
      >
        <X size={24} />
      </button>

      {/* Bottom-center: tracing cues */}
      {phase === "tracing" && !hasDrawn && (
        <div
          style={{
            position: "absolute",
            top: "58%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <CuePill text={plan.instruction} />
        </div>
      )}
      {phase === "tracing" && hasDrawn && (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <CuePill text="Draw over the shape, then finish when ready." />
          <PrimaryButton onClick={() => setPhase("tracing-complete")} height={64}>
            Finish tracing
          </PrimaryButton>
        </div>
      )}

      {/* Bottom-center: reach cues */}
      {phase === "reaching" && (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: totalTargets }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 8,
                  borderRadius: 4,
                  background: i < hitsCount ? P.sage : "rgba(255,255,255,0.18)",
                  transition: "background 200ms ease-out",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              color: "rgba(255,255,255,0.65)",
            }}
          >
            {hitsCount} / {totalTargets}
          </span>
          <CuePill text={plan.instruction} />
        </div>
      )}

      {/* Complete overlay */}
      {isComplete && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(6px)",
          }}
        >
          <CuePill
            text={
              phase !== "reaching-complete"
                ? "Done — let's see how you did."
                : totalTargets > 1
                ? `You reached all ${totalTargets} — nicely done.`
                : "Nicely done."
            }
          />
          <PrimaryButton onClick={handleSeeResults} height={72}>
            See results
          </PrimaryButton>
        </div>
      )}

      {/* Bottom-left privacy */}
      <div style={{ position: "absolute", bottom: 24, left: 24 }}>
        <PrivacyChip dark />
      </div>

      {/* Exit dialog */}
      {showExit && (
        <ExitDialog
          onKeepGoing={() => setShowExit(false)}
          onEnd={() =>
            onComplete({ accuracy: 65, smoothness: 58 })
          }
        />
      )}
    </div>
  );
}

/* ─── screen 4: results ──────────────────────────────────────────────────── */

function ResultsScreen({
  results,
  exercise,
  onRetry,
  onBack,
}: {
  results: { accuracy: number; smoothness: number };
  exercise: ExerciseType;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { accuracy, smoothness } = results;

  const accLabel = exercise === "tracing" ? "Accuracy" : "Avg. time per target";
  const smoothLabel = exercise === "tracing" ? "Smoothness" : "Path efficiency";
  const accUnit = exercise === "reach" ? "s" : "%";
  const accDisplay =
    exercise === "reach" ? (accuracy / 12).toFixed(1) : String(accuracy);

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
          value={accDisplay}
          unit={accUnit}
          sentence={sentence(accuracy, "acc", exercise)}
          pct={accuracy}
        />
        <ScoreCard
          label={smoothLabel}
          value={String(smoothness)}
          unit="%"
          sentence={sentence(smoothness, "smooth", exercise)}
          pct={smoothness}
        />

        <div style={{ display: "flex", gap: 16 }}>
          <PrimaryButton onClick={onRetry} fullWidth height={72}>
            Try again
          </PrimaryButton>
          <SecondaryButton onClick={onBack} fullWidth height={72}>
            Back to exercises
          </SecondaryButton>
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
  const [hand, setHand] = useState<Hand | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [exercise, setExercise] = useState<ExerciseType | null>(null);
  const [results, setResults] = useState<{ accuracy: number; smoothness: number } | null>(null);

  const handleSetupDone = (h: Hand, d: Difficulty) => {
    setHand(h);
    setDifficulty(d);
    setScreen("exercises");
  };

  const handleStartExercise = (e: ExerciseType) => {
    setExercise(e);
    setScreen("session");
  };

  const handleSessionComplete = (r: { accuracy: number; smoothness: number }) => {
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

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  targetPositionAt,
  type Exercise,
  type InstructionSpec,
} from "./exercises";
import type { HandPoint } from "./input";
import { HandCamera } from "./components/HandCamera";
import { PrimaryButton, SecondaryButton, PrivacyChip } from "./components/primitives";
import { P } from "./theme";
import { useLanguage } from "./i18n/useLanguage";
import { LanguageSwitch } from "./i18n/LanguageSwitch";
import type { Translations } from "./i18n/translations";
import type { InputMode } from "./runtime/config";
import type { SessionPhase } from "./runtime/types";
import { useTracingRuntime } from "./hooks/useTracingRuntime";
import { useReachRuntime } from "./hooks/useReachRuntime";
import { useHoldRuntime } from "./hooks/useHoldRuntime";
import { useMovingTargetRuntime } from "./hooks/useMovingTargetRuntime";
import { scoreSession, type ScoreResult } from "./scoring";

/* ─── session sub-components ─────────────────────────────────────────────── */

/** Resolve an exercise's language-agnostic cue descriptor to translated text. */
function instructionText(t: Translations, spec: InstructionSpec): string {
  switch (spec.key) {
    case "tracing":
      return t.instructions.tracing;
    case "lateral":
      return spec.side === "left"
        ? t.instructions.lateralLeft
        : t.instructions.lateralRight;
    case "upward":
      return t.instructions.upward;
    case "moving":
      return t.instructions.moving;
    case "hold":
      return t.instructions.hold(spec.seconds);
    case "scatter":
      return t.instructions.scatter;
  }
}

type ModeToken = "Drawing" | "Hovering" | "Paused";

function ModePill({ mode }: { mode: ModeToken }) {
  const { t } = useLanguage();
  const dot: Record<ModeToken, string> = {
    Drawing: P.sage,
    Hovering: P.amber,
    Paused: P.ink3,
  };
  const label: Record<ModeToken, string> = {
    Drawing: t.session.modeDrawing,
    Hovering: t.session.modeHovering,
    Paused: t.session.modePaused,
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
      {label[mode]}
    </div>
  );
}

function ProgressPill({ index, total }: { index: number; total: number }) {
  const { t } = useLanguage();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px",
        height: 44,
        borderRadius: 9999,
        background: "rgba(26,26,26,0.72)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      <span>{t.session.exerciseProgress(index + 1, total)}</span>
      <span style={{ display: "flex", gap: 5 }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                i < index ? P.sage : i === index ? "#fff" : "rgba(255,255,255,0.28)",
              transition: "background 200ms ease-out",
            }}
          />
        ))}
      </span>
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
  const { t } = useLanguage();
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
          {t.session.exitTitle}
        </p>
        <div className="exit-dialog-actions">
          <div className="exit-dialog-action">
            <PrimaryButton onClick={onKeepGoing} fullWidth height={64}>
              {t.session.keepGoing}
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
              {t.session.endNow}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── screen 3: session ──────────────────────────────────────────────────── */

export function SessionScreen({
  plan,
  inputMode,
  exerciseIndex,
  exerciseTotal,
  isLastExercise,
  onComplete,
  onExit,
}: {
  /** The concrete exercise for this step of the session, rolled by App. */
  plan: Exercise;
  /** How the user chose to drive this session: hand tracking or mouse. */
  inputMode: InputMode;
  /** 0-based position of this exercise within the session. */
  exerciseIndex: number;
  /** Total exercises in the session (for the "Exercise 2 / 5" indicator). */
  exerciseTotal: number;
  /** Last exercise in the session — controls the finish-button label. */
  isLastExercise: boolean;
  /** This exercise finished (normally or ended early); advance the session. */
  onComplete: (r: ScoreResult) => void;
  /** User bailed out of the whole session; end it now with this partial result. */
  onExit: (r: ScoreResult) => void;
}) {
  const { t } = useLanguage();

  // Which input source drives this session. Decides whether we render the webcam
  // + fingertip cursor, and which source the runtime hooks create.
  const useHandTracking = inputMode === "hand";

  // Session start, for the scored duration. Read once, on mount (the session
  // mounts straight into its active phase), so it doesn't affect any timing.
  const startedAtRef = useRef(performance.now());
  const reach = plan.category === "reach" ? plan : null;
  const totalTargets = reach ? reach.targets.length : 0;
  const isHold = reach?.variation === "hold";

  const [phase, setPhase] = useState<SessionPhase>(
    plan.category === "tracing" ? "tracing" : "reaching"
  );
  const [showExit, setShowExit] = useState(false);

  // Webcam element from HandCamera; hand tracking can't start until it exists.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  // Drawing canvas + fingertip cursor. Owned here (rendered below), driven
  // imperatively by the runtime hooks so they update every frame without
  // re-rendering.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Latest fingertip position, published by the reach runtime's input loop and
  // read by the hold runtime. Shared so hold doesn't subscribe to input twice.
  const lastPointRef = useRef<HandPoint | null>(null);

  const completeReaching = useCallback(() => setPhase("reaching-complete"), []);

  // ─── runtime hooks: each owns one system; this component just wires them ───
  const tracing = useTracingRuntime({
    plan,
    phase,
    useHandTracking,
    video,
    canvasRef,
    cursorRef,
  });
  const reachRt = useReachRuntime({
    reach,
    phase,
    isHold,
    useHandTracking,
    video,
    cursorRef,
    lastPointRef,
    onComplete: completeReaching,
  });
  const hold = useHoldRuntime({
    reach,
    phase,
    isHold,
    lastPointRef,
    onComplete: completeReaching,
  });
  const moving = useMovingTargetRuntime({ reach, phase });

  // ─── state the UI reads (which mechanic is active decides the source) ───
  const { modeIndicator, hasDrawn } = tracing;
  const { hitsCount, hitFlash, displayTargetIdx } = reachRt;
  const approaching = isHold ? hold.insideTarget : reachRt.approaching;
  const holdProgress = hold.holdProgress;
  const now = moving.now;

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); tracing.setModeIndicator((m) => m === "Paused" ? "Hovering" : "Paused"); }
      if (e.key === "Escape") setShowExit(true);
      if (e.key === "Enter" && showExit) setShowExit(false);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [showExit, tracing.setModeIndicator]);

  // Turn the metrics the runtime hooks collected into a real, deterministic
  // score. Works for a finished exercise or one ended early — an abandoned run
  // just scores from whatever was collected so far.
  const computeScore = (): ScoreResult =>
    scoreSession(plan, {
      durationMs: performance.now() - startedAtRef.current,
      tracing: tracing.metrics.current,
      reach: reachRt.metrics.current,
      hold: hold.metrics.current,
    });

  const handleSeeResults = () => onComplete(computeScore());

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
      {/* Webcam layer — the real mirrored camera when hand tracking drives
          input, the dark green placeholder otherwise */}
      {useHandTracking ? (
        // -2px pushes HandCamera's 1px card border just offscreen; its rounded
        // corners blend into the identical ink background.
        <div style={{ position: "absolute", inset: -2 }}>
          <HandCamera onVideoReady={setVideo} />
          {/* Scrim so the guide shape and stroke stay readable over video */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.38)",
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
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
      )}
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

      {/* Fingertip cursor — follows the hand every frame; fills while drawing.
          Positioned imperatively via cursorRef (see moveCursor). */}
      {useHandTracking && (phase === "tracing" || phase === "reaching") && (
        <div
          ref={cursorRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: `2px solid ${P.sage300}`,
            background: "transparent",
            boxShadow: "0 0 12px rgba(168,196,160,0.55)",
            pointerEvents: "none",
            opacity: 0,
            transform: "translate(-100px, -100px)",
            transition: "background 120ms ease-out, border-color 120ms ease-out",
            zIndex: 4,
          }}
        />
      )}

      {/* Reach target. Completion is dwell/hold only — no click shortcut, so
          reaching stays a controlled movement rather than an instant tap. */}
      {phase === "reaching" && currentTarget && currentTargetPos && (
        <div
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
            pointerEvents: "none",
            // A moving target can't ease its position or it lags behind the hit test.
            transition: reach?.motion
              ? "background 200ms ease-out, border-color 200ms ease-out"
              : "all 200ms ease-out",
            animation: approaching ? "none" : "breathe 1.6s ease-in-out infinite",
            transform: hitFlash ? "scale(1.25)" : "scale(1)",
          }}
        />
      )}

      {/* Hold: countdown ring + seconds remaining, fed by continuous progress. */}
      {phase === "reaching" && isHold && currentTarget && currentTargetPos && (() => {
        const ringR = currentTarget.radius + 16;
        const size = ringR * 2 + 8;
        const circ = 2 * Math.PI * ringR;
        const secLeft = Math.max(0, Math.ceil((reach!.dwellMs * (1 - holdProgress)) / 1000));
        return (
          <>
            <svg
              width={size}
              height={size}
              style={{
                position: "absolute",
                left: currentTargetPos.x - size / 2,
                top: currentTargetPos.y - size / 2,
                pointerEvents: "none",
                zIndex: 3,
                transform: "rotate(-90deg)",
              }}
            >
              <circle cx={size / 2} cy={size / 2} r={ringR} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={6} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ringR}
                fill="none"
                stroke={P.sage300}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - holdProgress)}
              />
            </svg>
            <span
              style={{
                position: "absolute",
                left: currentTargetPos.x,
                top: currentTargetPos.y,
                transform: "translate(-50%, -50%)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 28,
                fontWeight: 600,
                color: P.ink,
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              {secLeft}
            </span>
          </>
        );
      })()}

      {/* Top-left mode indicator */}
      {(phase === "tracing" || phase === "reaching") && (
        <div style={{ position: "absolute", top: 24, left: 24 }}>
          {/* "Hovering" (finger-following) reads right while reaching; during
              tracing the pen-up state is shown as the neutral "Paused" label. */}
          <ModePill
            mode={
              phase === "reaching"
                ? "Hovering"
                : modeIndicator === "Hovering"
                ? "Paused"
                : modeIndicator
            }
          />
        </div>
      )}

      {/* Top-center session progress: which exercise of the session this is. */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
        }}
      >
        <ProgressPill index={exerciseIndex} total={exerciseTotal} />
      </div>

      {/* Top-right exit */}
      <button
        onClick={() => setShowExit(true)}
        aria-label={t.session.exitAria}
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
          <CuePill text={instructionText(t, plan.instruction)} />
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
          {/* The follow-up hint is about pinching to resume a stroke — a
              hand-tracking gesture. Mouse users don't pinch, so skip it and let
              the primary "start at the dot" cue stand on its own. */}
          {useHandTracking && <CuePill text={t.session.tracingHint} />}
          <div style={{ display: "flex", gap: 12 }}>
            <SecondaryButton onClick={tracing.clearDrawing} height={64}>
              {t.session.clearDrawing}
            </SecondaryButton>
            <PrimaryButton onClick={() => setPhase("tracing-complete")} height={64}>
              {t.session.finishTracing}
            </PrimaryButton>
          </div>
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
            {t.session.reachProgress(hitsCount, totalTargets)}
          </span>
          <CuePill text={instructionText(t, plan.instruction)} />
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
          {phase === "reaching-complete" && (
            <CuePill
              text={
                totalTargets > 1
                  ? t.session.reachedAll(totalTargets)
                  : t.session.nicelyDone
              }
            />
          )}
          <PrimaryButton onClick={handleSeeResults} height={72}>
            {isLastExercise ? t.session.seeResults : t.session.nextExercise}
          </PrimaryButton>
        </div>
      )}

      {/* Bottom-left: language switch + privacy, so the switch is reachable here too */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <LanguageSwitch dark />
        <PrivacyChip dark />
      </div>

      {/* Exit dialog */}
      {showExit && (
        <ExitDialog
          onKeepGoing={() => setShowExit(false)}
          onEnd={() => onExit(computeScore())}
        />
      )}
    </div>
  );
}

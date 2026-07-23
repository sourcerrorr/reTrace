import type { ReactNode } from "react";
import { P } from "../theme";
import { useLanguage } from "../i18n/useLanguage";

/* ─── shared primitives ──────────────────────────────────────────────────── */
/**
 * Small presentational building blocks shared across screens and the session.
 * Extracted from App.tsx so SessionScreen can live in its own file without
 * importing App (which would be a cycle).
 */

export function PrivacyChip({ dark = false }: { dark?: boolean }) {
  const { t } = useLanguage();
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
      {t.common.recordingLocally}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  height = 64,
  fullWidth = false,
}: {
  children: ReactNode;
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

export function SecondaryButton({
  children,
  onClick,
  height = 64,
  fullWidth = false,
}: {
  children: ReactNode;
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

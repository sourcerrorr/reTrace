import { P } from "../theme";
import { LANGUAGES } from "./translations";
import { useLanguage } from "./useLanguage";

/* ─── language switch ─────────────────────────────────────────────────────── */
/**
 * Unobtrusive `EN | ქართული` toggle. Lives in the nav rail on the main screens
 * and in the session HUD, so it's reachable everywhere. Switching is instant and
 * persisted (see LanguageProvider). Two visual variants keep it readable on the
 * light chrome and on the dark session background.
 */
export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLanguage } = useLanguage();

  const activeColor = dark ? "#fff" : P.sage;
  const idleColor = dark ? "rgba(255,255,255,0.55)" : P.ink3;
  const dividerColor = dark ? "rgba(255,255,255,0.28)" : P.border;

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 9999,
        background: dark ? "rgba(26,26,26,0.72)" : P.paper,
        border: dark ? "none" : `1px solid ${P.border}`,
        backdropFilter: dark ? "blur(12px)" : "none",
        flexShrink: 0,
      }}
    >
      {LANGUAGES.map(({ id, label }, i) => {
        const active = lang === id;
        return (
          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {i > 0 && (
              <span aria-hidden style={{ color: dividerColor, fontSize: 13 }}>
                |
              </span>
            )}
            <button
              type="button"
              onClick={() => setLanguage(id)}
              aria-pressed={active}
              lang={id}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px 2px",
                cursor: active ? "default" : "pointer",
                color: active ? activeColor : idleColor,
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                lineHeight: 1,
                transition: "color 160ms ease-out",
              }}
            >
              {label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

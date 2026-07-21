/* ─── palette ─────────────────────────────────────────────────────────────── */
/**
 * The single source of truth for the app's colours. Extracted from App.tsx so
 * screens, shared primitives, the session runtime, and the cursor helper all
 * read the same values instead of redefining them.
 *
 * (HandCamera intentionally keeps its own small copy so it stays droppable — see
 * the note there.)
 */
export const P = {
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

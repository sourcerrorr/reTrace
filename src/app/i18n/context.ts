import { createContext } from "react";
import type { Language, Translations } from "./translations";

/* ─── language context ────────────────────────────────────────────────────── */
/**
 * The context object lives in its own module (not in LanguageProvider.tsx) so
 * that file can export *only* components — a requirement for React Fast Refresh
 * to hot-update the provider instead of forcing a full page reload.
 */

export interface LanguageContextValue {
  lang: Language;
  setLanguage: (lang: Language) => void;
  /** The active dictionary. Read as `t.setup.continue`, `t.session.reachedAll(3)`. */
  t: Translations;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

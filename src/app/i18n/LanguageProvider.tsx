import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICTS, type Language } from "./translations";
import { LanguageContext, type LanguageContextValue } from "./context";

/* ─── language context ────────────────────────────────────────────────────── */
/**
 * Holds the active language and the matching dictionary, and persists the choice
 * to localStorage. Everything below `<LanguageProvider>` reads it through
 * `useLanguage()` — no prop-drilling.
 */

const STORAGE_KEY = "retrace.lang";
const DEFAULT_LANGUAGE: Language = "en";

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ka";
}

/** English by default; a stored choice wins. Guarded so a disabled/erroring
 *  localStorage (private mode, etc.) just falls back to the default. */
function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* localStorage unavailable — use the default */
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(readStoredLanguage);

  // Keep <html lang> in sync for accessibility and correct text handling.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLanguage = useCallback((next: Language) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* persistence best-effort; the in-memory switch still works */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLanguage, t: DICTS[lang] }),
    [lang, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

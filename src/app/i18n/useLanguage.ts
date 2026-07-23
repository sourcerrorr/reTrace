import { useContext } from "react";
import { LanguageContext, type LanguageContextValue } from "./context";

/**
 * Access the active language, the setter, and the translation dictionary.
 * Must be called from inside a `<LanguageProvider>` (the whole app is wrapped in
 * one — see main.tsx).
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

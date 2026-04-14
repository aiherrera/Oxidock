import { useCallback, useEffect, useState } from "react";
import {
  applyResolvedTheme,
  loadThemePreference,
  resolveThemePreference,
  saveThemePreference,
  THEME_SETTINGS_CHANGED_EVENT,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme-settings";

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => loadThemePreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveThemePreference(loadThemePreference())
  );

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setPreferenceState(next);
    const resolved = resolveThemePreference(next);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      const loaded = loadThemePreference();
      setPreferenceState(loaded);
      const resolved = resolveThemePreference(loaded);
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };

    window.addEventListener(THEME_SETTINGS_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(THEME_SETTINGS_CHANGED_EVENT, syncFromStorage);
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleChange = () => {
      const resolved = resolveThemePreference("system");
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  return { preference, resolvedTheme, setPreference };
}

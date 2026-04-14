export type ThemePreference = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export const THEME_SETTINGS_KEY = "oxidock.theme.preference.v1";
export const THEME_SETTINGS_CHANGED_EVENT = "oxidock:theme-changed";

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === "string" && THEME_PREFERENCES.includes(value as ThemePreference);

export const defaultThemePreference = (): ThemePreference => "system";

export const getSystemResolvedTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const resolveThemePreference = (preference: ThemePreference): ResolvedTheme => {
  if (preference === "system") {
    return getSystemResolvedTheme();
  }

  return preference;
};

export const parseThemePreference = (raw: string | null): ThemePreference => {
  if (!raw) {
    return defaultThemePreference();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isThemePreference(parsed)) {
      return parsed;
    }
  } catch {
    if (isThemePreference(raw)) {
      return raw;
    }
  }

  return defaultThemePreference();
};

export const loadThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return defaultThemePreference();
  }

  return parseThemePreference(window.localStorage.getItem(THEME_SETTINGS_KEY));
};

export const saveThemePreference = (preference: ThemePreference): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(preference));
  window.dispatchEvent(new CustomEvent(THEME_SETTINGS_CHANGED_EVENT));
};

export const applyResolvedTheme = (resolved: ResolvedTheme): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolved;
};

import type { AppPage } from "../types/app";

export type ShortcutActionId =
  | "focusSearch"
  | "refresh"
  | "openSettings"
  | "navigateContainers"
  | "navigateImages"
  | "navigateVolumes"
  | "navigateNetworks"
  | "navigateEvents"
  | "navigateLogs"
  | "navigateCli"
  | "navigateDocs";

export type ShortcutSettings = Record<ShortcutActionId, string | null>;

export const SHORTCUT_SETTINGS_KEY = "oxidock.shortcuts.settings.v1";
export const SHORTCUT_SETTINGS_CHANGED_EVENT = "oxidock:shortcuts-changed";

export const SHORTCUT_ACTION_ORDER: ShortcutActionId[] = [
  "focusSearch",
  "refresh",
  "openSettings",
  "navigateContainers",
  "navigateImages",
  "navigateVolumes",
  "navigateNetworks",
  "navigateEvents",
  "navigateLogs",
  "navigateCli",
  "navigateDocs",
];

export const SHORTCUT_ACTION_LABELS: Record<ShortcutActionId, string> = {
  focusSearch: "Focus search",
  refresh: "Refresh Docker data",
  openSettings: "Open settings",
  navigateContainers: "Go to Containers",
  navigateImages: "Go to Images",
  navigateVolumes: "Go to Volumes",
  navigateNetworks: "Go to Networks",
  navigateEvents: "Go to Events",
  navigateLogs: "Go to Logs",
  navigateCli: "Go to CLI Playground",
  navigateDocs: "Go to Docs",
};

const NAVIGATION_ACTION_TO_PAGE: Record<
  Extract<
    ShortcutActionId,
    | "navigateContainers"
    | "navigateImages"
    | "navigateVolumes"
    | "navigateNetworks"
    | "navigateEvents"
    | "navigateLogs"
    | "navigateCli"
    | "navigateDocs"
  >,
  AppPage
> = {
  navigateContainers: "containers",
  navigateImages: "images",
  navigateVolumes: "volumes",
  navigateNetworks: "networks",
  navigateEvents: "events",
  navigateLogs: "logs",
  navigateCli: "cli",
  navigateDocs: "docs",
};

export const shortcutActionToPage = (actionId: ShortcutActionId): AppPage | null => {
  if (actionId in NAVIGATION_ACTION_TO_PAGE) {
    return NAVIGATION_ACTION_TO_PAGE[actionId as keyof typeof NAVIGATION_ACTION_TO_PAGE];
  }
  return null;
};

/** Actions that may run while focus is in a text field. */
export const SHORTCUT_ACTIONS_ALLOWED_IN_INPUTS = new Set<ShortcutActionId>(["focusSearch"]);

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const modToken = "mod";

export const defaultShortcutSettings = (): ShortcutSettings => ({
  focusSearch: `${modToken}+k`,
  refresh: "f5",
  openSettings: `${modToken}+,`,
  navigateContainers: `${modToken}+1`,
  navigateImages: `${modToken}+2`,
  navigateVolumes: `${modToken}+3`,
  navigateNetworks: `${modToken}+4`,
  navigateEvents: `${modToken}+5`,
  navigateLogs: `${modToken}+6`,
  navigateCli: `${modToken}+7`,
  navigateDocs: `${modToken}+8`,
});

const RESERVED_BINDINGS: { pattern: string; reason: string }[] = [
  { pattern: "mod+q", reason: "Reserved by the OS for Quit application" },
  { pattern: "mod+w", reason: "Reserved by the OS for Close window" },
  { pattern: "mod+h", reason: "Reserved by macOS for Hide application" },
  { pattern: "mod+m", reason: "Reserved by macOS for Minimize window" },
  { pattern: "mod+tab", reason: "Reserved by the OS for app switching" },
  { pattern: "mod+space", reason: "Reserved by the OS for Spotlight or input switching" },
  { pattern: "mod+t", reason: "Commonly used for new tab in browsers" },
  { pattern: "mod+n", reason: "Commonly used for new window" },
  { pattern: "mod+p", reason: "Commonly used for Print" },
  { pattern: "mod+f", reason: "Commonly used for Find" },
  { pattern: "mod+s", reason: "Commonly used for Save" },
  { pattern: "mod+a", reason: "Commonly used for Select all" },
  { pattern: "mod+z", reason: "Commonly used for Undo" },
  { pattern: "mod+x", reason: "Commonly used for Cut" },
  { pattern: "mod+c", reason: "Commonly used for Copy" },
  { pattern: "mod+v", reason: "Commonly used for Paste" },
  { pattern: "mod+r", reason: "Commonly used for Reload page" },
  { pattern: "mod+shift+r", reason: "Commonly used for Hard reload" },
  { pattern: "mod+shift+i", reason: "Commonly used for Developer tools" },
  { pattern: "mod+shift+t", reason: "Commonly used for Reopen closed tab" },
  { pattern: "mod+shift+n", reason: "Commonly used for Private browsing" },
  { pattern: "mod+shift+delete", reason: "Commonly used for Clear browsing data" },
  { pattern: "mod+alt+i", reason: "Commonly used for Developer tools" },
  { pattern: "mod+alt+j", reason: "Commonly used for Developer console" },
  { pattern: "mod+alt+arrowleft", reason: "Commonly used for Back navigation" },
  { pattern: "mod+alt+arrowright", reason: "Commonly used for Forward navigation" },
];

const FUNCTION_KEY_PATTERN = /^f([1-9]|1[0-2])$/;

const normalizeKeyToken = (key: string): string => {
  const lower = key.toLowerCase();
  if (FUNCTION_KEY_PATTERN.test(lower)) {
    return lower;
  }
  if (lower === "escape") {
    return "escape";
  }
  if (lower === " ") {
    return "space";
  }
  if (lower.length === 1) {
    return lower;
  }
  if (lower.startsWith("arrow")) {
    return lower;
  }
  if (lower === "delete" || lower === "backspace") {
    return lower;
  }
  return lower;
};

export const normalizeBinding = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("+").map((part) => part.trim());
  const keyPart = parts[parts.length - 1];
  if (!keyPart) {
    return null;
  }

  const modifiers = new Set<string>();
  for (const part of parts.slice(0, -1)) {
    if (part === modToken || part === "meta" || part === "cmd" || part === "command") {
      modifiers.add(modToken);
    } else if (part === "ctrl" || part === "control") {
      modifiers.add("ctrl");
    } else if (part === "alt" || part === "option") {
      modifiers.add("alt");
    } else if (part === "shift") {
      modifiers.add("shift");
    } else {
      return null;
    }
  }

  const key = normalizeKeyToken(keyPart);
  if (!key) {
    return null;
  }

  const orderedModifiers = ["mod", "ctrl", "alt", "shift"].filter((modifier) => modifiers.has(modifier));

  if (orderedModifiers.length === 0 && !FUNCTION_KEY_PATTERN.test(key)) {
    return null;
  }

  return [...orderedModifiers, key].join("+");
};

export const bindingFromKeyboardEvent = (event: KeyboardEvent): string | null => {
  if (event.key === "Escape" || event.key === "Tab") {
    return null;
  }

  const key = normalizeKeyToken(event.key);
  if (!key || key === "control" || key === "meta" || key === "shift" || key === "alt") {
    return null;
  }

  const modifiers: string[] = [];
  const usesMod = isMac ? event.metaKey : event.ctrlKey;
  if (usesMod) {
    modifiers.push(modToken);
  }
  if (!isMac && event.metaKey) {
    modifiers.push("meta");
  }
  if (event.ctrlKey && !usesMod) {
    modifiers.push("ctrl");
  }
  if (event.altKey) {
    modifiers.push("alt");
  }
  if (event.shiftKey) {
    modifiers.push("shift");
  }

  if (modifiers.length === 0 && !FUNCTION_KEY_PATTERN.test(key)) {
    return null;
  }

  return normalizeBinding([...modifiers, key].join("+"));
};

export const matchesBinding = (event: KeyboardEvent, binding: string): boolean => {
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return false;
  }

  const parts = normalized.split("+");
  const key = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1));

  const eventKey = normalizeKeyToken(event.key);
  if (eventKey !== key) {
    return false;
  }

  const expectsMod = modifiers.has(modToken);
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  if (expectsMod !== modPressed) {
    return false;
  }

  if (modifiers.has("ctrl") && !event.ctrlKey) {
    return false;
  }
  if (modifiers.has("alt") !== event.altKey) {
    return false;
  }
  if (modifiers.has("shift") !== event.shiftKey) {
    return false;
  }
  if (modifiers.has("meta") && !event.metaKey) {
    return false;
  }

  if (!modifiers.has("ctrl") && !expectsMod && event.ctrlKey) {
    return false;
  }
  if (!modifiers.has("meta") && !expectsMod && event.metaKey && isMac) {
    return false;
  }

  return true;
};

export const formatShortcutLabel = (binding: string | null): string => {
  if (!binding) {
    return "None";
  }

  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return binding;
  }

  const parts = normalized.split("+");
  const key = parts[parts.length - 1] ?? "";
  const labels: string[] = [];

  for (const part of parts.slice(0, -1)) {
    if (part === modToken) {
      labels.push(isMac ? "⌘" : "Ctrl");
    } else if (part === "ctrl") {
      labels.push("Ctrl");
    } else if (part === "alt") {
      labels.push(isMac ? "⌥" : "Alt");
    } else if (part === "shift") {
      labels.push(isMac ? "⇧" : "Shift");
    } else if (part === "meta") {
      labels.push("⌘");
    }
  }

  const keyLabel =
    key.length === 1
      ? key.toUpperCase()
      : key.startsWith("f") && FUNCTION_KEY_PATTERN.test(key)
        ? key.toUpperCase()
        : key === ","
          ? ","
          : key.charAt(0).toUpperCase() + key.slice(1);

  labels.push(keyLabel);
  return labels.join(isMac ? "" : "+");
};

export type ShortcutValidationIssue = {
  actionId?: ShortcutActionId;
  message: string;
};

export const getReservedBindingReason = (binding: string | null): string | null => {
  if (!binding) {
    return null;
  }
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return "Shortcut is invalid. Use at least one modifier with a key, or a function key.";
  }

  const match = RESERVED_BINDINGS.find((entry) => entry.pattern === normalized);
  return match?.reason ?? null;
};

export const validateShortcutSettings = (settings: ShortcutSettings): ShortcutValidationIssue[] => {
  const issues: ShortcutValidationIssue[] = [];
  const seen = new Map<string, ShortcutActionId>();

  for (const actionId of SHORTCUT_ACTION_ORDER) {
    const binding = settings[actionId];
    if (!binding) {
      continue;
    }

    const normalized = normalizeBinding(binding);
    if (!normalized) {
      issues.push({
        actionId,
        message: "Invalid shortcut format.",
      });
      continue;
    }

    const reservedReason = getReservedBindingReason(normalized);
    if (reservedReason) {
      issues.push({
        actionId,
        message: reservedReason,
      });
    }

    const existing = seen.get(normalized);
    if (existing) {
      issues.push({
        actionId,
        message: `Already assigned to “${SHORTCUT_ACTION_LABELS[existing]}”.`,
      });
    } else {
      seen.set(normalized, actionId);
    }
  }

  return issues;
};

export const parseShortcutSettings = (raw: string | null): ShortcutSettings => {
  const defaults = defaultShortcutSettings();
  if (!raw) {
    return defaults;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaults;
    }

    const next = { ...defaults };
    for (const actionId of SHORTCUT_ACTION_ORDER) {
      const value = parsed[actionId];
      if (value === null) {
        next[actionId] = null;
      } else if (typeof value === "string") {
        next[actionId] = normalizeBinding(value) ?? defaults[actionId];
      }
    }
    return next;
  } catch {
    return defaults;
  }
};

export const loadShortcutSettings = (): ShortcutSettings => {
  if (typeof window === "undefined") {
    return defaultShortcutSettings();
  }

  return parseShortcutSettings(window.localStorage.getItem(SHORTCUT_SETTINGS_KEY));
};

export const saveShortcutSettings = (settings: ShortcutSettings): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SHORTCUT_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SHORTCUT_SETTINGS_CHANGED_EVENT));
};

import { useEffect } from "react";
import {
  matchesBinding,
  SHORTCUT_ACTIONS_ALLOWED_IN_INPUTS,
  SHORTCUT_ACTION_ORDER,
  type ShortcutActionId,
  type ShortcutSettings,
} from "../lib/shortcut-settings";

export type ShortcutHandlers = Partial<Record<ShortcutActionId, () => void>>;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export const useAppShortcuts = (settings: ShortcutSettings, handlers: ShortcutHandlers, enabled = true): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const inEditable = isEditableTarget(event.target);

      for (const actionId of SHORTCUT_ACTION_ORDER) {
        const binding = settings[actionId];
        const handler = handlers[actionId];
        if (!binding || !handler) {
          continue;
        }

        if (inEditable && !SHORTCUT_ACTIONS_ALLOWED_IN_INPUTS.has(actionId)) {
          continue;
        }

        if (!matchesBinding(event, binding)) {
          continue;
        }

        event.preventDefault();
        handler();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handlers, settings]);
};

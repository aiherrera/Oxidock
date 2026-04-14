import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import {
  bindingFromKeyboardEvent,
  defaultShortcutSettings,
  formatShortcutLabel,
  saveShortcutSettings,
  SHORTCUT_ACTION_LABELS,
  SHORTCUT_ACTION_ORDER,
  validateShortcutSettings,
  type ShortcutActionId,
  type ShortcutSettings,
  type ShortcutValidationIssue,
} from "../lib/shortcut-settings";
import { alertDanger, alertWarningSubtle } from "../lib/theme-classes";

type ShortcutsSettingsPanelProps = {
  settings: ShortcutSettings;
  onChange: (settings: ShortcutSettings) => void;
  idPrefix?: string;
};

const issueForAction = (issues: ShortcutValidationIssue[], actionId: ShortcutActionId): string | null => {
  const match = issues.find((issue) => issue.actionId === actionId);
  return match?.message ?? null;
};

export function ShortcutsSettingsPanel({
  settings,
  onChange,
  idPrefix = "shortcuts-settings",
}: ShortcutsSettingsPanelProps) {
  const [capturingActionId, setCapturingActionId] = useState<ShortcutActionId | null>(null);

  const validationIssues = useMemo(() => validateShortcutSettings(settings), [settings]);

  const hasBlockingIssues = validationIssues.length > 0;

  const persist = useCallback(
    (next: ShortcutSettings) => {
      const issues = validateShortcutSettings(next);
      if (issues.length === 0) {
        saveShortcutSettings(next);
      }
      onChange(next);
    },
    [onChange]
  );

  const handleCaptureKeyDown = useCallback(
    (event: KeyboardEvent, actionId: ShortcutActionId) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setCapturingActionId(null);
        return;
      }

      const binding = bindingFromKeyboardEvent(event.nativeEvent);
      if (!binding) {
        return;
      }

      const next = { ...settings, [actionId]: binding };
      persist(next);
      setCapturingActionId(null);
    },
    [persist, settings]
  );

  const handleClear = (actionId: ShortcutActionId) => {
    persist({ ...settings, [actionId]: null });
  };

  const handleResetDefaults = () => {
    const defaults = defaultShortcutSettings();
    saveShortcutSettings(defaults);
    onChange(defaults);
    setCapturingActionId(null);
  };

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-(--text-secondary)">Keyboard shortcuts</h2>
          <p className="mt-1 text-xs leading-5 text-(--text-muted)">
            Shortcuts work while Oxidock is focused. The OS or another app may intercept some keys before Oxidock
            receives them; we cannot detect shortcuts owned by other applications.
          </p>
        </div>
        <button
          className="inline-flex min-h-9 items-center rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
          type="button"
          onClick={handleResetDefaults}
        >
          Reset to defaults
        </button>
      </div>

      {hasBlockingIssues ? (
        <p className={`mt-3 rounded-md px-3 py-2 text-xs ${alertWarningSubtle}`}>
          Fix conflicting or reserved shortcuts below. Invalid bindings are not saved to disk until resolved.
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-(--border)">
        {SHORTCUT_ACTION_ORDER.map((actionId) => {
          const binding = settings[actionId];
          const isCapturing = capturingActionId === actionId;
          const fieldId = `${idPrefix}-${actionId}`;
          const error = issueForAction(validationIssues, actionId);

          return (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              key={actionId}
            >
              <label
                className="min-w-0 flex-1 text-sm text-(--text-secondary)"
                htmlFor={fieldId}
              >
                {SHORTCUT_ACTION_LABELS[actionId]}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  aria-label={`${isCapturing ? "Recording" : "Change"} shortcut for ${SHORTCUT_ACTION_LABELS[actionId]}`}
                  className={`inline-flex min-h-9 min-w-[7rem] items-center justify-center rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                    isCapturing
                      ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                      : error
                        ? "border-red-500/40 bg-red-500/5 text-(--text-primary)"
                        : "border-(--border) bg-(--surface-elevated) text-(--text-primary) hover:bg-(--surface-hover)"
                  }`}
                  id={fieldId}
                  type="button"
                  onBlur={() => {
                    if (isCapturing) {
                      setCapturingActionId(null);
                    }
                  }}
                  onClick={() => setCapturingActionId((current) => (current === actionId ? null : actionId))}
                  onKeyDown={(event) => {
                    if (isCapturing) {
                      handleCaptureKeyDown(event, actionId);
                    }
                  }}
                >
                  {isCapturing ? "Press keys…" : formatShortcutLabel(binding)}
                </button>
                {binding ? (
                  <button
                    className="inline-flex min-h-9 items-center rounded-lg px-2 py-1.5 text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
                    type="button"
                    onClick={() => handleClear(actionId)}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {error ? <p className={`w-full rounded-md px-2 py-1 text-xs ${alertDanger}`}>{error}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

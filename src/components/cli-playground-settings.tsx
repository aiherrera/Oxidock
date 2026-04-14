import { saveCliPlaygroundSettings, type CliPlaygroundSettings } from "../lib/cli-playground-settings";
import { alertWarningSubtle, statusBadgeSuccess, statusBadgeWarning } from "../lib/theme-classes";

type CliPlaygroundSettingsProps = {
  settings: CliPlaygroundSettings;
  onChange: (settings: CliPlaygroundSettings) => void;
  idPrefix?: string;
};

export function CliPlaygroundSettingsPanel({
  settings,
  onChange,
  idPrefix = "cli-settings",
}: CliPlaygroundSettingsProps) {
  const toggleId = `${idPrefix}-destructive-protection`;

  const handleToggle = (enabled: boolean) => {
    const next = { destructiveProtectionEnabled: enabled };
    saveCliPlaygroundSettings(next);
    onChange(next);
  };

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-(--text-secondary)">CLI safety settings</h2>
          <p className="mt-1 text-xs leading-5 text-(--text-muted)">
            Recommended for learning mode. Advanced users can turn this off to run destructive commands without an extra
            prompt.
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${
            settings.destructiveProtectionEnabled ? statusBadgeSuccess : statusBadgeWarning
          }`}
        >
          {settings.destructiveProtectionEnabled ? "Protection on" : "Protection off"}
        </span>
      </div>

      <label
        className="mt-4 flex cursor-pointer items-start gap-3"
        htmlFor={toggleId}
      >
        <input
          checked={settings.destructiveProtectionEnabled}
          className="mt-0.5 size-4 rounded border-(--border) accent-(--accent)"
          id={toggleId}
          type="checkbox"
          onChange={(event) => handleToggle(event.target.checked)}
        />
        <span className="text-sm text-(--text-secondary)">Confirm before destructive Docker commands</span>
      </label>

      {!settings.destructiveProtectionEnabled ? (
        <p className={`mt-3 rounded-md px-3 py-2 text-xs ${alertWarningSubtle}`}>
          Destructive commands will run immediately without a confirmation modal.
        </p>
      ) : null}
    </section>
  );
}

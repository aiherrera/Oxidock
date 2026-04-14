import { useState } from "react";
import { CliAiAssistantCard } from "./cli-ai-assistant-card";
import { CliPlaygroundSettingsPanel } from "./cli-playground-settings";
import { EngineSettingsPanel } from "./engine-settings-panel";
import { RegistrySettingsPanel } from "./registry-settings-panel";
import { ShortcutsSettingsPanel } from "./shortcuts-settings";
import { PageShell } from "./page-shell";
import { loadCliPlaygroundSettings, type CliPlaygroundSettings } from "../lib/cli-playground-settings";
import { loadShortcutSettings, type ShortcutSettings } from "../lib/shortcut-settings";
import type { ThemePreference } from "../lib/theme-settings";
import { ThemeSettingsPanel } from "./theme-settings-panel";

type SettingsPageProps = {
  isLoading: boolean;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onEngineChanged?: (revision: number) => void;
};

export function SettingsPage({
  isLoading,
  themePreference,
  onThemePreferenceChange,
  onEngineChanged,
}: SettingsPageProps) {
  const [cliSettings, setCliSettings] = useState<CliPlaygroundSettings>(() => loadCliPlaygroundSettings());
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(() => loadShortcutSettings());

  return (
    <PageShell
      description="Configure container engines, registries, shortcuts, optional assistants, and CLI safety behavior."
      errorMessage={null}
      isLoading={isLoading}
      title="Settings"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <section
          aria-labelledby="settings-general-heading"
          className="rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5"
        >
          <div>
            <h2
              className="text-base font-semibold text-(--text-primary)"
              id="settings-general-heading"
            >
              General
            </h2>
            <p className="mt-1 text-sm text-(--text-secondary)">
              Configure appearance, assistant features, and CLI safety.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <ThemeSettingsPanel
              preference={themePreference}
              onChange={onThemePreferenceChange}
            />
            <CliAiAssistantCard />
            <CliPlaygroundSettingsPanel
              idPrefix="settings-cli"
              settings={cliSettings}
              onChange={setCliSettings}
            />
          </div>
        </section>
        <EngineSettingsPanel onEngineChanged={onEngineChanged} />
        <RegistrySettingsPanel />
        <ShortcutsSettingsPanel
          idPrefix="settings-shortcuts"
          settings={shortcutSettings}
          onChange={setShortcutSettings}
        />
      </div>
    </PageShell>
  );
}

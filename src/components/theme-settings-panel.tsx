import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { THEME_PREFERENCE_LABELS, type ThemePreference } from "../lib/theme-settings";

type ThemeSettingsPanelProps = {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  idPrefix?: string;
};

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export function ThemeSettingsPanel({ preference, onChange, idPrefix = "theme-settings" }: ThemeSettingsPanelProps) {
  const selectId = `${idPrefix}-preference`;

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div>
        <h2 className="text-sm font-medium text-(--text-secondary)">Appearance</h2>
        <p className="mt-1 text-xs leading-5 text-(--text-muted)">
          Choose how Oxidock looks. System follows your operating system color scheme.
        </p>
      </div>

      <div className="mt-4">
        <label
          className="mb-1.5 block text-xs font-medium text-(--text-muted)"
          htmlFor={selectId}
        >
          Theme
        </label>
        <Select
          value={preference}
          onValueChange={(value) => onChange(value as ThemePreference)}
        >
          <SelectTrigger
            className="max-w-xs"
            id={selectId}
          >
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            {THEME_OPTIONS.map((option) => (
              <SelectItem
                key={option}
                value={option}
              >
                {THEME_PREFERENCE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}

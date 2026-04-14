export type CliPlaygroundSettings = {
  destructiveProtectionEnabled: boolean;
};

export const CLI_PLAYGROUND_SETTINGS_KEY = "oxidock.cliPlayground.settings.v1";

export const defaultCliPlaygroundSettings: CliPlaygroundSettings = {
  destructiveProtectionEnabled: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const parseCliPlaygroundSettings = (raw: string | null): CliPlaygroundSettings => {
  if (!raw) {
    return defaultCliPlaygroundSettings;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaultCliPlaygroundSettings;
    }

    if (typeof parsed.destructiveProtectionEnabled !== "boolean") {
      return defaultCliPlaygroundSettings;
    }

    return {
      destructiveProtectionEnabled: parsed.destructiveProtectionEnabled,
    };
  } catch {
    return defaultCliPlaygroundSettings;
  }
};

export const loadCliPlaygroundSettings = (): CliPlaygroundSettings => {
  if (typeof window === "undefined") {
    return defaultCliPlaygroundSettings;
  }

  return parseCliPlaygroundSettings(window.localStorage.getItem(CLI_PLAYGROUND_SETTINGS_KEY));
};

export const saveCliPlaygroundSettings = (settings: CliPlaygroundSettings): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLI_PLAYGROUND_SETTINGS_KEY, JSON.stringify(settings));
};

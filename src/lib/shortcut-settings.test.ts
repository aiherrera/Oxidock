import { describe, expect, it } from "vitest";
import { defaultShortcutSettings, parseShortcutSettings } from "./shortcut-settings";

describe("defaultShortcutSettings", () => {
  it("assigns the learn section navigation shortcuts in sidebar order", () => {
    expect(defaultShortcutSettings()).toMatchObject({
      navigateDocs: "mod+7",
      navigateCli: "mod+8",
      navigateAssistant: "mod+9",
    });
  });

  it("migrates previous learn navigation defaults without replacing custom bindings", () => {
    const settings = parseShortcutSettings(
      JSON.stringify({
        navigateDocs: "mod+8",
        navigateCli: "mod+7",
        navigateLogs: "ctrl+shift+l",
      })
    );

    expect(settings).toMatchObject({
      navigateDocs: "mod+7",
      navigateCli: "mod+8",
      navigateAssistant: "mod+9",
      navigateLogs: "ctrl+shift+l",
    });
  });
});

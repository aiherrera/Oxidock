import { describe, expect, it } from "vitest";
import { APP_PAGES, getAppPagesBySection } from "./app";

describe("app navigation model", () => {
  it("groups pages into overview, tools, and learn sections", () => {
    expect(getAppPagesBySection("overview").map((page) => page.id)).toEqual(["dashboard"]);
    expect(getAppPagesBySection("tools").map((page) => page.id)).toEqual([
      "containers",
      "images",
      "volumes",
      "networks",
      "events",
      "logs",
    ]);
    expect(getAppPagesBySection("learn").map((page) => page.id)).toEqual(["docs", "cli", "assistant"]);
  });

  it("uses the requested sidebar labels", () => {
    const labels = Object.fromEntries(APP_PAGES.map((page) => [page.id, page.label]));
    expect(labels.dashboard).toBe("Dashboard");
    expect(labels.docs).toBe("Command School");
    expect(labels.assistant).toBe("AI Assistant");
  });
});

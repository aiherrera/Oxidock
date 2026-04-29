import { describe, expect, it } from "vitest";
import { getLessonForCommand } from "./intelligent-search-index";

describe("getLessonForCommand", () => {
  it("returns a lesson in O(1) for known command ids", () => {
    const lesson = getLessonForCommand("containers.listRunning");
    expect(lesson).toBeDefined();
    expect(lesson?.commandIds).toContain("containers.listRunning");
  });

  it("returns undefined for unknown command ids", () => {
    expect(getLessonForCommand("not-a-real-command-id" as never)).toBeUndefined();
  });
});

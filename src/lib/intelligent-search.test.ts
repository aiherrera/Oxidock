import { describe, expect, it } from "vitest";
import { buildIntelligentSearchGroups } from "./intelligent-search";

const emptySnapshot = {
  containers: [],
  images: [],
  volumes: [],
  networks: [],
};

describe("buildIntelligentSearchGroups", () => {
  it("does not duplicate command result ids in learn scope", () => {
    const groups = buildIntelligentSearchGroups({
      query: "docker ps",
      snapshot: emptySnapshot,
      registryResults: [],
      includeRegistry: false,
    });

    const learnGroup = groups.find((group) => group.scope === "learn");
    expect(learnGroup).toBeDefined();

    const commandIds = (learnGroup?.results ?? [])
      .filter((result) => result.kind === "command")
      .map((result) => result.id);

    expect(new Set(commandIds).size).toBe(commandIds.length);
  });

  it("includes commandId on lesson-backed command navigate actions", () => {
    const groups = buildIntelligentSearchGroups({
      query: "docker ps",
      snapshot: emptySnapshot,
      registryResults: [],
      includeRegistry: false,
    });

    const learnGroup = groups.find((group) => group.scope === "learn");
    const commandResult = learnGroup?.results.find((result) => result.kind === "command");

    expect(commandResult).toBeDefined();
    expect(commandResult?.action.type).toBe("navigate");
    if (commandResult?.action.type === "navigate") {
      expect(commandResult.action.page).toBe("docs");
      expect(commandResult.action.lessonId).toBeDefined();
      expect(commandResult.action.commandId).toBeDefined();
    }
  });
});

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

  it("prioritizes image page results without removing global matches", () => {
    const groups = buildIntelligentSearchGroups({
      query: "postgres",
      currentPage: "images",
      snapshot: {
        containers: [
          {
            id: "container-id",
            shortId: "container",
            name: "postgres-api",
            image: "postgres:16",
            state: "running",
            status: "Up 5 minutes",
            ports: [],
            createdAt: "2026-05-30T00:00:00.000Z",
            project: null,
            service: null,
            command: "postgres",
            lastStartedAt: "2026-05-30T00:00:00.000Z",
          },
        ],
        images: [
          {
            id: "image-id",
            shortId: "image",
            repository: "postgres",
            tag: "16",
            size: "400MB",
            createdAt: "2026-05-30T00:00:00.000Z",
            containers: 1,
          },
        ],
        volumes: [],
        networks: [],
      },
      registryResults: [
        {
          registryId: "docker-hub",
          registryName: "Docker Hub",
          name: "postgres",
          description: "The PostgreSQL object-relational database system.",
          starCount: 10000,
          isOfficial: true,
          pullReference: "postgres:latest",
        },
      ],
      includeRegistry: true,
    });

    expect(groups.map((group) => group.scope).slice(0, 2)).toEqual(["local", "registry"]);
    expect(groups[0]?.results[0]?.kind).toBe("image");
    expect(groups[0]?.results.some((result) => result.kind === "container")).toBe(true);
  });

  it("offers registry search for broad queries on the images page", () => {
    const groups = buildIntelligentSearchGroups({
      query: "database server",
      currentPage: "images",
      snapshot: emptySnapshot,
      registryResults: [],
      includeRegistry: true,
    });

    expect(groups[0]?.scope).toBe("registry");
    expect(groups[0]?.results[0]?.title).toBe('Search registries for "database server"');
  });
});

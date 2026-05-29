import { describe, expect, it } from "vitest";
import { buildDeterministicResponse } from "./app-insights-assistant";
import { buildDeterministicInsights, type AppInsightsContextSnapshot } from "./assistant-context";

const snapshot: AppInsightsContextSnapshot = {
  collectedAt: new Date().toISOString(),
  docker: {
    isRunning: true,
    engineState: "running",
    message: "Docker is reachable.",
    serverVersion: "27.0.0",
    providerName: "Docker",
  },
  counts: {
    containers: 1,
    running: 0,
    exited: 1,
    images: 0,
    volumes: 0,
    networks: 0,
  },
  containers: [
    {
      id: "id",
      shortId: "short",
      name: "api",
      image: "api:latest",
      state: "exited",
      status: "Exited (1) 1 minute ago",
      project: null,
      service: null,
    },
  ],
  images: [],
  volumes: [],
  networks: [],
  recentEvents: [],
  matchedDocs: [],
  logExcerpts: [
    {
      containerName: "api",
      excerpt: "Error: boom\n    at handler (server.js:10:5)",
    },
  ],
};

describe("buildDeterministicResponse", () => {
  it("maps insights to sources, commands, and stack traces", () => {
    const insights = buildDeterministicInsights(snapshot);
    const response = buildDeterministicResponse(snapshot, insights, "What failed?");

    expect(response.usedModel).toBe(false);
    expect(response.sources.some((source) => source.kind === "container")).toBe(true);
    expect(response.answer).toContain("The main thing I found");
    expect(response.stackTraces.length).toBeGreaterThan(0);
  });

  it("filters support details to the current question intent", () => {
    const imageSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      counts: {
        ...snapshot.counts,
        images: 2,
      },
      containers: [
        {
          id: "db-id",
          shortId: "db",
          name: "db",
          image: "postgres:16",
          state: "exited",
          status: "Exited (137) 2 weeks ago",
          project: null,
          service: null,
        },
      ],
      images: [
        { repository: "<none>", tag: "<none>", size: "100MB", containers: 0 },
        { repository: "postgres", tag: "16", size: "400MB", containers: 1 },
      ],
    };

    const response = buildDeterministicResponse(
      imageSnapshot,
      buildDeterministicInsights(imageSnapshot),
      "Which images are still attached to containers?"
    );

    expect(response.answer).toContain("image(s) still attached");
    expect(response.answer).not.toContain("OOM-killed");
    expect(response.reasoning).not.toContain("OOM-killed");
    expect(response.suggestedCommands.map((command) => command.command)).not.toContain(
      "docker update --memory=1g --memory-swap=2g db"
    );
  });
});

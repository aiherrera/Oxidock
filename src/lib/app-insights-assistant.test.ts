import { describe, expect, it } from "vitest";
import { buildDeterministicResponse, resolveAssistantRequest } from "./app-insights-assistant";
import {
  buildDeterministicInsights,
  OXIDOCK_ASSISTANT_SCOPE_MESSAGE,
  type AppInsightsContextSnapshot,
} from "./assistant-context";

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

const requestFor = (question: string, overrides: Partial<ReturnType<typeof resolveAssistantRequest>> = {}) =>
  resolveAssistantRequest({ question, ...overrides });

describe("buildDeterministicResponse", () => {
  it("returns only the scope message for irrelevant questions", () => {
    const insights = buildDeterministicInsights(snapshot);
    const response = buildDeterministicResponse(
      snapshot,
      insights,
      requestFor("who is the president of the United States?")
    );

    expect(response.answer).toBe(OXIDOCK_ASSISTANT_SCOPE_MESSAGE);
    expect(response.sources).toHaveLength(0);
    expect(response.suggestedCommands).toHaveLength(0);
    expect(response.stackTraces).toHaveLength(0);
    expect(response.reasoning).toBeNull();
  });

  it("maps insights to sources, commands, and stack traces", () => {
    const insights = buildDeterministicInsights(snapshot);
    const response = buildDeterministicResponse(snapshot, insights, requestFor("What failed?"));

    expect(response.usedModel).toBe(false);
    expect(response.sources.some((source) => source.kind === "container")).toBe(true);
    expect(response.answer).toContain("The main thing I found");
    expect(response.stackTraces.length).toBeGreaterThan(0);
  });

  it("scopes support details to the named container", () => {
    const scopedSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      counts: {
        ...snapshot.counts,
        containers: 2,
      },
      containers: [
        {
          id: "db-id",
          shortId: "db",
          name: "database",
          image: "postgres:16",
          state: "restarting",
          status: "Restarting (137) 2 seconds ago",
          project: null,
          service: "postgres",
        },
        {
          id: "worker-id",
          shortId: "worker",
          name: "worker",
          image: "queue-worker:latest",
          state: "exited",
          status: "Exited (137) 2 weeks ago",
          project: null,
          service: null,
        },
      ],
    };

    const response = buildDeterministicResponse(
      scopedSnapshot,
      buildDeterministicInsights(scopedSnapshot),
      requestFor("Why is postgres restarting?", { currentRequest: "Why is postgres restarting?" })
    );

    expect(response.answer).toContain("database may have been OOM-killed");
    expect(response.answer).not.toContain("worker may have been OOM-killed");
    expect(response.reasoning).toContain("database may have been OOM-killed");
    expect(response.reasoning).not.toContain("worker may have been OOM-killed");
    expect(response.sources.map((source) => source.id)).toEqual(["engine", "container:db"]);
    expect(response.suggestedCommands.map((command) => command.command)).toEqual([
      "docker update --memory=1g --memory-swap=2g database",
      "docker logs --tail 50 database",
    ]);
  });

  it("does not suggest memory-limit increases for safe memory-pressure reduction", () => {
    const pressureSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      containers: [
        {
          id: "api-id",
          shortId: "api",
          name: "gen-bench-api-1",
          image: "api:latest",
          state: "running",
          status: "Up 40 hours",
          project: null,
          service: "api",
          memoryPercent: "1.09%",
        },
        {
          id: "db-id",
          shortId: "db",
          name: "backend-engine-db-1",
          image: "postgres:16",
          state: "exited",
          status: "Exited (137) 40 hours ago",
          project: null,
          service: "postgres",
        },
      ],
    };

    const response = buildDeterministicResponse(
      pressureSnapshot,
      buildDeterministicInsights(pressureSnapshot),
      requestFor("How can I reduce memory pressure safely?", {
        currentRequest: "How can I reduce memory pressure safely?",
      })
    );

    expect(response.answer).toContain("I do not see acute live memory pressure");
    expect(response.suggestedCommands.map((command) => command.command)).not.toContain(
      "docker update --memory=1g --memory-swap=2g backend-engine-db-1"
    );
  });

  it("does not carry failure reasoning or commands into volume answers", () => {
    const volumeSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      volumes: [{ name: "pg_data", driver: "local", scope: "local" }],
    };

    const response = buildDeterministicResponse(
      volumeSnapshot,
      buildDeterministicInsights(volumeSnapshot),
      requestFor("Which volumes exist?", { currentRequest: "Which volumes exist?" })
    );

    expect(response.answer).toContain("pg_data");
    expect(response.reasoning).toBeNull();
    expect(response.sources.map((source) => source.kind)).toEqual(["engine", "volume"]);
    expect(response.suggestedCommands).toEqual([]);
    expect(response.stackTraces).toEqual([]);
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
      requestFor("Which images are still attached to containers?", {
        currentRequest: "Which images are still attached to containers?",
      })
    );

    expect(response.answer).toContain("image(s) still attached");
    expect(response.answer).not.toContain("OOM-killed");
    expect(response.reasoning).not.toContain("OOM-killed");
    expect(response.suggestedCommands.map((command) => command.command)).not.toContain(
      "docker update --memory=1g --memory-swap=2g db"
    );
  });

  it("routes event questions differently from image questions with similar wording", () => {
    const richSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      counts: {
        ...snapshot.counts,
        images: 2,
      },
      images: [
        { repository: "nginx", tag: "latest", size: "180MB", containers: 1 },
        { repository: "<none>", tag: "<none>", size: "100MB", containers: 0 },
      ],
      recentEvents: [
        {
          time: "2026-05-28T12:00:00Z",
          action: "die",
          actorName: "api",
          typ: "container",
        },
      ],
    };

    const eventResponse = buildDeterministicResponse(
      richSnapshot,
      buildDeterministicInsights(richSnapshot),
      requestFor("What recent Docker events happened?", { currentRequest: "What recent Docker events happened?" })
    );
    const imageResponse = buildDeterministicResponse(
      richSnapshot,
      buildDeterministicInsights(richSnapshot),
      requestFor("Which images are still attached to containers?", {
        currentRequest: "Which images are still attached to containers?",
      })
    );

    expect(eventResponse.answer).toContain("Recent events:");
    expect(imageResponse.answer).toContain("image(s) still attached");
    expect(eventResponse.answer).not.toContain("image(s) still attached");
    expect(imageResponse.answer).not.toContain("Recent events:");
  });

  it("answers command-seeking event questions with a suggested Docker events command", () => {
    const richSnapshot: AppInsightsContextSnapshot = {
      ...snapshot,
      recentEvents: [
        {
          time: "2026-05-28T12:00:00Z",
          action: "die",
          actorName: "api",
          typ: "container",
        },
      ],
      matchedDocs: [
        {
          id: "events.stream",
          label: "Stream events",
          example: "docker events --since 1h",
          risk: "safe",
        },
      ],
    };

    const response = buildDeterministicResponse(
      richSnapshot,
      buildDeterministicInsights(richSnapshot),
      requestFor("What command should I run to monitor new events?", {
        currentRequest: "What command should I run to monitor new events?",
      })
    );

    expect(response.answer).toContain("`docker events`");
    expect(response.answer).not.toContain("Recent events:");
    expect(response.answer).not.toContain("suspicious event");
    expect(response.suggestedCommands.map((command) => command.command)).toContain("docker events --since 1h");
  });

  it("summarizes pasted context without defaulting to docker failures", () => {
    const response = buildDeterministicResponse(
      snapshot,
      buildDeterministicInsights(snapshot),
      requestFor("Summarize this\n\n# Oxidock\nLocal Docker desktop", {
        currentRequest: "Summarize this",
        pastedContext: "# Oxidock\nLocal Docker desktop",
      })
    );

    expect(response.answer).toContain("concise summary");
    expect(response.answer).not.toContain("The main thing I found");
  });

  it("answers architecture questions from pasted context sections", () => {
    const pastedContext = [
      "# Oxidock",
      "",
      "Intro paragraph about the app.",
      "",
      "## Architecture",
      "",
      "Built with **Tauri 2** and **React 19**. Rust uses **bollard** for Docker.",
      "",
      "## Features",
      "",
      "- Containers dashboard",
    ].join("\n");

    const response = buildDeterministicResponse(
      snapshot,
      [],
      requestFor("how is the architecture of oxidock?", {
        currentRequest: "how is the architecture of oxidock?",
        pastedContext,
      })
    );

    expect(response.answer).toContain("Architecture");
    expect(response.answer).toContain("Tauri");
    expect(response.answer).toContain("bollard");
    expect(response.answer).not.toContain("Context preview:");
    expect(response.answer).not.toContain("Developers want a **native, foc");
  });

  it("refuses unrelated questions even when prior chat exists", () => {
    const response = buildDeterministicResponse(
      snapshot,
      buildDeterministicInsights(snapshot),
      requestFor("Who is the president?", {
        currentRequest: "Who is the president?",
        hasConversationContext: true,
      })
    );

    expect(response.answer).toBe(OXIDOCK_ASSISTANT_SCOPE_MESSAGE);
  });
});

describe("resolveAssistantRequest", () => {
  it("keeps current request separate from pasted context", () => {
    const resolved = resolveAssistantRequest({
      question: "Compare this\n\nservices:\n  web:\n    image: nginx",
      currentRequest: "Compare this",
      pastedContext: "services:\n  web:\n    image: nginx",
    });

    expect(resolved.currentRequest).toBe("Compare this");
    expect(resolved.pastedContext).toContain("nginx");
    expect(resolved.intent).toBe("compare_context_to_state");
  });
});

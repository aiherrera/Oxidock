import { describe, expect, it } from "vitest";
import {
  buildDeterministicAnswer,
  buildDeterministicInsights,
  type AppInsightsContextSnapshot,
} from "./assistant-context";

const baseSnapshot = (): AppInsightsContextSnapshot => ({
  collectedAt: new Date().toISOString(),
  docker: {
    isRunning: true,
    engineState: "running",
    message: "Docker is reachable.",
    serverVersion: "27.0.0",
    providerName: "Docker",
  },
  counts: {
    containers: 2,
    running: 1,
    exited: 1,
    images: 3,
    volumes: 1,
    networks: 1,
  },
  containers: [
    {
      id: "full-postgres",
      shortId: "abc123",
      name: "postgres",
      image: "postgres:16",
      state: "restarting",
      status: "Restarting (137) 2 seconds ago",
      project: "demo",
      service: "postgres",
      memoryPercent: "92.00%",
    },
    {
      id: "full-web",
      shortId: "def456",
      name: "web",
      image: "nginx:latest",
      state: "running",
      status: "Up 2 hours",
      project: null,
      service: null,
      cpuPercent: "95.00%",
    },
  ],
  images: [
    { repository: "<none>", tag: "<none>", size: "120MB", containers: 0 },
    { repository: "nginx", tag: "latest", size: "180MB", containers: 1 },
  ],
  volumes: [{ name: "demo_data", driver: "local", scope: "local" }],
  networks: [{ name: "bridge", driver: "bridge", containerCount: 2 }],
  recentEvents: [
    {
      time: "2026-05-28T12:00:00Z",
      action: "die",
      actorName: "postgres",
      typ: "container",
    },
  ],
  matchedDocs: [],
  logExcerpts: [],
});

describe("buildDeterministicInsights", () => {
  it("flags OOM, restart loops, resource pressure, and dangling images", () => {
    const insights = buildDeterministicInsights(baseSnapshot());

    expect(insights.some((insight) => insight.id.includes("oom"))).toBe(true);
    expect(insights.some((insight) => insight.id.includes("restart"))).toBe(true);
    expect(insights.some((insight) => insight.id === "dangling-images")).toBe(true);
    expect(insights.some((insight) => insight.id === "recent-error-events")).toBe(true);
  });

  it("returns engine warning when Docker is stopped", () => {
    const snapshot = baseSnapshot();
    snapshot.docker.isRunning = false;
    snapshot.docker.message = "Cannot connect";

    const insights = buildDeterministicInsights(snapshot);
    expect(insights).toHaveLength(1);
    expect(insights[0]?.id).toBe("engine-stopped");
  });
});

describe("buildDeterministicAnswer", () => {
  it("includes snapshot summary and findings", () => {
    const snapshot = baseSnapshot();
    const insights = buildDeterministicInsights(snapshot);
    const answer = buildDeterministicAnswer(snapshot, insights, "Why is postgres restarting?");

    expect(answer).toContain("The main thing I found");
    expect(answer).toContain("postgres may have been OOM-killed");
    expect(answer).toContain("Most relevant findings:");
    expect(answer).not.toContain("Snapshot:");
    expect(answer).not.toContain("You asked:");
  });

  it("keeps log excerpts out of the final answer body", () => {
    const snapshot = baseSnapshot();
    snapshot.logExcerpts = [
      {
        containerName: "postgres",
        excerpt: "Error: connection refused",
      },
    ];

    const answer = buildDeterministicAnswer(snapshot, [], "logs");
    expect(answer).not.toContain("Error: connection refused");
    expect(answer).not.toContain("```");
  });

  it("answers memory questions with a ranked current memory summary", () => {
    const snapshot = baseSnapshot();
    snapshot.containers[1] = {
      ...snapshot.containers[1],
      memoryPercent: "33.00%",
    };

    const answer = buildDeterministicAnswer(
      snapshot,
      buildDeterministicInsights(snapshot),
      "Which containers use the most memory?"
    );

    expect(answer).toContain("postgres");
    expect(answer).toContain("92.00%");
    expect(answer).toContain("Top memory users:");
    expect(answer).not.toContain("backend");
    expect(answer).not.toContain("Snapshot:");
  });

  it("answers image attachment questions without leading with unrelated OOM findings", () => {
    const snapshot = baseSnapshot();
    const answer = buildDeterministicAnswer(
      snapshot,
      buildDeterministicInsights(snapshot),
      "Which images are still attached to containers?"
    );

    expect(answer).toContain("image(s) still attached to containers");
    expect(answer).toContain("nginx:latest");
    expect(answer).not.toContain("backend-engine-db");
    expect(answer).not.toContain("OOM-killed");
    expect(answer).not.toContain("The main thing I found");
  });

  it("answers cleanup follow-ups without falling back to stale container failures", () => {
    const snapshot = baseSnapshot();
    const answer = buildDeterministicAnswer(
      snapshot,
      buildDeterministicInsights(snapshot),
      "What should I review before deleting Docker resources?"
    );

    expect(answer).toContain("dangling image");
    expect(answer).toContain("not attached to containers");
    expect(answer).not.toContain("OOM-killed");
    expect(answer).not.toContain("The main thing I found");
  });

  it("answers volume and network questions from matching snapshot sections", () => {
    const snapshot = baseSnapshot();
    const volumeAnswer = buildDeterministicAnswer(
      snapshot,
      buildDeterministicInsights(snapshot),
      "What volumes are in use?"
    );
    const networkAnswer = buildDeterministicAnswer(
      snapshot,
      buildDeterministicInsights(snapshot),
      "Which networks have containers attached?"
    );

    expect(volumeAnswer).toContain("demo_data");
    expect(volumeAnswer).not.toContain("OOM-killed");
    expect(networkAnswer).toContain("bridge");
    expect(networkAnswer).not.toContain("OOM-killed");
  });
});

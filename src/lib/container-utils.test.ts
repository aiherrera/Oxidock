import { describe, expect, it } from "vitest";
import { buildTableRows, isRunning } from "./container-utils";
import type { ContainerInfo, ContainerStatsInfo } from "../types/docker";

const makeContainer = (overrides: Partial<ContainerInfo> & { id: string; name: string }): ContainerInfo => ({
  id: overrides.id,
  shortId: overrides.id.slice(0, 12),
  name: overrides.name,
  image: "nginx:latest",
  state: overrides.state ?? "running",
  status: overrides.status ?? "Up 1 minute",
  ports: [],
  project: overrides.project ?? null,
  service: overrides.service ?? null,
  createdAt: "2024-01-01T00:00:00Z",
  command: "",
  lastStartedAt: "",
});

describe("buildTableRows", () => {
  it("groups containers by compose project", () => {
    const containers: ContainerInfo[] = [
      makeContainer({ id: "a1", name: "web", project: "demo", service: "web" }),
      makeContainer({ id: "a2", name: "api", project: "demo", service: "api" }),
      makeContainer({ id: "b1", name: "standalone" }),
    ];

    const rows = buildTableRows(containers, {
      statsById: new Map<string, ContainerStatsInfo>(),
      expandedProjects: new Set(["demo"]),
    });

    expect(rows.some((row) => row.kind === "project" && row.project === "demo")).toBe(true);
    expect(rows.filter((row) => row.kind === "container")).toHaveLength(3);
  });
});

describe("isRunning", () => {
  it("detects running state", () => {
    expect(isRunning(makeContainer({ id: "x", name: "x", state: "running" }))).toBe(true);
    expect(isRunning(makeContainer({ id: "x", name: "x", state: "exited" }))).toBe(false);
  });
});

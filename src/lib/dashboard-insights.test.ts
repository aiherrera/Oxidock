import { describe, expect, it } from "vitest";
import { buildDashboardInsights, isBuiltInNetwork, isDanglingImage } from "./dashboard-insights";
import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";

const baseContainer = (overrides: Partial<ContainerInfo>): ContainerInfo => ({
  id: "id1",
  shortId: "id1",
  name: "app",
  image: "nginx:latest",
  state: "running",
  status: "Up 1 hour",
  ports: [],
  createdAt: "2026-01-01T00:00:00Z",
  project: null,
  service: null,
  command: "nginx",
  lastStartedAt: "1 hour ago",
  ...overrides,
});

describe("dashboard-insights", () => {
  it("detects dangling and unused images", () => {
    const images: ImageInfo[] = [
      {
        id: "1",
        shortId: "1",
        repository: "<none>",
        tag: "<none>",
        size: "10MB",
        createdAt: "2026-01-01",
        containers: 0,
      },
      {
        id: "2",
        shortId: "2",
        repository: "redis",
        tag: "7",
        size: "50MB",
        createdAt: "2026-01-01",
        containers: 0,
      },
    ];

    const insights = buildDashboardInsights({
      containers: [],
      images,
      volumes: [],
      networks: [],
    });

    expect(insights.some((i) => i.id === "dangling-images")).toBe(true);
    expect(insights.some((i) => i.id === "unused-images")).toBe(true);
    expect(isDanglingImage(images[0])).toBe(true);
    expect(isDanglingImage(images[1])).toBe(false);
  });

  it("detects stopped and failed containers separately", () => {
    const insights = buildDashboardInsights({
      containers: [
        baseContainer({ name: "db", state: "exited", status: "Exited (0) 2 weeks ago" }),
        baseContainer({
          name: "api",
          state: "restarting",
          status: "Restarting (1) 10 seconds ago",
        }),
      ],
      images: [],
      volumes: [],
      networks: [],
    });

    expect(insights.some((i) => i.id === "stopped-containers")).toBe(true);
    expect(insights.some((i) => i.id === "failed-containers")).toBe(true);
  });

  it("ignores built-in empty networks but flags custom ones", () => {
    const networks: NetworkInfo[] = [
      {
        id: "1",
        shortId: "1",
        name: "bridge",
        driver: "bridge",
        scope: "local",
        attachable: false,
        internal: false,
        containerCount: 0,
      },
      {
        id: "2",
        shortId: "2",
        name: "dev-net",
        driver: "bridge",
        scope: "local",
        attachable: true,
        internal: false,
        containerCount: 0,
      },
    ];

    const insights = buildDashboardInsights({
      containers: [],
      images: [],
      volumes: [],
      networks,
    });

    expect(isBuiltInNetwork(networks[0])).toBe(true);
    expect(insights.some((i) => i.id === "empty-networks")).toBe(true);
    const emptyInsight = insights.find((i) => i.id === "empty-networks");
    expect(emptyInsight?.title).toBe("1 unused network");
  });

  it("suggests volume review when volumes exist", () => {
    const volumes: VolumeInfo[] = [
      {
        name: "data",
        driver: "local",
        mountpoint: "/var/lib/docker/volumes/data",
        scope: "local",
        labels: {},
      },
    ];

    const insights = buildDashboardInsights({
      containers: [],
      images: [],
      volumes,
      networks: [],
    });

    expect(insights.some((i) => i.id === "volume-review")).toBe(true);
  });

  it("returns no insights for a clean environment", () => {
    const insights = buildDashboardInsights({
      containers: [baseContainer({})],
      images: [
        {
          id: "1",
          shortId: "1",
          repository: "nginx",
          tag: "latest",
          size: "100MB",
          createdAt: "2026-01-01",
          containers: 1,
        },
      ],
      volumes: [],
      networks: [
        {
          id: "1",
          shortId: "1",
          name: "bridge",
          driver: "bridge",
          scope: "local",
          attachable: false,
          internal: false,
          containerCount: 2,
        },
      ],
    });

    expect(insights).toHaveLength(0);
  });
});

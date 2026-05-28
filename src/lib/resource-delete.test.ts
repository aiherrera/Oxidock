import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteSelectedResources, formatDeleteFailures, getResourceKey, isProtectedNetwork } from "./resource-delete";
import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";

vi.mock("./tauri-docker", () => ({
  removeContainer: vi.fn(),
  removeImage: vi.fn(),
  removeVolume: vi.fn(),
  removeNetwork: vi.fn(),
}));

import { removeContainer, removeImage, removeNetwork, removeVolume } from "./tauri-docker";

const container: ContainerInfo = {
  id: "container-1",
  shortId: "container-1",
  name: "web",
  image: "nginx:latest",
  state: "exited",
  status: "Exited (0) 1 hour ago",
  ports: [],
  createdAt: "2026-01-01",
  project: null,
  service: null,
  command: "nginx",
  lastStartedAt: "1 hour ago",
};

const runningContainer: ContainerInfo = {
  ...container,
  id: "container-2",
  shortId: "container-2",
  name: "api",
  state: "running",
  status: "Up 5 minutes",
};

const image: ImageInfo = {
  id: "image-1",
  shortId: "image-1",
  repository: "nginx",
  tag: "latest",
  size: "100MB",
  createdAt: "2026-01-01",
  containers: 0,
};

const inUseImage: ImageInfo = {
  ...image,
  id: "image-2",
  containers: 2,
};

const volume: VolumeInfo = {
  name: "data",
  driver: "local",
  mountpoint: "/var/lib/docker/volumes/data",
  scope: "local",
  labels: {},
};

const network: NetworkInfo = {
  id: "net-1",
  shortId: "net-1",
  name: "oxidock_default",
  driver: "bridge",
  scope: "local",
  attachable: false,
  internal: false,
  containerCount: 0,
};

const bridgeNetwork: NetworkInfo = {
  ...network,
  id: "net-bridge",
  name: "bridge",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("resource-delete", () => {
  it("maps resource keys by kind", () => {
    expect(getResourceKey({ kind: "container", item: container })).toBe("container-1");
    expect(getResourceKey({ kind: "volume", item: volume })).toBe("data");
  });

  it("identifies protected networks", () => {
    expect(isProtectedNetwork("bridge")).toBe(true);
    expect(isProtectedNetwork("oxidock_default")).toBe(false);
  });

  it("calls correct invoke helpers with force policy", async () => {
    vi.mocked(removeContainer).mockResolvedValue(undefined);
    vi.mocked(removeImage).mockResolvedValue(undefined);

    await deleteSelectedResources([
      { kind: "container", item: runningContainer },
      { kind: "image", item: inUseImage },
    ]);

    expect(removeContainer).toHaveBeenCalledWith("container-2", true);
    expect(removeImage).toHaveBeenCalledWith("image-2", true);
  });

  it("aggregates partial failures", async () => {
    vi.mocked(removeVolume).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("in use"));

    const result = await deleteSelectedResources([
      { kind: "volume", item: volume },
      { kind: "volume", item: { ...volume, name: "busy" } },
    ]);

    expect(result.deletedKeys).toEqual(["data"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.label).toBe("busy");
    expect(formatDeleteFailures(result.failures)).toContain("busy");
  });

  it("blocks protected network delete without force", async () => {
    const result = await deleteSelectedResources([{ kind: "network", item: bridgeNetwork }]);

    expect(removeNetwork).not.toHaveBeenCalled();
    expect(result.failures[0]?.message).toContain("Default Docker networks");
  });

  it("allows protected network delete when force is enabled", async () => {
    vi.mocked(removeNetwork).mockResolvedValue(undefined);

    const result = await deleteSelectedResources([{ kind: "network", item: bridgeNetwork }], { force: true });

    expect(removeNetwork).toHaveBeenCalledWith("net-bridge", true);
    expect(result.deletedKeys).toEqual(["net-bridge"]);
  });
});

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainersPage } from "./containers-page";
import type { DockerStatus } from "../types/docker";

vi.mock("../lib/tauri-docker", () => ({
  fetchContainers: vi.fn(),
  fetchContainerStats: vi.fn(),
}));

vi.mock("../lib/docker-change-events", () => ({
  useDockerContainersChanged: vi.fn(),
}));

import { fetchContainers } from "../lib/tauri-docker";

const dockerStatus: DockerStatus = {
  isRunning: true,
  engineState: "running",
  message: "Docker is running.",
  serverVersion: "27.0.0",
  apiVersion: "1.46",
  providerId: "docker",
  providerName: "Docker",
  contextName: "default",
  endpointLabel: "Default",
  lifecycleCapabilities: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ContainersPage", () => {
  it("does not load containers when Docker is not running", async () => {
    render(
      <ContainersPage
        dockerStatus={{ ...dockerStatus, isRunning: false, engineState: "stopped" }}
        engineRevision={0}
        searchQuery=""
      />
    );

    await waitFor(() => {
      expect(fetchContainers).not.toHaveBeenCalled();
    });
  });
});

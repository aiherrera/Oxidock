import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VolumesPage } from "./volumes-page";
import type { DockerStatus } from "../types/docker";

vi.mock("../lib/tauri-docker", () => ({
  fetchVolumes: vi.fn(),
  removeVolume: vi.fn(),
}));

vi.mock("../hooks/use-docker-resource-page", () => ({
  useDockerResourcePage: vi.fn(),
}));

import { useDockerResourcePage } from "../hooks/use-docker-resource-page";

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

describe("VolumesPage bulk selection", () => {
  it("shows bulk delete controls when volumes are selected", () => {
    vi.mocked(useDockerResourcePage).mockReturnValue({
      items: [
        {
          name: "data",
          driver: "local",
          mountpoint: "/var/lib/docker/volumes/data",
          scope: "local",
          labels: {},
        },
      ],
      isLoading: false,
      errorMessage: null,
      reload: vi.fn(),
    });

    render(
      <VolumesPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        searchQuery=""
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Select data/i }));
    expect(screen.getByText("1 volume selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Delete$/i })).toBeInTheDocument();
  });
});

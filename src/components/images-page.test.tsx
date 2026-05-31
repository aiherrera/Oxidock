import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImagesPage } from "./images-page";
import type { DockerStatus } from "../types/docker";

vi.mock("../lib/tauri-docker", () => ({
  fetchImages: vi.fn(),
  classifyDockerCommand: vi.fn(),
  runDockerCommand: vi.fn(),
  removeImage: vi.fn(),
}));

vi.mock("../lib/tauri-registry", () => ({
  fetchRegistries: vi.fn().mockResolvedValue([]),
  searchRegistryImages: vi.fn(),
}));

import { fetchImages } from "../lib/tauri-docker";
import { searchRegistryImages } from "../lib/tauri-registry";

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

describe("ImagesPage bulk selection", () => {
  it("shows bulk delete controls for local images", async () => {
    vi.mocked(fetchImages).mockResolvedValue([
      {
        id: "image-1",
        shortId: "image-1",
        repository: "nginx",
        tag: "latest",
        size: "100MB",
        createdAt: "2026-01-01",
        containers: 0,
      },
    ]);

    render(
      <ImagesPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        searchQuery=""
      />
    );

    expect(await screen.findByText("nginx")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Select nginx:latest/i }));
    expect(screen.getByText("1 image selected")).toBeInTheDocument();
  });

  it("shows local, registry, and command sections when a search term is active", async () => {
    vi.mocked(fetchImages).mockResolvedValue([
      {
        id: "image-1",
        shortId: "image-1",
        repository: "postgres",
        tag: "16-alpine",
        size: "371MB",
        createdAt: "2026-01-01",
        containers: 1,
      },
    ]);
    vi.mocked(searchRegistryImages).mockResolvedValue({
      results: [
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
      message: null,
    });

    render(
      <ImagesPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        searchQuery="postgres"
      />
    );

    expect(await screen.findByText("Local images")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();

    await waitFor(() => {
      expect(searchRegistryImages).toHaveBeenCalledWith("postgres", undefined);
    });

    expect(await screen.findByText("Registry images")).toBeInTheDocument();
    expect(screen.getByText("Docker Hub")).toBeInTheDocument();
  });
});

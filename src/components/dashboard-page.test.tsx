import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./dashboard-page";

vi.mock("../lib/tauri-docker", () => ({
  fetchContainers: vi.fn(),
  fetchImages: vi.fn(),
  fetchNetworks: vi.fn(),
  fetchVolumes: vi.fn(),
}));

vi.mock("../lib/docker-change-events", () => ({
  useDockerContainersChanged: vi.fn(),
}));

import { fetchContainers, fetchImages, fetchNetworks, fetchVolumes } from "../lib/tauri-docker";

const dockerStatus = {
  isRunning: true,
  engineState: "running" as const,
  message: "Connected",
  serverVersion: "27.0.0",
  apiVersion: "1.47",
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

describe("DashboardPage", () => {
  it("loads summary metrics and navigates from quick links", async () => {
    vi.mocked(fetchContainers).mockResolvedValue([
      {
        id: "abc123",
        shortId: "abc123",
        name: "web",
        image: "nginx:latest",
        state: "running",
        status: "Up 1 hour",
        ports: [],
        createdAt: "2026-01-01T00:00:00Z",
        project: null,
        service: null,
        command: "nginx",
        lastStartedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(fetchImages).mockResolvedValue([
      {
        id: "img1",
        shortId: "img1",
        repository: "nginx",
        tag: "latest",
        size: "100MB",
        createdAt: "2026-01-01",
        containers: 1,
      },
    ]);
    vi.mocked(fetchVolumes).mockResolvedValue([]);
    vi.mocked(fetchNetworks).mockResolvedValue([
      {
        id: "net1",
        shortId: "net1",
        name: "bridge",
        driver: "bridge",
        scope: "local",
        attachable: false,
        internal: false,
        containerCount: 1,
      },
    ]);

    const onNavigate = vi.fn();
    const onOpenPlayground = vi.fn();

    render(
      <DashboardPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        onNavigate={onNavigate}
        onOpenPlayground={onOpenPlayground}
      />
    );

    expect(await screen.findByText("Running containers")).toBeInTheDocument();
    expect(screen.getByText("Total containers")).toBeInTheDocument();
    expect(screen.getByText("Networks")).toBeInTheDocument();

    const statCards = screen.getAllByRole("article");
    expect(statCards).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Quick link: Containers" }));
    expect(onNavigate).toHaveBeenCalledWith("containers");
  });

  it("shows actionable insights for stopped containers and dangling images", async () => {
    vi.mocked(fetchContainers).mockResolvedValue([
      {
        id: "def456",
        shortId: "def456",
        name: "db",
        image: "postgres:16",
        state: "exited",
        status: "Exited (0) 2 weeks ago",
        ports: [],
        createdAt: "2026-01-01T00:00:00Z",
        project: null,
        service: null,
        command: "postgres",
        lastStartedAt: "2 weeks ago",
      },
    ]);
    vi.mocked(fetchImages).mockResolvedValue([
      {
        id: "img1",
        shortId: "img1",
        repository: "<none>",
        tag: "<none>",
        size: "10MB",
        createdAt: "2026-01-01",
        containers: 0,
      },
    ]);
    vi.mocked(fetchVolumes).mockResolvedValue([]);
    vi.mocked(fetchNetworks).mockResolvedValue([
      {
        id: "net1",
        shortId: "net1",
        name: "bridge",
        driver: "bridge",
        scope: "local",
        attachable: false,
        internal: false,
        containerCount: 1,
      },
    ]);

    const onNavigate = vi.fn();
    const onOpenPlayground = vi.fn();

    render(
      <DashboardPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        onNavigate={onNavigate}
        onOpenPlayground={onOpenPlayground}
      />
    );

    expect(await screen.findByText("Action needed")).toBeInTheDocument();
    expect(screen.getByText(/1 stopped container/i)).toBeInTheDocument();
    expect(screen.getByText(/1 dangling image/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /1 stopped container/i }));
    expect(onNavigate).toHaveBeenCalledWith("containers");

    fireEvent.click(screen.getByRole("button", { name: /1 dangling image/i }));
    expect(onOpenPlayground).toHaveBeenCalledWith("docker image ls --filter dangling=true");
  });

  it("does not fetch docker resources when the engine is not running", async () => {
    const onNavigate = vi.fn();
    const onOpenPlayground = vi.fn();

    render(
      <DashboardPage
        dockerStatus={{ ...dockerStatus, isRunning: false, engineState: "stopped" }}
        engineRevision={0}
        onNavigate={onNavigate}
        onOpenPlayground={onOpenPlayground}
      />
    );

    expect(await screen.findByText(/Docker is not running/i)).toBeInTheDocument();
    expect(fetchContainers).not.toHaveBeenCalled();
    expect(fetchImages).not.toHaveBeenCalled();
    expect(fetchVolumes).not.toHaveBeenCalled();
    expect(fetchNetworks).not.toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworksPage } from "./networks-page";
import type { DockerStatus } from "../types/docker";

vi.mock("../lib/tauri-docker", () => ({
  fetchNetworks: vi.fn(),
  removeNetwork: vi.fn(),
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

describe("NetworksPage bulk selection", () => {
  it("opens delete dialog for selected networks", () => {
    vi.mocked(useDockerResourcePage).mockReturnValue({
      items: [
        {
          id: "net-1",
          shortId: "net-1",
          name: "oxidock_default",
          driver: "bridge",
          scope: "local",
          attachable: false,
          internal: false,
          containerCount: 0,
        },
      ],
      isLoading: false,
      errorMessage: null,
      reload: vi.fn(),
    });

    render(
      <NetworksPage
        dockerStatus={dockerStatus}
        engineRevision={0}
        searchQuery=""
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Select oxidock_default/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete selected networks?")).toBeInTheDocument();
  });
});

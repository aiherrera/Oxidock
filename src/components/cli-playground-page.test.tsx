import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliPlaygroundPage } from "./cli-playground-page";
import type { DockerStatus } from "../types/docker";

vi.mock("../lib/tauri-docker", () => ({
  classifyDockerCommand: vi.fn(),
  runDockerCommand: vi.fn(),
}));

const loadCliPlaygroundSettings = vi.fn(() => ({
  destructiveProtectionEnabled: true,
  showRegistryHints: true,
}));

vi.mock("../lib/cli-playground-settings", () => ({
  loadCliPlaygroundSettings: () => loadCliPlaygroundSettings(),
}));

import { classifyDockerCommand, runDockerCommand } from "../lib/tauri-docker";

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

describe("CliPlaygroundPage", () => {
  it("requires confirmation before running destructive commands", async () => {
    vi.mocked(classifyDockerCommand).mockResolvedValue({
      normalized: "docker system prune -f",
      risk: "destructive",
      reasons: ["Removes unused data"],
    });
    vi.mocked(runDockerCommand).mockResolvedValue({
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    });

    render(
      <CliPlaygroundPage
        dockerStatus={dockerStatus}
        onOpenSettingsPage={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/docker ps/i), {
      target: { value: "docker system prune -f" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(runDockerCommand).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run anyway/i }));

    await waitFor(() => {
      expect(runDockerCommand).toHaveBeenCalledWith("docker system prune -f", {
        confirmDestructive: true,
      });
    });
  });

  it("runs destructive commands immediately when protection is disabled", async () => {
    loadCliPlaygroundSettings.mockReturnValue({
      destructiveProtectionEnabled: false,
      showRegistryHints: true,
    });

    vi.mocked(classifyDockerCommand).mockResolvedValue({
      normalized: "docker rm -f demo",
      risk: "destructive",
      reasons: ["Removes a container"],
    });
    vi.mocked(runDockerCommand).mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    render(
      <CliPlaygroundPage
        dockerStatus={dockerStatus}
        onOpenSettingsPage={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/docker ps/i), {
      target: { value: "docker rm -f demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(runDockerCommand).toHaveBeenCalledWith("docker rm -f demo", {
        confirmDestructive: true,
      });
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

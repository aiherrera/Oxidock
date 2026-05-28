import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliPlaygroundPage, type CliHistoryEntry } from "./cli-playground-page";
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
  it("keeps command output when the page is unmounted and rendered again", async () => {
    vi.mocked(classifyDockerCommand).mockResolvedValue({
      normalized: "docker ps -a",
      risk: "safe",
      reasons: [],
    });
    vi.mocked(runDockerCommand).mockResolvedValue({
      exitCode: 0,
      stdout: "container output",
      stderr: "",
    });

    function PersistentPlaygroundHarness() {
      const [showPlayground, setShowPlayground] = useState(true);
      const [command, setCommand] = useState("docker ps");
      const [errorMessage, setErrorMessage] = useState<string | null>(null);
      const [history, setHistory] = useState<CliHistoryEntry[]>([]);
      const [isRunning, setIsRunning] = useState(false);

      return showPlayground ? (
        <>
          <button
            type="button"
            onClick={() => setShowPlayground(false)}
          >
            Other page
          </button>
          <CliPlaygroundPage
            command={command}
            dockerStatus={dockerStatus}
            errorMessage={errorMessage}
            history={history}
            isRunning={isRunning}
            setCommand={setCommand}
            setErrorMessage={setErrorMessage}
            setHistory={setHistory}
            setIsRunning={setIsRunning}
            onOpenSettingsPage={vi.fn()}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowPlayground(true)}
        >
          CLI page
        </button>
      );
    }

    render(<PersistentPlaygroundHarness />);

    fireEvent.change(screen.getByPlaceholderText(/docker ps/i), {
      target: { value: "docker ps -a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("container output")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Other page" }));
    fireEvent.click(screen.getByRole("button", { name: "CLI page" }));

    expect(screen.getByText("container output")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear output/i }));

    expect(screen.queryByText("container output")).toBeNull();
    expect(screen.getByText("Run a command to see stdout and stderr here.")).toBeInTheDocument();
  });

  it("requires typed confirmation before running destructive commands (fallback phrase)", async () => {
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

    const runAnyway = screen.getByRole("button", { name: /run anyway/i });
    expect(runAnyway).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Oxidock"), { target: { value: "wrong" } });
    expect(runAnyway).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Oxidock"), { target: { value: "Oxidock" } });
    expect(runAnyway).toBeEnabled();
    fireEvent.click(runAnyway);

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

  it("requires the compose project name when detected", async () => {
    loadCliPlaygroundSettings.mockReturnValue({
      destructiveProtectionEnabled: true,
      showRegistryHints: true,
    });

    vi.mocked(classifyDockerCommand).mockResolvedValue({
      normalized: "docker compose -p gen-bench down -v",
      risk: "destructive",
      reasons: ["Stops and removes project containers", "Volume flags may delete named volumes and their data."],
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
      target: { value: "docker compose -p gen-bench down -v" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(runDockerCommand).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    const runAnyway = screen.getByRole("button", { name: /run anyway/i });
    expect(runAnyway).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("gen-bench"), { target: { value: "Oxidock" } });
    expect(runAnyway).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("gen-bench"), { target: { value: "gen-bench" } });
    expect(runAnyway).toBeEnabled();
    fireEvent.click(runAnyway);

    await waitFor(() => {
      expect(runDockerCommand).toHaveBeenCalledWith("docker compose -p gen-bench down -v", {
        confirmDestructive: true,
      });
    });
  });
});

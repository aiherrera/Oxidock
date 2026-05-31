import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CliAiAssistantCard } from "./cli-ai-assistant-card";
import { AI_ASSISTANT_INSTALL_STATUS_EVENT, type LocalAiAssistantStatus } from "../lib/local-ai-assistant";

const unlistenMock = vi.fn();
let installStatusHandler: ((event: { payload: LocalAiAssistantStatus }) => void) | undefined;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: (event: { payload: LocalAiAssistantStatus }) => void) => {
    if (eventName === AI_ASSISTANT_INSTALL_STATUS_EVENT) {
      installStatusHandler = handler;
    }
    return unlistenMock;
  }),
}));

vi.mock("../lib/local-ai-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/local-ai-assistant")>();
  return {
    ...actual,
    getLocalAiAssistantStatus: vi.fn(),
    installLocalAiAssistant: vi.fn(),
    uninstallLocalAiAssistant: vi.fn(),
  };
});

import { getLocalAiAssistantStatus, installLocalAiAssistant } from "../lib/local-ai-assistant";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  installStatusHandler = undefined;
});

describe("CliAiAssistantCard", () => {
  beforeEach(() => {
    vi.mocked(getLocalAiAssistantStatus).mockResolvedValue({
      state: "notInstalled",
      modelName: "oxidock-assist",
      modelSizeLabel: "~1.9 GB",
      message: null,
      progress: null,
    });
  });

  it("shows download progress while installing", async () => {
    let resolveInstall: ((value: LocalAiAssistantStatus) => void) | undefined;
    vi.mocked(installLocalAiAssistant).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInstall = resolve;
        })
    );

    render(<CliAiAssistantCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install assistant/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /install assistant/i }));

    await waitFor(() => {
      expect(installStatusHandler).toBeDefined();
    });

    installStatusHandler?.({
      payload: {
        state: "installing",
        modelName: "oxidock-assist",
        modelSizeLabel: "~1.9 GB",
        message: "Downloading assistant model…",
        progress: {
          downloadedBytes: 50 * 1024 * 1024,
          totalBytes: 100 * 1024 * 1024,
          percent: 50,
        },
      },
    });

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/50\.00MB of 100\.00MB \(50%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/verify checksum/i)).toBeInTheDocument();

    resolveInstall?.({
      state: "installed",
      modelName: "oxidock-assist",
      modelSizeLabel: "~1.9 GB",
      message: "Local assistant model is installed.",
      progress: null,
    });

    expect(await screen.findByText(/assistant enabled/i)).toBeInTheDocument();
  });

  it("shows backend error message when install fails", async () => {
    vi.mocked(installLocalAiAssistant).mockRejectedValue("Downloaded model checksum mismatch.");

    render(<CliAiAssistantCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install assistant/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /install assistant/i }));

    expect(await screen.findByText(/checksum mismatch/i)).toBeInTheDocument();
    expect(screen.queryByText(/try again later/i)).not.toBeInTheDocument();
  });

  it("unsubscribes from install events when install completes", async () => {
    vi.mocked(installLocalAiAssistant).mockResolvedValue({
      state: "installed",
      modelName: "oxidock-assist",
      modelSizeLabel: "~1.9 GB",
      message: "Local assistant model is installed.",
      progress: null,
    });

    render(<CliAiAssistantCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install assistant/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /install assistant/i }));

    await waitFor(() => {
      expect(unlistenMock).toHaveBeenCalled();
    });
  });
});

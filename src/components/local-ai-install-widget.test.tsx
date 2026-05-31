import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalAiInstallWidget } from "./local-ai-install-widget";
import type { LocalAiAssistantStatus } from "../lib/local-ai-assistant";

let statusHandler: ((status: LocalAiAssistantStatus) => void) | undefined;
const unlistenMock = vi.fn();

vi.mock("../lib/local-ai-assistant", () => ({
  getLocalAiAssistantStatus: vi.fn(),
  listenLocalAiAssistantInstallStatus: vi.fn(async (handler: (status: LocalAiAssistantStatus) => void) => {
    statusHandler = handler;
    return unlistenMock;
  }),
}));

import { getLocalAiAssistantStatus } from "../lib/local-ai-assistant";

const installingStatus: LocalAiAssistantStatus = {
  state: "installing",
  modelName: "oxidock-assist",
  modelSizeLabel: "~1.9 GB",
  message: "Downloading assistant model…",
  progress: {
    downloadedBytes: 50 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024,
    percent: 50,
  },
};

const installedStatus: LocalAiAssistantStatus = {
  state: "installed",
  modelName: "oxidock-assist",
  modelSizeLabel: "~1.9 GB",
  message: "Local assistant model is installed.",
  progress: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  statusHandler = undefined;
});

describe("LocalAiInstallWidget", () => {
  beforeEach(() => {
    vi.mocked(getLocalAiAssistantStatus).mockResolvedValue({
      state: "notInstalled",
      modelName: "oxidock-assist",
      modelSizeLabel: "~1.9 GB",
      message: null,
      progress: null,
    });
  });

  it("shows floating install progress from the background installer", async () => {
    vi.mocked(getLocalAiAssistantStatus).mockResolvedValue(installingStatus);

    render(<LocalAiInstallWidget onOpenAssistant={vi.fn()} />);

    expect(await screen.findByRole("status", { name: /assistant install progress/i })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /assistant model download progress/i })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByText(/50\.00MB of 100\.00MB/i)).toBeInTheDocument();
  });

  it("shows a ready notification and opens the assistant when install completes", async () => {
    const onOpenAssistant = vi.fn();

    render(<LocalAiInstallWidget onOpenAssistant={onOpenAssistant} />);

    await waitFor(() => {
      expect(statusHandler).toBeDefined();
    });

    statusHandler?.(installingStatus);
    expect(await screen.findByRole("status", { name: /assistant install progress/i })).toBeInTheDocument();

    statusHandler?.(installedStatus);

    expect(await screen.findByRole("status", { name: /assistant ready/i })).toHaveTextContent(
      /local ai assistant is ready/i
    );
    fireEvent.click(screen.getByRole("button", { name: /open ai assistant/i }));

    expect(onOpenAssistant).toHaveBeenCalledTimes(1);
  });

  it("does not show a ready notification for an already installed model on app startup", async () => {
    vi.mocked(getLocalAiAssistantStatus).mockResolvedValue(installedStatus);

    render(<LocalAiInstallWidget onOpenAssistant={vi.fn()} />);

    await waitFor(() => {
      expect(getLocalAiAssistantStatus).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status", { name: /assistant ready/i })).not.toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPage } from "./assistant-page";
import { ASSISTANT_CHAT_HISTORY_KEY, loadAssistantChatHistory } from "../lib/assistant-history";

vi.mock("@/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div data-testid="conversation">{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationEmptyState: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  ConversationScrollButton: () => null,
}));

vi.mock("../lib/local-ai-assistant", () => ({
  defaultLocalAiAssistantStatus: {
    state: "notInstalled",
    modelName: "oxidock-assist",
    modelSizeLabel: "~380 MB",
    message: null,
    progress: null,
  },
  getLocalAiAssistantStatus: vi.fn().mockResolvedValue({
    state: "notInstalled",
    modelName: "oxidock-assist",
    modelSizeLabel: "~380 MB",
    message: null,
    progress: null,
  }),
  getInvokeErrorMessage: vi.fn((error: unknown, fallback: string) => (typeof error === "string" ? error : fallback)),
  installLocalAiAssistant: vi.fn().mockResolvedValue({
    state: "installed",
    modelName: "oxidock-assist",
    modelSizeLabel: "~380 MB",
    message: "Local assistant model is installed.",
    progress: null,
  }),
  listenLocalAiAssistantInstallStatus: vi.fn().mockResolvedValue(() => undefined),
  uninstallLocalAiAssistant: vi.fn(),
}));

vi.mock("../lib/app-insights-assistant", () => ({
  askAppInsightsAssistant: vi.fn().mockResolvedValue({
    answer: "postgres is using the most memory right now.",
    reasoning: "- postgres has the highest memory usage",
    sources: [],
    suggestedCommands: [],
    stackTraces: [],
    usedModel: false,
  }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("AssistantPage", () => {
  it("renders offline assistant shell and quick prompts", async () => {
    render(
      <AssistantPage
        dockerStatus={{
          isRunning: true,
          engineState: "running",
          message: "Docker is reachable.",
          serverVersion: "27.0.0",
          apiVersion: "1.47",
          providerId: null,
          providerName: "Docker",
          contextName: null,
          endpointLabel: "Default",
          lifecycleCapabilities: [],
        }}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    expect(await screen.findByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("100% offline")).toBeInTheDocument();
    expect(screen.getByText("Why is my postgres container restarting?")).toBeInTheDocument();
  });

  it("hides the install card after the assistant model installs", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /install assistant/i }));

    await waitFor(() => {
      expect(screen.queryByText("Local AI assistant")).not.toBeInTheDocument();
    });
  });

  it("restores persisted chat turns", async () => {
    window.localStorage.setItem(
      ASSISTANT_CHAT_HISTORY_KEY,
      JSON.stringify([
        { id: "user-1", role: "user", content: "Which containers use the most memory?" },
        { id: "assistant-1", role: "assistant", content: "postgres is using the most memory right now." },
      ])
    );

    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Which containers use the most memory?").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("postgres is using the most memory right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear chat/i })).toBeInTheDocument();
  });

  it("persists new chat turns and clears them on request", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("Which containers use the most memory?"));

    expect(await screen.findByText("postgres is using the most memory right now.")).toBeInTheDocument();
    expect(loadAssistantChatHistory().map((turn) => turn.role)).toEqual(["user", "assistant"]);

    fireEvent.click(screen.getByRole("button", { name: /clear chat/i }));

    await waitFor(() => {
      expect(screen.queryByText("postgres is using the most memory right now.")).not.toBeInTheDocument();
    });
    expect(loadAssistantChatHistory()).toEqual([]);
  });

  it("replaces suggestions with related follow-ups after a suggestion is selected", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("Which containers use the most memory?"));

    expect(await screen.findByText("Which running containers are close to their memory limit?")).toBeInTheDocument();
    expect(screen.queryByText("Why is my postgres container restarting?")).not.toBeInTheDocument();
  });

  it("regenerates suggestions from typed questions", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    fireEvent.change(input, { target: { value: "Why did the api container restart?" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Which containers are failing or restarting right now?")).toBeInTheDocument();
    expect(screen.getByText("Show me the logs for the most suspicious container")).toBeInTheDocument();
  });
});

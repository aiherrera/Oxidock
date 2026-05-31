import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPage } from "./assistant-page";
import { askAppInsightsAssistant } from "../lib/app-insights-assistant";
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

vi.mock("./ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div role="tooltip">{children}</div>,
}));

vi.mock("../lib/local-ai-assistant", () => ({
  defaultLocalAiAssistantStatus: {
    state: "notInstalled",
    modelName: "oxidock-assist",
    modelSizeLabel: "~1.9 GB",
    message: null,
    progress: null,
  },
  getLocalAiAssistantStatus: vi.fn().mockResolvedValue({
    state: "notInstalled",
    modelName: "oxidock-assist",
    modelSizeLabel: "~1.9 GB",
    message: null,
    progress: null,
  }),
  getInvokeErrorMessage: vi.fn((error: unknown, fallback: string) => (typeof error === "string" ? error : fallback)),
  installLocalAiAssistant: vi.fn().mockResolvedValue({
    state: "installed",
    modelName: "oxidock-assist",
    modelSizeLabel: "~1.9 GB",
    message: "Local assistant model is installed.",
    progress: null,
  }),
  listenLocalAiAssistantInstallStatus: vi.fn().mockResolvedValue(() => undefined),
  uninstallLocalAiAssistant: vi.fn(),
}));

vi.mock("../lib/app-insights-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/app-insights-assistant")>();
  return {
    ...actual,
    askAppInsightsAssistant: vi.fn().mockResolvedValue({
      answer: "postgres is using the most memory right now.",
      reasoning: "- postgres has the highest memory usage",
      sources: [],
      suggestedCommands: [],
      stackTraces: [],
      usedModel: false,
    }),
  };
});

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

    expect(await screen.findByRole("heading", { level: 1, name: /AI Assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Assistant privacy details/i })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "100% offline · No telemetry · Context is built from your local Docker state and Oxidock docs. The assistant suggests commands but never runs them automatically."
    );
    const quickPrompt = screen.getByText("Why is my postgres container restarting?");
    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    expect(quickPrompt.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("turns long pasted text into a removable attachment chip", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    const longPaste = "x".repeat(500);

    fireEvent.paste(input, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? longPaste : ""),
        items: [],
      },
    });

    expect(await screen.findByText(/Pasted text \(500 chars\)/i)).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
  });

  it("renders submitted long pasted text as an attachment chip instead of raw message text", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    const longPaste = "x".repeat(500);

    fireEvent.change(input, { target: { value: "Summarize this log" } });
    fireEvent.paste(input, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? longPaste : ""),
        items: [],
      },
    });
    expect(await screen.findByText(/Pasted text \(500 chars\)/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText("Summarize this log")).toBeInTheDocument();
    expect(screen.getAllByText(/Pasted text \(500 chars\)/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(longPaste)).not.toBeInTheDocument();
    expect(await screen.findByText("postgres is using the most memory right now.")).toBeInTheDocument();
  });

  it("asks for instructions instead of analyzing Docker state for attachment-only pasted text", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    const readmePaste = [
      "# Oxidock",
      "A desktop Docker manager for containers, images, volumes, and networks.",
      "## Features",
      "- Review images and containers",
      "x".repeat(500),
    ].join("\n");

    fireEvent.paste(input, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? readmePaste : ""),
        items: [],
      },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText(/Add a short question or instruction/i)).toBeInTheDocument();
    expect(screen.queryByText(/dangling image layer/i)).not.toBeInTheDocument();
  });

  it("combines pending pasted context with the next user question", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    const readmePaste = ["# Oxidock", "A desktop Docker manager.", "x".repeat(500)].join("\n");

    fireEvent.paste(input, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? readmePaste : ""),
        items: [],
      },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await screen.findByText(/Add a short question or instruction/i);
    fireEvent.change(input, { target: { value: "Summarize this README" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(vi.mocked(askAppInsightsAssistant)).toHaveBeenLastCalledWith(
        expect.objectContaining({
          question: expect.stringContaining("Summarize this README"),
        })
      );
    });
    expect(vi.mocked(askAppInsightsAssistant).mock.lastCall?.[0].question).toContain("# Oxidock");
    expect(vi.mocked(askAppInsightsAssistant).mock.lastCall?.[0].question).toContain("Pasted text");
    expect(await screen.findByText("Summarize this README")).toBeInTheDocument();
    expect(screen.getAllByText(/Pasted text/i).length).toBeGreaterThan(0);
  });

  it("passes previous chat turns as context for future assistant requests", async () => {
    render(
      <AssistantPage
        dockerStatus={null}
        onOpenPlayground={vi.fn()}
        onOpenSettingsPage={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask about containers, images, volumes, docs…");
    fireEvent.change(input, { target: { value: "Which containers use the most memory?" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText("postgres is using the most memory right now.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "What should I inspect next?" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(vi.mocked(askAppInsightsAssistant)).toHaveBeenLastCalledWith(
        expect.objectContaining({
          question: "What should I inspect next?",
          conversationContext: expect.stringContaining("Which containers use the most memory?"),
        })
      );
    });
    expect(vi.mocked(askAppInsightsAssistant).mock.lastCall?.[0].conversationContext).toContain(
      "postgres is using the most memory right now."
    );
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

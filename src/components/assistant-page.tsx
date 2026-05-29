import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  StackTrace,
  StackTraceContent,
  StackTraceCopyButton,
  StackTraceError,
  StackTraceErrorMessage,
  StackTraceErrorType,
  StackTraceExpandButton,
  StackTraceFrames,
  StackTraceHeader,
} from "@/components/ai-elements/stack-trace";
import { PageShell } from "./page-shell";
import { CliAiAssistantCard } from "./cli-ai-assistant-card";
import {
  askAppInsightsAssistant,
  type AppInsightsResponse,
  type AppInsightsSource,
} from "../lib/app-insights-assistant";
import {
  clearAssistantChatHistory,
  loadAssistantChatHistory,
  saveAssistantChatHistory,
  type AssistantChatTurn,
} from "../lib/assistant-history";
import { buildAssistantSuggestions } from "../lib/assistant-suggestions";
import {
  defaultLocalAiAssistantStatus,
  getLocalAiAssistantStatus,
  type LocalAiAssistantStatus,
} from "../lib/local-ai-assistant";
import { alertInfo, statusBadgeLocal } from "../lib/theme-classes";
import type { DockerStatus } from "../types/docker";

type AssistantPageProps = {
  dockerStatus: DockerStatus | null;
  onOpenPlayground: (command: string) => void;
  onOpenSettingsPage: () => void;
};

const sourceKindLabel: Record<AppInsightsSource["kind"], string> = {
  container: "Container",
  image: "Image",
  volume: "Volume",
  network: "Network",
  event: "Events",
  doc: "Docs",
  engine: "Engine",
};

const getLatestUserQuestion = (turns: AssistantChatTurn[]): string | null => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.role === "user") {
      return turn.content;
    }
  }

  return null;
};

const loadInitialAssistantState = () => {
  const turns = loadAssistantChatHistory();
  return {
    turns,
    suggestions: buildAssistantSuggestions(getLatestUserQuestion(turns)),
  };
};

export function AssistantPage({ dockerStatus, onOpenPlayground, onOpenSettingsPage }: AssistantPageProps) {
  const [initialState] = useState(loadInitialAssistantState);
  const [turns, setTurns] = useState<AssistantChatTurn[]>(initialState.turns);
  const [suggestions, setSuggestions] = useState<string[]>(initialState.suggestions);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<LocalAiAssistantStatus>(defaultLocalAiAssistantStatus);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void getLocalAiAssistantStatus()
      .then((status) => setModelStatus(status))
      .catch(() => setModelStatus(defaultLocalAiAssistantStatus));

    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    saveAssistantChatHistory(turns);
  }, [turns]);

  const handleClearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearAssistantChatHistory();
    setTurns([]);
    setSuggestions(buildAssistantSuggestions(null));
    setErrorMessage(null);
    setIsLoading(false);
  }, []);

  const submitQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) {
        return;
      }

      setSuggestions(buildAssistantSuggestions(trimmed));
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userTurn: AssistantChatTurn = {
        id: nanoid(),
        role: "user",
        content: trimmed,
      };

      setTurns((current) => [...current, userTurn]);
      setDraft("");
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await askAppInsightsAssistant({
          question: trimmed,
          dockerStatus,
          signal: controller.signal,
        });

        setTurns((current) => [
          ...current,
          {
            id: nanoid(),
            role: "assistant",
            content: response.answer,
            response,
          },
        ]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Assistant request failed.");
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
          abortRef.current = null;
        }
      }
    },
    [dockerStatus, isLoading]
  );

  const renderAssistantExtras = (response: AppInsightsResponse) => (
    <div className="mt-3 space-y-3">
      {response.reasoning ? (
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>{response.reasoning}</ReasoningContent>
        </Reasoning>
      ) : null}

      {response.sources.length > 0 ? (
        <Sources>
          <SourcesTrigger count={response.sources.length} />
          <SourcesContent>
            {response.sources.map((source) => (
              <span
                key={source.id}
                className="flex flex-col gap-0.5 rounded-md border border-(--border) bg-(--surface-elevated) px-2 py-1.5"
              >
                <span className="text-[0.65rem] uppercase tracking-wide text-(--text-muted)">
                  {sourceKindLabel[source.kind]}
                </span>
                <span className="text-xs font-medium text-(--text-primary)">{source.label}</span>
                {source.detail ? <span className="text-xs text-(--text-muted)">{source.detail}</span> : null}
              </span>
            ))}
          </SourcesContent>
        </Sources>
      ) : null}

      {response.suggestedCommands.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-(--text-muted)">
            Suggested commands
          </p>
          <div className="flex flex-wrap gap-2">
            {response.suggestedCommands.map((item) => (
              <button
                key={item.command}
                className="rounded-lg border border-(--accent)/30 bg-(--accent-soft) px-3 py-2 text-left text-xs transition hover:border-(--accent)"
                type="button"
                onClick={() => onOpenPlayground(item.command)}
              >
                <span className="block font-medium text-(--text-primary)">{item.label}</span>
                <code className="mt-1 block font-mono text-[0.7rem] text-(--accent)">{item.command}</code>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {response.stackTraces.map((trace) => (
        <StackTrace
          key={`${trace.title}-${trace.content.slice(0, 24)}`}
          className="border-(--border) bg-(--surface)"
          trace={trace.content}
        >
          <StackTraceHeader className="flex items-center justify-between gap-2 px-3 py-2">
            <StackTraceError>
              <StackTraceErrorType />
              <StackTraceErrorMessage>{trace.title}</StackTraceErrorMessage>
            </StackTraceError>
            <div className="flex items-center gap-1">
              <StackTraceCopyButton />
              <StackTraceExpandButton />
            </div>
          </StackTraceHeader>
          <StackTraceContent>
            <StackTraceFrames />
          </StackTraceContent>
        </StackTrace>
      ))}

      {response.usedModel ? (
        <p className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] ${statusBadgeLocal}`}>
          Local model · offline
        </p>
      ) : (
        <p className="text-xs text-(--text-muted)">
          Rule-based analysis
          {modelStatus.state !== "installed" ? (
            <>
              {" "}
              —{" "}
              <button
                className="font-medium text-(--accent) hover:text-(--accent-hover)"
                type="button"
                onClick={onOpenSettingsPage}
              >
                install the optional model
              </button>{" "}
              for richer answers.
            </>
          ) : null}
        </p>
      )}
    </div>
  );

  return (
    <PageShell
      description="Ask about containers, images, volumes, networks, events, and built-in docs. Answers stay on your machine."
      errorMessage={errorMessage}
      isLoading={false}
      title="Assistant"
      footerStatusLabel={
        dockerStatus?.isRunning
          ? `${dockerStatus.providerName} connected`
          : (dockerStatus?.message ?? "Engine unavailable")
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-(--border) px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-xs leading-5 ${alertInfo}`}>
              <span className="font-semibold">100% offline</span> · No telemetry · Context is built from your local
              Docker state and Oxidock docs. The assistant suggests commands but never runs them automatically.
            </p>
            {turns.length > 0 ? (
              <button
                className="inline-flex min-h-8 items-center rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
                disabled={isLoading}
                type="button"
                onClick={handleClearChat}
              >
                Clear chat
              </button>
            ) : null}
          </div>
          {modelStatus.state !== "installed" ? (
            <div className="mt-3 max-w-xl">
              <CliAiAssistantCard onStatusChange={setModelStatus} />
            </div>
          ) : null}
        </div>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent>
            {turns.length === 0 ? (
              <ConversationEmptyState
                description="Try a quick prompt below or ask about a specific container."
                title="Local app insights"
              >
                <Suggestions className="mt-4 justify-center">
                  {suggestions.map((prompt) => (
                    <Suggestion
                      key={prompt}
                      suggestion={prompt}
                      onClick={(value) => void submitQuestion(value)}
                    />
                  ))}
                </Suggestions>
              </ConversationEmptyState>
            ) : (
              turns.map((turn) => (
                <Message
                  from={turn.role}
                  key={turn.id}
                >
                  <MessageContent>
                    {turn.role === "assistant" ? (
                      <>
                        <MessageResponse>{turn.content}</MessageResponse>
                        {turn.response ? renderAssistantExtras(turn.response) : null}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{turn.content}</p>
                    )}
                  </MessageContent>
                </Message>
              ))
            )}

            {isLoading ? (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer className="text-sm text-(--text-muted)">Analyzing your Docker environment…</Shimmer>
                </MessageContent>
              </Message>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-(--border) p-4 sm:p-6">
          {turns.length > 0 ? (
            <Suggestions className="mb-3">
              {suggestions.map((prompt) => (
                <Suggestion
                  key={prompt}
                  disabled={isLoading}
                  suggestion={prompt}
                  onClick={(value) => void submitQuestion(value)}
                />
              ))}
            </Suggestions>
          ) : null}

          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              void submitQuestion(draft);
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                disabled={isLoading}
                placeholder="Ask about containers, images, volumes, docs…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit
                disabled={isLoading || !draft.trim()}
                status={isLoading ? "submitted" : "ready"}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </PageShell>
  );
}

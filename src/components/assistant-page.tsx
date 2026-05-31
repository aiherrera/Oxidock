import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { nanoid } from "nanoid";
import {
  Attachment,
  type AttachmentData,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  usePromptInputController,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  askAppInsightsAssistant,
  resolveAssistantRequest,
  type AppInsightsResponse,
  type AppInsightsSource,
} from "../lib/app-insights-assistant";
import {
  clearAssistantChatHistory,
  loadAssistantChatHistory,
  saveAssistantChatHistory,
  type AssistantChatAttachment,
  type AssistantChatTurn,
} from "../lib/assistant-history";
import { OXIDOCK_ASSISTANT_CLARIFY_MESSAGE } from "../lib/assistant-context";
import { classifyAssistantIntent } from "../lib/assistant-intent";
import { buildAssistantSuggestions } from "../lib/assistant-suggestions";
import {
  defaultLocalAiAssistantStatus,
  getLocalAiAssistantStatus,
  type LocalAiAssistantStatus,
} from "../lib/local-ai-assistant";
import {
  ASSISTANT_LONG_PASTE_CHAR_THRESHOLD,
  buildAssistantQuestionFromMessage,
  getAssistantPromptAttachmentSummaries,
} from "../lib/assistant-prompt-message";
import { statusBadgeLocal } from "../lib/theme-classes";
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

const assistantPrivacyTooltip =
  "100% offline · No telemetry · Context is built from your local Docker state and Oxidock docs. The assistant suggests commands but never runs them automatically.";

const attachmentOnlyPromptMessage = OXIDOCK_ASSISTANT_CLARIFY_MESSAGE;

const VAGUE_FOLLOWUP_PATTERN =
  /^(what about (this|that|it)|tell me more|explain (this|that|it)|and (this|that)|how about (this|that)|can you (summarize|explain) (this|that|it))\??$/i;

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

type AssistantPromptComposerProps = {
  isLoading: boolean;
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

type PendingPromptContext = {
  text: string;
  attachments: AssistantChatAttachment[];
};

const MAX_CONVERSATION_CONTEXT_TURNS = 12;
const MAX_CONVERSATION_CONTEXT_LENGTH = 12_000;

const buildConversationContext = (turns: AssistantChatTurn[]): string | undefined => {
  const context = turns
    .slice(-MAX_CONVERSATION_CONTEXT_TURNS)
    .map((turn) => {
      const label = turn.role === "user" ? "User" : "Assistant";
      const attachmentLabels = turn.attachments?.map((attachment) => `[${attachment.label}]`).join(" ");
      const content = [turn.content, attachmentLabels, turn.context].filter(Boolean).join("\n");
      return content ? `${label}:\n${content}` : null;
    })
    .filter((entry): entry is string => entry != null)
    .join("\n\n");

  if (!context) {
    return undefined;
  }

  return context.length > MAX_CONVERSATION_CONTEXT_LENGTH
    ? context.slice(context.length - MAX_CONVERSATION_CONTEXT_LENGTH)
    : context;
};

type PromptAttachmentItemProps = {
  attachment: AttachmentData;
  onRemove?: (id: string) => void;
};

const PromptAttachmentItem = memo(({ attachment, onRemove }: PromptAttachmentItemProps) => {
  const handleRemove = useCallback(() => onRemove?.(attachment.id), [onRemove, attachment.id]);

  return (
    <Attachment
      data={attachment}
      onRemove={onRemove ? handleRemove : undefined}
    >
      <AttachmentPreview />
      <AttachmentInfo />
      {onRemove ? <AttachmentRemove /> : null}
    </Attachment>
  );
});

PromptAttachmentItem.displayName = "PromptAttachmentItem";

const AssistantPromptAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback((id: string) => attachments.remove(id), [attachments]);

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments
      className="px-1 pt-2"
      variant="inline"
    >
      {attachments.files.map((attachment) => (
        <PromptAttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

const toAttachmentData = (attachment: AssistantChatAttachment): AttachmentData => ({
  id: attachment.id,
  filename: attachment.label,
  mediaType: attachment.mediaType ?? "text/plain",
  type: "file",
  url: "",
});

const UserMessageContent = ({ turn }: { turn: AssistantChatTurn }) => (
  <div className="space-y-2">
    {turn.content ? <p className="whitespace-pre-wrap">{turn.content}</p> : null}
    {turn.attachments && turn.attachments.length > 0 ? (
      <Attachments variant="inline">
        {turn.attachments.map((attachment) => (
          <PromptAttachmentItem
            attachment={toAttachmentData(attachment)}
            key={attachment.id}
          />
        ))}
      </Attachments>
    ) : null}
  </div>
);

function AssistantPromptComposer({ isLoading, onSubmit }: AssistantPromptComposerProps) {
  const { textInput } = usePromptInputController();
  const promptAttachments = usePromptInputAttachments();
  const hasText = textInput.value.trim().length > 0;
  const hasAttachments = promptAttachments.files.length > 0;
  const canSubmit = hasText || hasAttachments;

  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface-elevated) shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-(--border)/70 **:data-[slot=input-group]:border-0 **:data-[slot=input-group]:bg-transparent **:data-[slot=input-group]:shadow-none **:data-[slot=input-group]:ring-0">
      <PromptInput
        className="w-full"
        onSubmit={onSubmit}
      >
        <PromptInputHeader className="px-3 pb-0">
          <AssistantPromptAttachmentsDisplay />
        </PromptInputHeader>
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-20 px-4 pt-4 text-sm leading-6 text-(--text-primary) placeholder:text-(--text-muted)"
            disabled={isLoading}
            longPasteCharThreshold={ASSISTANT_LONG_PASTE_CHAR_THRESHOLD}
            placeholder="Ask about containers, images, volumes, docs…"
          />
        </PromptInputBody>
        <PromptInputFooter className="gap-3 px-3 pb-3 pt-1">
          <p className="hidden min-w-0 text-xs leading-5 text-(--text-muted) sm:block">
            <kbd className="rounded border border-(--border) bg-(--surface) px-1.5 py-0.5 font-mono text-[0.65rem] text-(--text-secondary)">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border border-(--border) bg-(--surface) px-1.5 py-0.5 font-mono text-[0.65rem] text-(--text-secondary)">
              Shift+Enter
            </kbd>{" "}
            for a new line
            {hasAttachments ? <> · long paste becomes a removable context chip</> : null}
          </p>
          <PromptInputSubmit
            className="ml-auto size-9 shrink-0 rounded-lg bg-(--accent) text-white shadow-sm hover:bg-(--accent-hover) disabled:opacity-50"
            disabled={isLoading || !canSubmit}
            status={isLoading ? "submitted" : "ready"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export function AssistantPage({ dockerStatus, onOpenPlayground, onOpenSettingsPage }: AssistantPageProps) {
  const [initialState] = useState(loadInitialAssistantState);
  const [turns, setTurns] = useState<AssistantChatTurn[]>(initialState.turns);
  const [suggestions, setSuggestions] = useState<string[]>(initialState.suggestions);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<LocalAiAssistantStatus>(defaultLocalAiAssistantStatus);
  const [pendingContext, setPendingContext] = useState<PendingPromptContext | null>(null);
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
    setPendingContext(null);
    setIsLoading(false);
  }, []);

  const submitQuestion = useCallback(
    async (
      question: string,
      displayContent = question,
      attachments: AssistantChatAttachment[] = [],
      options?: { pastedContext?: string }
    ) => {
      const trimmed = question.trim();
      const pastedContext = options?.pastedContext?.trim();
      if ((!trimmed && !pastedContext) || isLoading) {
        return;
      }
      const trimmedDisplayContent = displayContent.trim();
      const conversationContext = buildConversationContext(turns);
      const resolved = resolveAssistantRequest({
        question: trimmed || pastedContext || "",
        currentRequest: trimmedDisplayContent,
        pastedContext,
        conversationContext,
      });

      if (resolved.intent === "clarify") {
        const userTurn: AssistantChatTurn = {
          id: nanoid(),
          role: "user",
          content: trimmedDisplayContent,
        };
        if (attachments.length > 0) {
          userTurn.attachments = attachments;
        }
        if (pastedContext && pastedContext !== trimmedDisplayContent) {
          userTurn.context = pastedContext;
        }

        setTurns((current) => [
          ...current,
          userTurn,
          {
            id: nanoid(),
            role: "assistant",
            content: attachmentOnlyPromptMessage,
          },
        ]);
        setSuggestions(buildAssistantSuggestions(null));
        setErrorMessage(null);
        return;
      }

      setSuggestions(buildAssistantSuggestions(trimmedDisplayContent || trimmed));
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userTurn: AssistantChatTurn = {
        id: nanoid(),
        role: "user",
        content: trimmedDisplayContent,
      };
      if (trimmed !== trimmedDisplayContent || pastedContext) {
        userTurn.context = trimmed;
      }
      if (attachments.length > 0) {
        userTurn.attachments = attachments;
      }

      setTurns((current) => [...current, userTurn]);
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await askAppInsightsAssistant({
          question: trimmed,
          currentRequest: trimmedDisplayContent,
          pastedContext,
          conversationContext,
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
    [dockerStatus, isLoading, turns]
  );

  const handlePromptSubmit = useCallback(
    async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const attachmentSummaries = getAssistantPromptAttachmentSummaries(message);
      const promptText = message.text.trim();
      const contextText = await buildAssistantQuestionFromMessage(message);
      if (!promptText && attachmentSummaries.length > 0) {
        const nextPendingContext = {
          text: [pendingContext?.text, contextText].filter(Boolean).join("\n\n"),
          attachments: [...(pendingContext?.attachments ?? []), ...attachmentSummaries],
        };
        setPendingContext(nextPendingContext);
        setTurns((current) => [
          ...current,
          {
            id: nanoid(),
            role: "user",
            content: "",
            attachments: attachmentSummaries,
          },
          {
            id: nanoid(),
            role: "assistant",
            content: attachmentOnlyPromptMessage,
          },
        ]);
        setSuggestions(buildAssistantSuggestions(null));
        setErrorMessage(null);
        return;
      }

      const currentAttachmentContext =
        promptText && contextText.startsWith(promptText) ? contextText.slice(promptText.length).trim() : contextText;
      const mergedPastedContext = [pendingContext?.text, currentAttachmentContext].filter(Boolean).join("\n\n");
      const conversationContext = buildConversationContext(turns);
      const isVagueFollowUp = VAGUE_FOLLOWUP_PATTERN.test(promptText);
      const hasPriorContext = Boolean(pendingContext?.text || conversationContext?.trim());

      if (isVagueFollowUp && !hasPriorContext) {
        setTurns((current) => [
          ...current,
          {
            id: nanoid(),
            role: "user",
            content: promptText,
          },
          {
            id: nanoid(),
            role: "assistant",
            content: attachmentOnlyPromptMessage,
          },
        ]);
        setSuggestions(buildAssistantSuggestions(null));
        setErrorMessage(null);
        return;
      }

      const question = [promptText, pendingContext?.text, currentAttachmentContext].filter(Boolean).join("\n\n");
      if (!question && !mergedPastedContext) {
        return;
      }

      const classification = classifyAssistantIntent({
        currentRequest: promptText,
        pastedContext: mergedPastedContext || undefined,
        hasConversationContext: Boolean(conversationContext?.trim()),
      });

      if (classification.intent === "clarify") {
        const nextPendingContext = {
          text: mergedPastedContext,
          attachments: [...(pendingContext?.attachments ?? []), ...attachmentSummaries],
        };
        setPendingContext(nextPendingContext);
        setTurns((current) => [
          ...current,
          {
            id: nanoid(),
            role: "user",
            content: promptText,
            attachments: attachmentSummaries.length > 0 ? attachmentSummaries : undefined,
          },
          {
            id: nanoid(),
            role: "assistant",
            content: attachmentOnlyPromptMessage,
          },
        ]);
        setSuggestions(buildAssistantSuggestions(null));
        setErrorMessage(null);
        return;
      }

      setPendingContext(null);
      await submitQuestion(question, promptText, [...(pendingContext?.attachments ?? []), ...attachmentSummaries], {
        pastedContext: mergedPastedContext || undefined,
      });
    },
    [pendingContext, submitQuestion, turns]
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
      title="AI Assistant"
      titleAccessory={
        <Tooltip>
          <TooltipTrigger
            aria-label="AI Assistant privacy details"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-(--border) text-xs font-semibold text-(--text-muted) transition hover:border-(--accent) hover:text-(--accent)"
            type="button"
          >
            ?
          </TooltipTrigger>
          <TooltipContent
            align="start"
            className="max-w-sm rounded-xl border border-(--border) bg-(--surface-elevated) p-3 text-left text-(--text-primary) shadow-2xl shadow-black/20 backdrop-blur"
            side="right"
            sideOffset={10}
          >
            {assistantPrivacyTooltip}
          </TooltipContent>
        </Tooltip>
      }
      footerStatusLabel={
        dockerStatus?.isRunning
          ? `${dockerStatus.providerName} connected`
          : (dockerStatus?.message ?? "Engine unavailable")
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {turns.length > 0 || modelStatus.state !== "installed" ? (
          <div className="border-b border-(--border) px-4 py-3 sm:px-6">
            {turns.length > 0 ? (
              <div className="flex justify-end">
                <button
                  className="inline-flex min-h-8 items-center rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
                  disabled={isLoading}
                  type="button"
                  onClick={handleClearChat}
                >
                  Clear chat
                </button>
              </div>
            ) : null}
            {modelStatus.state !== "installed" ? (
              <div className={turns.length > 0 ? "mt-3 max-w-xl" : "max-w-xl"}>
                <CliAiAssistantCard onStatusChange={setModelStatus} />
              </div>
            ) : null}
          </div>
        ) : null}

        <Conversation className="min-h-0 flex-1">
          <ConversationContent>
            {turns.length === 0 ? (
              <ConversationEmptyState
                description="Try a quick prompt below or ask about a specific container."
                title="Local app insights"
              />
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
                      <UserMessageContent turn={turn} />
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
          {suggestions.length > 0 ? (
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

          <PromptInputProvider>
            <AssistantPromptComposer
              isLoading={isLoading}
              onSubmit={handlePromptSubmit}
            />
          </PromptInputProvider>
        </div>
      </div>
    </PageShell>
  );
}

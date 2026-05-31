import type { AppInsightsResponse, AppInsightsSourceKind } from "./app-insights-assistant";
import type { DockerCommandRisk } from "./docker-command-registry";

export type AssistantChatAttachment = {
  id: string;
  label: string;
  mediaType?: string;
};

export type AssistantChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: string;
  attachments?: AssistantChatAttachment[];
  response?: AppInsightsResponse;
};

export const ASSISTANT_CHAT_HISTORY_KEY = "oxidock.assistant.chat.v1";

const MAX_TURNS = 50;
const MAX_TEXT_LENGTH = 12_000;
const MAX_ATTACHMENTS = 10;
const MAX_SOURCES = 20;
const MAX_COMMANDS = 8;
const MAX_STACK_TRACES = 5;

const SOURCE_KINDS = new Set<AppInsightsSourceKind>([
  "container",
  "image",
  "volume",
  "network",
  "event",
  "doc",
  "engine",
]);
const COMMAND_RISKS = new Set<DockerCommandRisk>(["safe", "medium", "destructive"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const truncateText = (value: string): string =>
  value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH - 1)}…` : value;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? truncateText(value) : undefined;

const sanitizeAttachments = (value: unknown): AssistantChatAttachment[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const attachments = value
    .filter(isRecord)
    .reduce<AssistantChatAttachment[]>((items, attachment, index) => {
      if (typeof attachment.label !== "string" || !attachment.label.trim()) {
        return items;
      }

      items.push({
        id:
          typeof attachment.id === "string" && attachment.id.trim()
            ? truncateText(attachment.id)
            : `attachment-${index}`,
        label: truncateText(attachment.label),
        mediaType: optionalString(attachment.mediaType),
      });

      return items;
    }, [])
    .slice(0, MAX_ATTACHMENTS);

  return attachments.length > 0 ? attachments : undefined;
};

const sanitizeResponse = (value: unknown): AppInsightsResponse | undefined => {
  if (!isRecord(value) || typeof value.answer !== "string") {
    return undefined;
  }

  const sources = Array.isArray(value.sources)
    ? value.sources
        .filter(isRecord)
        .map((source) => {
          if (
            typeof source.id !== "string" ||
            typeof source.label !== "string" ||
            typeof source.kind !== "string" ||
            !SOURCE_KINDS.has(source.kind as AppInsightsSourceKind)
          ) {
            return null;
          }

          return {
            id: source.id,
            kind: source.kind as AppInsightsSourceKind,
            label: truncateText(source.label),
            detail: optionalString(source.detail),
          };
        })
        .filter((source): source is NonNullable<typeof source> => source != null)
        .slice(0, MAX_SOURCES)
    : [];

  const suggestedCommands = Array.isArray(value.suggestedCommands)
    ? value.suggestedCommands
        .filter(isRecord)
        .map((command) => {
          if (
            typeof command.command !== "string" ||
            typeof command.label !== "string" ||
            typeof command.explanation !== "string" ||
            typeof command.risk !== "string" ||
            !COMMAND_RISKS.has(command.risk as DockerCommandRisk)
          ) {
            return null;
          }

          return {
            command: truncateText(command.command),
            label: truncateText(command.label),
            explanation: truncateText(command.explanation),
            risk: command.risk as DockerCommandRisk,
          };
        })
        .filter((command): command is NonNullable<typeof command> => command != null)
        .slice(0, MAX_COMMANDS)
    : [];

  const stackTraces = Array.isArray(value.stackTraces)
    ? value.stackTraces
        .filter(isRecord)
        .map((trace) => {
          if (typeof trace.title !== "string" || typeof trace.content !== "string") {
            return null;
          }

          return {
            title: truncateText(trace.title),
            content: truncateText(trace.content),
          };
        })
        .filter((trace): trace is NonNullable<typeof trace> => trace != null)
        .slice(0, MAX_STACK_TRACES)
    : [];

  return {
    answer: truncateText(value.answer),
    reasoning: typeof value.reasoning === "string" ? truncateText(value.reasoning) : null,
    sources,
    suggestedCommands,
    stackTraces,
    usedModel: typeof value.usedModel === "boolean" ? value.usedModel : false,
  };
};

export const parseAssistantChatHistory = (raw: string | null): AssistantChatTurn[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecord)
      .reduce<AssistantChatTurn[]>((turns, turn, index) => {
        if ((turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string") {
          return turns;
        }

        const role = turn.role;
        const response = turn.role === "assistant" ? sanitizeResponse(turn.response) : undefined;
        const parsedTurn: AssistantChatTurn = {
          id: typeof turn.id === "string" && turn.id.trim() ? turn.id : `persisted-${index}`,
          role,
          content: truncateText(turn.content),
        };
        const attachments = role === "user" ? sanitizeAttachments(turn.attachments) : undefined;
        const context = role === "user" ? optionalString(turn.context) : undefined;

        if (context) {
          parsedTurn.context = context;
        }
        if (attachments) {
          parsedTurn.attachments = attachments;
        }
        if (response) {
          parsedTurn.response = response;
        }

        turns.push(parsedTurn);
        return turns;
      }, [])
      .slice(-MAX_TURNS);
  } catch {
    return [];
  }
};

export const loadAssistantChatHistory = (): AssistantChatTurn[] => {
  if (typeof window === "undefined") {
    return [];
  }

  return parseAssistantChatHistory(window.localStorage.getItem(ASSISTANT_CHAT_HISTORY_KEY));
};

export const saveAssistantChatHistory = (turns: AssistantChatTurn[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  const boundedTurns = parseAssistantChatHistory(JSON.stringify(turns));
  if (boundedTurns.length === 0) {
    window.localStorage.removeItem(ASSISTANT_CHAT_HISTORY_KEY);
    return;
  }

  window.localStorage.setItem(ASSISTANT_CHAT_HISTORY_KEY, JSON.stringify(boundedTurns));
};

export const clearAssistantChatHistory = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ASSISTANT_CHAT_HISTORY_KEY);
};

import { invoke } from "@tauri-apps/api/core";
import type { DockerCommandRisk } from "./docker-command-registry";
import {
  buildDeterministicAnswer,
  buildDeterministicInsights,
  collectAppInsightsContext,
  filterInsightsForQuestion,
  isOxidockRelevantQuestion,
  OXIDOCK_ASSISTANT_CLARIFY_MESSAGE,
  OXIDOCK_ASSISTANT_SCOPE_MESSAGE,
  OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE,
  type AppInsightsContextSnapshot,
  type DeterministicInsight,
} from "./assistant-context";
import { classifyAssistantIntent, parseAssistantQuestionParts, type AssistantIntent } from "./assistant-intent";
import { getInvokeErrorMessage } from "./local-ai-assistant";
import type { DockerStatus } from "../types/docker";

export type { AssistantIntent };

export type AppInsightsSourceKind = "container" | "image" | "volume" | "network" | "event" | "doc" | "engine";

export type AppInsightsSource = {
  id: string;
  kind: AppInsightsSourceKind;
  label: string;
  detail?: string;
};

export type AppInsightsSuggestedCommand = {
  command: string;
  label: string;
  explanation: string;
  risk: DockerCommandRisk;
};

export type AppInsightsStackTrace = {
  title: string;
  content: string;
};

export type AppInsightsResponse = {
  answer: string;
  reasoning?: string | null;
  sources: AppInsightsSource[];
  suggestedCommands: AppInsightsSuggestedCommand[];
  stackTraces: AppInsightsStackTrace[];
  usedModel: boolean;
};

export type AskAppInsightsOptions = {
  /** Combined question used for context collection and deterministic fallback. */
  question: string;
  /** User's typed request without pasted attachment bodies. */
  currentRequest?: string;
  /** Long pasted text carried separately from the current request. */
  pastedContext?: string;
  /** Prior chat turns serialized for the model. */
  conversationContext?: string;
  /** Explicit intent override; otherwise inferred from the current request. */
  intent?: AssistantIntent;
  dockerStatus?: DockerStatus | null;
  signal?: AbortSignal;
};

const intentIncludesImages = (intent: AssistantIntent): boolean =>
  intent === "explain_images" || intent === "list_cleanup_candidates" || intent === "compare_context_to_state";

const intentIncludesVolumes = (intent: AssistantIntent): boolean =>
  intent === "explain_volumes" || intent === "list_cleanup_candidates";

const intentIncludesNetworks = (intent: AssistantIntent): boolean =>
  intent === "explain_networks" || intent === "compare_context_to_state";

const insightsToSources = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[],
  intent: AssistantIntent
): AppInsightsSource[] => {
  const sources: AppInsightsSource[] = [
    {
      id: "engine",
      kind: "engine",
      label: snapshot.docker.providerName,
      detail: snapshot.docker.message,
    },
  ];

  const pushSource = (source: AppInsightsSource) => {
    if (!sources.some((item) => item.id === source.id)) {
      sources.push(source);
    }
  };

  const sourceIds = new Set(insights.flatMap((insight) => insight.sourceIds));

  for (const container of snapshot.containers) {
    const sourceId = `container:${container.shortId}`;
    if (sourceIds.has(sourceId)) {
      pushSource({
        id: sourceId,
        kind: "container",
        label: container.name,
        detail: container.status,
      });
    }
  }

  if (intentIncludesImages(intent)) {
    snapshot.images.slice(0, 8).forEach((image, index) => {
      pushSource({
        id: `image:${index}`,
        kind: "image",
        label: `${image.repository}:${image.tag}`,
        detail: `${image.size}, used by ${image.containers} container(s)`,
      });
    });
  }

  if (intentIncludesVolumes(intent)) {
    for (const volume of snapshot.volumes.slice(0, 8)) {
      pushSource({
        id: `volume:${volume.name}`,
        kind: "volume",
        label: volume.name,
        detail: `${volume.driver}, ${volume.scope}`,
      });
    }
  }

  if (intentIncludesNetworks(intent)) {
    for (const network of snapshot.networks.slice(0, 8)) {
      pushSource({
        id: `network:${network.name}`,
        kind: "network",
        label: network.name,
        detail: `${network.driver}, ${network.containerCount} container(s)`,
      });
    }
  }

  for (const doc of snapshot.matchedDocs) {
    pushSource({
      id: `doc:${doc.id}`,
      kind: "doc",
      label: doc.label,
      detail: doc.example,
    });
  }

  if (sourceIds.has("events") || intent === "explain_events") {
    pushSource({
      id: "events",
      kind: "event",
      label: "Recent Docker events",
      detail: `${snapshot.recentEvents.length} events in snapshot`,
    });
  }

  return sources;
};

const insightsToCommands = (insights: DeterministicInsight[]): AppInsightsSuggestedCommand[] => {
  const commands: AppInsightsSuggestedCommand[] = [];
  const seen = new Set<string>();

  for (const insight of insights) {
    if (!insight.suggestedCommand || seen.has(insight.suggestedCommand)) {
      continue;
    }
    seen.add(insight.suggestedCommand);
    commands.push({
      command: insight.suggestedCommand,
      label: insight.title,
      explanation: insight.detail,
      risk:
        insight.suggestedCommand.includes("prune") || insight.suggestedCommand.includes(" rm ")
          ? "destructive"
          : insight.suggestedCommand.includes("update") || insight.suggestedCommand.includes("logs")
            ? "medium"
            : "safe",
    });
  }

  return commands.slice(0, 5);
};

const extractStackTraces = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[]
): AppInsightsStackTrace[] => {
  const failureInsights = insights.filter(
    (insight) => insight.id.startsWith("oom-") || insight.id.startsWith("restart-") || insight.id.startsWith("exited-")
  );

  if (failureInsights.length === 0) {
    return [];
  }

  const sourceIds = new Set(failureInsights.flatMap((insight) => insight.sourceIds));
  const containerNames = new Set(
    snapshot.containers
      .filter((container) => sourceIds.has(`container:${container.shortId}`))
      .map((container) => container.name)
  );
  const excerpts =
    containerNames.size > 0
      ? snapshot.logExcerpts.filter((excerpt) => containerNames.has(excerpt.containerName))
      : snapshot.logExcerpts;

  return excerpts
    .filter((excerpt) => /(?:Error|Exception|panic|stack trace|at\s+\S+\()/i.test(excerpt.excerpt))
    .map((excerpt) => ({
      title: `${excerpt.containerName} logs`,
      content: excerpt.excerpt,
    }));
};

export type ResolvedAssistantRequest = {
  combinedQuestion: string;
  currentRequest: string;
  pastedContext?: string;
  intent: AssistantIntent;
  inScope: boolean;
  intentLabel: string;
  hasConversationContext: boolean;
};

export const resolveAssistantRequest = ({
  question,
  currentRequest,
  pastedContext,
  conversationContext,
  intent,
}: Pick<
  AskAppInsightsOptions,
  "question" | "currentRequest" | "pastedContext" | "conversationContext" | "intent"
>): ResolvedAssistantRequest => {
  const trimmedQuestion = question.trim();
  const parsed = parseAssistantQuestionParts(trimmedQuestion);
  const resolvedCurrentRequest = (currentRequest ?? parsed.currentRequest).trim();
  const resolvedPastedContext = pastedContext ?? parsed.pastedContext;
  const hasConversationContext = Boolean(conversationContext?.trim());
  const classification = classifyAssistantIntent({
    currentRequest: resolvedCurrentRequest,
    pastedContext: resolvedPastedContext,
    hasConversationContext,
  });

  return {
    combinedQuestion: trimmedQuestion,
    currentRequest: resolvedCurrentRequest,
    pastedContext: resolvedPastedContext,
    intent: intent ?? classification.intent,
    inScope: intent ? intent !== "out_of_scope" && intent !== "clarify" : classification.inScope,
    intentLabel: classification.intentLabel,
    hasConversationContext,
  };
};

export const buildDeterministicResponse = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[],
  request: ResolvedAssistantRequest
): AppInsightsResponse => {
  if (request.intent === "out_of_scope") {
    return {
      answer: OXIDOCK_ASSISTANT_SCOPE_MESSAGE,
      reasoning: null,
      sources: [],
      suggestedCommands: [],
      stackTraces: [],
      usedModel: false,
    };
  }

  if (request.intent === "clarify") {
    const answer = request.pastedContext?.trim()
      ? OXIDOCK_ASSISTANT_CLARIFY_MESSAGE
      : request.hasConversationContext
        ? OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE
        : OXIDOCK_ASSISTANT_CLARIFY_MESSAGE;

    return {
      answer,
      reasoning: null,
      sources: [],
      suggestedCommands: [],
      stackTraces: [],
      usedModel: false,
    };
  }

  const supportInsights = filterInsightsForQuestion(insights, request.combinedQuestion, snapshot, request.intent);

  return {
    answer: buildDeterministicAnswer(snapshot, insights, request.combinedQuestion, {
      intent: request.intent,
      pastedContext: request.pastedContext,
      hasConversationContext: request.hasConversationContext,
    }),
    reasoning: supportInsights.length
      ? supportInsights.map((insight) => `- ${insight.title}: ${insight.detail}`).join("\n")
      : null,
    sources: insightsToSources(snapshot, supportInsights, request.intent),
    suggestedCommands: insightsToCommands(supportInsights),
    stackTraces: extractStackTraces(snapshot, supportInsights),
    usedModel: false,
  };
};

export const askAppInsightsAssistant = async ({
  question,
  currentRequest,
  pastedContext,
  conversationContext,
  intent,
  dockerStatus,
  signal,
}: AskAppInsightsOptions): Promise<AppInsightsResponse> => {
  const request = resolveAssistantRequest({
    question,
    currentRequest,
    pastedContext,
    conversationContext,
    intent,
  });

  if (!request.combinedQuestion && !request.pastedContext) {
    throw new Error("Enter a question for the assistant.");
  }

  if (request.intent === "clarify" || request.intent === "out_of_scope") {
    return buildDeterministicResponse(
      {
        collectedAt: new Date().toISOString(),
        docker: {
          isRunning: dockerStatus?.isRunning ?? false,
          engineState: dockerStatus?.engineState ?? "unknown",
          message: dockerStatus?.message ?? "Docker status unavailable.",
          serverVersion: dockerStatus?.serverVersion ?? null,
          providerName: dockerStatus?.providerName ?? "Docker",
        },
        counts: {
          containers: 0,
          running: 0,
          exited: 0,
          images: 0,
          volumes: 0,
          networks: 0,
        },
        containers: [],
        images: [],
        volumes: [],
        networks: [],
        recentEvents: [],
        matchedDocs: [],
        logExcerpts: [],
      },
      [],
      request
    );
  }

  const snapshot = await collectAppInsightsContext({
    question: request.combinedQuestion,
    intent: request.intent,
    dockerStatus,
    signal,
  });
  const insights = buildDeterministicInsights(snapshot);
  const fallback = buildDeterministicResponse(snapshot, insights, request);

  if (
    !isOxidockRelevantQuestion(request.combinedQuestion, {
      hasConversationContext: request.hasConversationContext,
    })
  ) {
    return fallback;
  }

  if (signal?.aborted) {
    throw new DOMException("Assistant request aborted", "AbortError");
  }

  try {
    const enhanced = await invoke<AppInsightsResponse>("ask_app_insights_assistant", {
      params: {
        question: request.combinedQuestion,
        currentRequest: request.currentRequest,
        pastedContext: request.pastedContext?.trim() || null,
        intent: request.intent,
        intentLabel: request.intentLabel,
        conversationContext: conversationContext?.trim() || null,
        contextJson: JSON.stringify(snapshot),
        deterministicAnswer: fallback.answer,
        deterministicReasoning: fallback.reasoning ?? null,
        deterministicSources: fallback.sources,
        deterministicCommands: fallback.suggestedCommands,
        deterministicStackTraces: fallback.stackTraces,
      },
    });

    if (signal?.aborted) {
      throw new DOMException("Assistant request aborted", "AbortError");
    }

    return {
      ...fallback,
      ...enhanced,
      sources: enhanced.sources.length > 0 ? enhanced.sources : fallback.sources,
      suggestedCommands:
        enhanced.suggestedCommands.length > 0 ? enhanced.suggestedCommands : fallback.suggestedCommands,
      stackTraces: enhanced.stackTraces.length > 0 ? enhanced.stackTraces : fallback.stackTraces,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      ...fallback,
      answer: `${fallback.answer}\n\n_Note: ${getInvokeErrorMessage(error, "Local model unavailable — showing rule-based analysis.")}_`,
    };
  }
};

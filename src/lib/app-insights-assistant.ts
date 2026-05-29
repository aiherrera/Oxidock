import { invoke } from "@tauri-apps/api/core";
import type { DockerCommandRisk } from "./docker-command-registry";
import {
  buildDeterministicAnswer,
  buildDeterministicInsights,
  collectAppInsightsContext,
  filterInsightsForQuestion,
  type AppInsightsContextSnapshot,
  type DeterministicInsight,
} from "./assistant-context";
import { getInvokeErrorMessage } from "./local-ai-assistant";
import type { DockerStatus } from "../types/docker";

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
  question: string;
  dockerStatus?: DockerStatus | null;
  signal?: AbortSignal;
};

const insightsToSources = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[]
): AppInsightsSource[] => {
  const sources: AppInsightsSource[] = [
    {
      id: "engine",
      kind: "engine",
      label: snapshot.docker.providerName,
      detail: snapshot.docker.message,
    },
  ];

  for (const container of snapshot.containers.slice(0, 12)) {
    sources.push({
      id: `container:${container.shortId}`,
      kind: "container",
      label: container.name,
      detail: container.status,
    });
  }

  for (const doc of snapshot.matchedDocs) {
    sources.push({
      id: `doc:${doc.id}`,
      kind: "doc",
      label: doc.label,
      detail: doc.example,
    });
  }

  if (snapshot.recentEvents.length > 0) {
    sources.push({
      id: "events",
      kind: "event",
      label: "Recent Docker events",
      detail: `${snapshot.recentEvents.length} events in snapshot`,
    });
  }

  for (const insight of insights) {
    if (insight.sourceIds.includes("events") && !sources.some((s) => s.id === "events")) {
      sources.push({
        id: "events",
        kind: "event",
        label: "Recent Docker events",
      });
    }
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

const extractStackTraces = (snapshot: AppInsightsContextSnapshot): AppInsightsStackTrace[] =>
  snapshot.logExcerpts
    .filter((excerpt) => /(?:Error|Exception|panic|stack trace|at\s+\S+\()/i.test(excerpt.excerpt))
    .map((excerpt) => ({
      title: `${excerpt.containerName} logs`,
      content: excerpt.excerpt,
    }));

export const buildDeterministicResponse = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[],
  question: string
): AppInsightsResponse => {
  const supportInsights = filterInsightsForQuestion(insights, question);

  return {
    answer: buildDeterministicAnswer(snapshot, insights, question),
    reasoning: supportInsights.length
      ? supportInsights.map((insight) => `- ${insight.title}: ${insight.detail}`).join("\n")
      : null,
    sources: insightsToSources(snapshot, supportInsights),
    suggestedCommands: insightsToCommands(supportInsights),
    stackTraces: extractStackTraces(snapshot),
    usedModel: false,
  };
};

export const askAppInsightsAssistant = async ({
  question,
  dockerStatus,
  signal,
}: AskAppInsightsOptions): Promise<AppInsightsResponse> => {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Enter a question for the assistant.");
  }

  const snapshot = await collectAppInsightsContext({ question: trimmed, dockerStatus, signal });
  const insights = buildDeterministicInsights(snapshot);
  const fallback = buildDeterministicResponse(snapshot, insights, trimmed);

  if (signal?.aborted) {
    throw new DOMException("Assistant request aborted", "AbortError");
  }

  try {
    const enhanced = await invoke<AppInsightsResponse>("ask_app_insights_assistant", {
      question: trimmed,
      contextJson: JSON.stringify(snapshot),
      deterministicAnswer: fallback.answer,
      deterministicReasoning: fallback.reasoning ?? null,
      deterministicSources: fallback.sources,
      deterministicCommands: fallback.suggestedCommands,
      deterministicStackTraces: fallback.stackTraces,
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

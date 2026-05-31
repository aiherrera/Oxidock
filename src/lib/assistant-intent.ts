import { getIntentSuggestions } from "./docker-intent-matcher";

export type AssistantIntent =
  | "diagnose_container"
  | "explain_events"
  | "explain_context"
  | "summarize_context"
  | "compare_context_to_state"
  | "list_cleanup_candidates"
  | "explain_images"
  | "explain_memory"
  | "explain_volumes"
  | "explain_networks"
  | "suggest_command"
  | "suggest_next_step"
  | "clarify"
  | "out_of_scope";

export type ClassifyAssistantIntentInput = {
  /** The user's current typed request (without pasted attachment bodies). */
  currentRequest: string;
  /** Long pasted text or attachment bodies carried as context. */
  pastedContext?: string;
  /** Whether prior chat turns exist in this session. */
  hasConversationContext?: boolean;
};

export type AssistantIntentClassification = {
  intent: AssistantIntent;
  /** Whether the assistant should attempt to answer from Docker/app state. */
  inScope: boolean;
  /** Short label for prompts and logging. */
  intentLabel: string;
};

const DOCKER_DOMAIN_PATTERN =
  /\b(docker|container|containers|image|images|volume|volumes|network|networks|compose|oxidock|registry|podman|stack|service|services|stats|inspect|logs?|prune|oom|engine)\b/i;

const GENERAL_KNOWLEDGE_PATTERN =
  /\b(who is|who was|who are|what is the capital|when was|president|prime minister|election|senator|governor|weather|forecast|recipe|ingredients|translate this|write a poem|tell me a joke|solve this equation|stock price|bitcoin price)\b/i;

const VAGUE_REFERENCE_PATTERN =
  /^(what about (this|that|it)|tell me more|explain (this|that|it)|and (this|that)|how about (this|that)|can you (summarize|explain) (this|that|it))\??$/i;

const CONTEXT_SUMMARY_PATTERN =
  /\b(summarize|summary|tl;dr|tldr|overview|recap|what does (this|that|it) say|key points|main points)\b/i;

const CONTEXT_QUESTION_PATTERN =
  /\b(architecture|architectural|structure|stack|how (does|do|is|are)|what is|what are|explain|describe|tell me about|walk me through|how is|how are|why (does|do|is)|where (does|do|is))\b/i;

const CONTEXT_COMPARE_PATTERN = /\b(compare|contrast|match|align|reconcile|versus|vs\.?|difference|diff)\b/i;

const CLEANUP_PATTERN = /\b(cleanup|clean up|prune|delete|deleting|remove|resources|reclaim|free|unused|dangling)\b/i;

const EVENT_PATTERN = /\b(event|events|recent|history|happened|timeline|what changed)\b/i;

const MEMORY_PATTERN = /\b(memory|mem|ram|oom|137)\b/i;

const IMAGE_PATTERN = /\b(image|images|dangling|layer|layers|tag|tags|repository|repositories)\b/i;

const VOLUME_PATTERN = /\b(volume|volumes)\b/i;

const NETWORK_PATTERN = /\b(network|networks|port|ports|connect|connection)\b/i;

const FAILURE_PATTERN =
  /\b(restart|restarting|crash|crashed|exited|exit|failed|failing|down|unhealthy|oom|137|killed|log|logs|debug|troubleshoot|wrong|issue|issues)\b/i;

const NEXT_STEP_PATTERN =
  /\b(what should i|what next|next step|recommend|suggest|help me|where do i start|what do i do)\b/i;

const COMMAND_REQUEST_PATTERN =
  /\b((what|which)\s+(docker\s+)?commands?|commands?\s+(can|should)\s+i\s+run|what\s+should\s+i\s+run|run\s+to\s+\w+|cli|shell\s+command)\b/i;

export const isCommandRequestText = (text: string): boolean => COMMAND_REQUEST_PATTERN.test(text);

export const isMemoryPressureMitigationText = (text: string): boolean =>
  MEMORY_PATTERN.test(text) && /\b(reduce|lower|relieve|free|limit|pressure|safely|safe)\b/i.test(text);

const GREETING_PATTERN = /^(hi|hello|hey|thanks|thank you)\.?$/i;

const DIRECT_FAILURE_QUESTION_PATTERN = /\b(what failed|what.?s wrong|any issues|anything wrong)\b/i;

const INTENT_PRIORITY: Record<AssistantIntent, number> = {
  suggest_command: 0,
  list_cleanup_candidates: 1,
  diagnose_container: 2,
  explain_memory: 3,
  explain_events: 4,
  explain_images: 5,
  explain_volumes: 6,
  explain_networks: 7,
  suggest_next_step: 8,
  compare_context_to_state: 9,
  summarize_context: 10,
  explain_context: 11,
  clarify: 12,
  out_of_scope: 13,
};

const hasPastedContext = (pastedContext: string | undefined): boolean => Boolean(pastedContext?.trim());

const isDockerDomainText = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return (
    DOCKER_DOMAIN_PATTERN.test(trimmed) ||
    MEMORY_PATTERN.test(trimmed) ||
    IMAGE_PATTERN.test(trimmed) ||
    EVENT_PATTERN.test(trimmed) ||
    VOLUME_PATTERN.test(trimmed) ||
    NETWORK_PATTERN.test(trimmed) ||
    FAILURE_PATTERN.test(trimmed) ||
    CLEANUP_PATTERN.test(trimmed)
  );
};

const isOutOfScopeRequest = (currentRequest: string, pastedContext: string | undefined): boolean => {
  const trimmed = currentRequest.trim();
  if (!trimmed && !hasPastedContext(pastedContext)) {
    return false;
  }

  if (trimmed && GENERAL_KNOWLEDGE_PATTERN.test(trimmed)) {
    return true;
  }

  if (trimmed && GREETING_PATTERN.test(trimmed)) {
    return true;
  }

  if (trimmed && !isDockerDomainText(trimmed) && !hasPastedContext(pastedContext)) {
    if (getIntentSuggestions(trimmed, 1).suggestions.length > 0) {
      return false;
    }

    if (/\b(what failed|what.?s wrong|help me debug|troubleshoot|any issues|anything wrong)\b/i.test(trimmed)) {
      return false;
    }

    if (VAGUE_REFERENCE_PATTERN.test(trimmed)) {
      return false;
    }

    if (CONTEXT_SUMMARY_PATTERN.test(trimmed)) {
      return false;
    }

    return true;
  }

  return false;
};

const classifyDockerIntentBySignals = (trimmed: string): AssistantIntent => {
  const scores = new Map<AssistantIntent, number>();
  const addScore = (intent: AssistantIntent, score: number) => {
    scores.set(intent, (scores.get(intent) ?? 0) + score);
  };

  if (isCommandRequestText(trimmed)) {
    addScore("suggest_command", 140);
  }

  if (NEXT_STEP_PATTERN.test(trimmed)) {
    addScore("suggest_next_step", 80);
  }

  if (CLEANUP_PATTERN.test(trimmed)) {
    addScore("list_cleanup_candidates", 155);
  }

  if (FAILURE_PATTERN.test(trimmed) || DIRECT_FAILURE_QUESTION_PATTERN.test(trimmed)) {
    addScore("diagnose_container", 90);
  }

  if (MEMORY_PATTERN.test(trimmed)) {
    addScore("explain_memory", 75);
  }

  if (EVENT_PATTERN.test(trimmed)) {
    addScore("explain_events", 75);
  }

  if (IMAGE_PATTERN.test(trimmed)) {
    addScore("explain_images", 75);
  }

  if (VOLUME_PATTERN.test(trimmed)) {
    addScore("explain_volumes", 75);
  }

  if (NETWORK_PATTERN.test(trimmed)) {
    addScore("explain_networks", 75);
  }

  if (getIntentSuggestions(trimmed, 1).suggestions.length > 0) {
    addScore("suggest_next_step", 45);
  }

  const [best] = [...scores.entries()].sort(
    ([leftIntent, leftScore], [rightIntent, rightScore]) =>
      rightScore - leftScore || INTENT_PRIORITY[leftIntent] - INTENT_PRIORITY[rightIntent]
  );

  return best?.[0] ?? "diagnose_container";
};

const classifyScopedIntent = (
  currentRequest: string,
  pastedContext: string | undefined,
  hasConversationContext: boolean
): AssistantIntent => {
  const trimmed = currentRequest.trim();
  const combined = [trimmed, pastedContext?.trim()].filter(Boolean).join("\n");

  if (!trimmed && hasPastedContext(pastedContext)) {
    return "clarify";
  }

  if (!trimmed) {
    return "clarify";
  }

  if (VAGUE_REFERENCE_PATTERN.test(trimmed) && (hasPastedContext(pastedContext) || hasConversationContext)) {
    if (CONTEXT_COMPARE_PATTERN.test(trimmed)) {
      return "compare_context_to_state";
    }
    if (CONTEXT_SUMMARY_PATTERN.test(trimmed)) {
      return "summarize_context";
    }
    return "summarize_context";
  }

  if (hasPastedContext(pastedContext)) {
    if (
      CONTEXT_COMPARE_PATTERN.test(trimmed) ||
      /\b(docker|container|containers|my stack|local state)\b/i.test(trimmed)
    ) {
      return "compare_context_to_state";
    }
    if (CONTEXT_SUMMARY_PATTERN.test(trimmed)) {
      return "summarize_context";
    }
    if (CONTEXT_QUESTION_PATTERN.test(trimmed) || /\?\s*$/.test(trimmed)) {
      return "explain_context";
    }
  }

  if (CONTEXT_SUMMARY_PATTERN.test(trimmed) && hasPastedContext(pastedContext)) {
    return "summarize_context";
  }

  if (CONTEXT_COMPARE_PATTERN.test(trimmed) && (hasPastedContext(pastedContext) || isDockerDomainText(combined))) {
    return "compare_context_to_state";
  }

  const scoredIntent = classifyDockerIntentBySignals(trimmed);

  if (scoredIntent === "diagnose_container" && hasPastedContext(pastedContext) && !isDockerDomainText(trimmed)) {
    return "explain_context";
  }

  return scoredIntent;
};

const intentLabels: Record<AssistantIntent, string> = {
  diagnose_container: "Diagnose container or service failure",
  explain_events: "Explain recent Docker events",
  explain_context: "Answer a question using pasted context",
  summarize_context: "Summarize pasted or referenced context",
  compare_context_to_state: "Compare pasted context with local Docker state",
  list_cleanup_candidates: "List cleanup or reclaim candidates",
  explain_images: "Explain image usage and attachment",
  explain_memory: "Explain container memory usage",
  explain_volumes: "Explain Docker volumes",
  explain_networks: "Explain Docker networks",
  suggest_command: "Suggest Docker command",
  suggest_next_step: "Suggest next troubleshooting step",
  clarify: "Ask for clarification",
  out_of_scope: "Out of app scope",
};

/**
 * Classifies the user's current request into a focused assistant intent.
 * Prior chat and pasted context are inputs but do not replace the current request.
 */
export function classifyAssistantIntent({
  currentRequest,
  pastedContext,
  hasConversationContext = false,
}: ClassifyAssistantIntentInput): AssistantIntentClassification {
  if (isOutOfScopeRequest(currentRequest, pastedContext)) {
    return {
      intent: "out_of_scope",
      inScope: false,
      intentLabel: intentLabels.out_of_scope,
    };
  }

  const intent = classifyScopedIntent(currentRequest, pastedContext, hasConversationContext);

  return {
    intent,
    inScope: intent !== "clarify" && intent !== "out_of_scope",
    intentLabel: intentLabels[intent],
  };
}

export type ParsedAssistantQuestion = {
  currentRequest: string;
  pastedContext?: string;
};

/**
 * Splits a combined question string into the current request and pasted context.
 * Attachment bodies are appended after blank lines following the typed prompt.
 */
export function parseAssistantQuestionParts(combinedQuestion: string): ParsedAssistantQuestion {
  const trimmed = combinedQuestion.trim();
  if (!trimmed) {
    return { currentRequest: "" };
  }

  const sections = trimmed.split(/\n{2,}/);
  if (sections.length <= 1) {
    return { currentRequest: trimmed };
  }

  const [firstSection, ...rest] = sections;
  const pastedContext = rest.join("\n\n").trim();

  return {
    currentRequest: firstSection.trim(),
    pastedContext: pastedContext || undefined,
  };
}

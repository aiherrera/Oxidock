import { classifyAssistantIntent, parseAssistantQuestionParts, type AssistantIntent } from "./assistant-intent";
import {
  dockerCommandList,
  getDockerCommand,
  type DockerCommandId,
  type DockerCommandMetadata,
} from "./docker-command-registry";
import { getIntentSuggestions } from "./docker-intent-matcher";
import {
  fetchContainerLogs,
  fetchContainers,
  fetchContainerStats,
  fetchDockerEvents,
  fetchDockerStatus,
  fetchImages,
  fetchNetworks,
  fetchVolumes,
} from "./tauri-docker";
import type { DockerStatus } from "../types/docker";

const MAX_CONTAINERS = 40;
const MAX_IMAGES = 30;
const MAX_VOLUMES = 25;
const MAX_NETWORKS = 20;
const MAX_EVENTS = 25;
const MAX_LOG_EXCERPT_CHARS = 1200;
const MAX_MATCHED_DOCS = 5;
const STATS_CONTAINER_LIMIT = 20;

export type AppInsightsContainerSnapshot = {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  project: string | null;
  service: string | null;
  cpuPercent?: string;
  memoryPercent?: string;
};

export type AppInsightsContextSnapshot = {
  collectedAt: string;
  docker: {
    isRunning: boolean;
    engineState: string;
    message: string;
    serverVersion: string | null;
    providerName: string;
  };
  counts: {
    containers: number;
    running: number;
    exited: number;
    images: number;
    volumes: number;
    networks: number;
  };
  containers: AppInsightsContainerSnapshot[];
  images: { repository: string; tag: string; size: string; containers: number }[];
  volumes: { name: string; driver: string; scope: string }[];
  networks: { name: string; driver: string; containerCount: number }[];
  recentEvents: { time: string; action: string; actorName: string; typ: string }[];
  matchedDocs: { id: DockerCommandId; label: string; example: string; risk: string }[];
  logExcerpts: { containerName: string; excerpt: string }[];
};

export type InsightSeverity = "info" | "warning" | "critical";

export type DeterministicInsight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  sourceIds: string[];
  suggestedCommand?: string;
};

export type CollectAppInsightsContextOptions = {
  question: string;
  intent?: AssistantIntent;
  dockerStatus?: DockerStatus | null;
  signal?: AbortSignal;
};

const parsePercent = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/([\d.]+)\s*%/);
  return match ? Number.parseFloat(match[1]) : null;
};

const truncate = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);

export const resolveAssistantIntent = (question: string, intent?: AssistantIntent, hasConversationContext = false) => {
  const { currentRequest, pastedContext } = parseAssistantQuestionParts(question);
  if (intent) {
    return {
      ...classifyAssistantIntent({
        currentRequest,
        pastedContext,
        hasConversationContext,
      }),
      intent,
      currentRequest,
      pastedContext,
    };
  }

  const classification = classifyAssistantIntent({
    currentRequest,
    pastedContext,
    hasConversationContext,
  });

  return {
    ...classification,
    currentRequest,
    pastedContext,
  };
};

export const isOxidockRelevantQuestion = (
  question: string,
  options?: { hasConversationContext?: boolean }
): boolean => {
  const trimmed = question.trim();
  if (!trimmed) {
    return false;
  }

  const { inScope } = resolveAssistantIntent(trimmed, undefined, options?.hasConversationContext ?? false);
  return inScope;
};

const GENERIC_CONTAINER_QUERY_TOKENS = new Set([
  "about",
  "container",
  "containers",
  "crash",
  "crashed",
  "debug",
  "docker",
  "down",
  "exited",
  "failed",
  "failing",
  "help",
  "image",
  "killed",
  "logs",
  "memory",
  "most",
  "restart",
  "restarted",
  "restarting",
  "running",
  "service",
  "services",
  "show",
  "troubleshoot",
  "what",
  "which",
  "wrong",
]);

export const OXIDOCK_ASSISTANT_SCOPE_MESSAGE =
  "I can only answer questions about your local Oxidock Docker environment, including containers, images, volumes, networks, events, logs, and related Docker commands. Ask me about your Oxidock resources and I'll use the current local snapshot to help.";

export const OXIDOCK_ASSISTANT_CLARIFY_MESSAGE =
  "Add a short question or instruction so I know what to do with the context you shared, for example “summarize this”, “find setup steps”, or “compare this with my Docker state”.";

export const OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE =
  "I need a bit more detail about what you want from the earlier context. Try “summarize this”, “compare this with my containers”, or ask about a specific container, image, or event.";

const insightRank: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const sortInsightsBySeverity = (insights: DeterministicInsight[]): DeterministicInsight[] =>
  [...insights].sort((a, b) => insightRank[a.severity] - insightRank[b.severity]);

const formatInsightBullet = (insight: DeterministicInsight): string => `- **${insight.title}**: ${insight.detail}`;

const getContainerQuestionTokens = (question: string): string[] =>
  question
    .toLowerCase()
    .split(/[^a-z0-9_.:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !GENERIC_CONTAINER_QUERY_TOKENS.has(token));

const findExplicitContainersForQuestion = (
  question: string,
  containers: AppInsightsContainerSnapshot[]
): AppInsightsContainerSnapshot[] => {
  const tokens = getContainerQuestionTokens(question);
  if (tokens.length === 0) {
    return [];
  }

  return containers.filter((container) => {
    const haystack = [container.name, container.image, container.project ?? "", container.service ?? ""]
      .join(" ")
      .toLowerCase();

    return tokens.some((token) => haystack.includes(token));
  });
};

const scopeInsightsToExplicitContainers = (
  insights: DeterministicInsight[],
  question: string,
  snapshot?: AppInsightsContextSnapshot
): DeterministicInsight[] => {
  if (!snapshot) {
    return insights;
  }

  const sourceIds = new Set(
    findExplicitContainersForQuestion(question, snapshot.containers).map(
      (container) => `container:${container.shortId}`
    )
  );

  if (sourceIds.size === 0) {
    return insights;
  }

  const scopedInsights = insights.filter((insight) => insight.sourceIds.some((sourceId) => sourceIds.has(sourceId)));
  return scopedInsights.length > 0 ? scopedInsights : insights;
};

export const filterInsightsForQuestion = (
  insights: DeterministicInsight[],
  question: string,
  snapshot?: AppInsightsContextSnapshot,
  intent?: AssistantIntent
): DeterministicInsight[] => {
  const resolvedIntent = intent ?? resolveAssistantIntent(question).intent;

  switch (resolvedIntent) {
    case "explain_images":
    case "list_cleanup_candidates":
      return insights.filter((insight) => insight.id === "dangling-images");

    case "explain_events":
      return insights.filter((insight) => insight.id === "recent-error-events");

    case "explain_volumes":
    case "explain_networks":
    case "summarize_context":
    case "explain_context":
    case "compare_context_to_state":
      return [];

    case "explain_memory":
      return scopeInsightsToExplicitContainers(
        insights.filter((insight) => insight.id.startsWith("oom-") || insight.id.startsWith("mem-")),
        question,
        snapshot
      );

    case "diagnose_container":
    case "suggest_next_step":
      return scopeInsightsToExplicitContainers(
        insights.filter(
          (insight) =>
            insight.id.startsWith("oom-") ||
            insight.id.startsWith("restart-") ||
            insight.id.startsWith("exited-") ||
            insight.id === "recent-error-events"
        ),
        question,
        snapshot
      );

    default:
      return insights;
  }
};

const buildImageAnswer = (snapshot: AppInsightsContextSnapshot, intent: AssistantIntent): string => {
  const danglingImages = snapshot.images.filter((image) => image.repository === "<none>" || image.tag === "<none>");
  const attachedImages = snapshot.images.filter((image) => image.containers > 0);
  const unattachedImages = snapshot.images.filter((image) => image.containers === 0);

  if (intent === "list_cleanup_candidates") {
    return buildCleanupAnswer(snapshot);
  }

  return [
    attachedImages.length > 0
      ? `I found **${attachedImages.length} image(s) still attached to containers**. Avoid pruning those until you review the containers using them.`
      : "I do not see any images attached to containers in the current image snapshot.",
    "",
    "Image summary:",
    `- **Attached to containers**: ${attachedImages.length}`,
    `- **Unattached**: ${unattachedImages.length}`,
    `- **Dangling/untagged**: ${danglingImages.length}`,
    ...attachedImages
      .slice(0, 5)
      .map(
        (image) =>
          `- **${image.repository}:${image.tag}**: used by ${image.containers} container(s), size ${image.size}`
      ),
  ].join("\n");
};

const MAX_CONTEXT_ANSWER_CHARS = 4_000;
const MAX_SECTION_BODY_CHARS = 2_800;

const CONTEXT_QUERY_STOP_WORDS = new Set([
  "about",
  "does",
  "from",
  "have",
  "how",
  "oxidock",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
]);

type MarkdownSection = {
  title: string;
  level: number;
  body: string;
};

const getContextQueryTokens = (question: string): string[] =>
  question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !CONTEXT_QUERY_STOP_WORDS.has(token));

const parseMarkdownSections = (text: string): MarkdownSection[] => {
  const lines = text.trim().split("\n");
  const sections: MarkdownSection[] = [];
  let preamble: string[] = [];
  let current: MarkdownSection | null = null;

  const flushCurrent = () => {
    if (current) {
      sections.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushCurrent();
      if (sections.length === 0 && preamble.length > 0) {
        sections.push({
          level: 0,
          title: "Introduction",
          body: preamble.join("\n").trim(),
        });
        preamble = [];
      }
      current = {
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        body: "",
      };
      continue;
    }

    if (current) {
      current.body = current.body ? `${current.body}\n${line}` : line;
    } else {
      preamble.push(line);
    }
  }

  flushCurrent();

  if (sections.length === 0) {
    return [{ level: 0, title: "Document", body: text.trim() }];
  }

  if (preamble.length > 0 && sections[0]?.level !== 0) {
    sections.unshift({
      level: 0,
      title: "Introduction",
      body: preamble.join("\n").trim(),
    });
  }

  return sections;
};

const scoreContextSection = (section: MarkdownSection, tokens: string[]): number => {
  const haystack = `${section.title} ${section.body}`.toLowerCase();
  let score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);

  if (
    tokens.includes("architecture") &&
    /\b(architecture|stack|tauri|bollard|flowchart|backend|frontend)\b/i.test(haystack)
  ) {
    score += 4;
  }
  if (tokens.includes("feature") && /\b(feature|capabilities)\b/i.test(haystack)) {
    score += 3;
  }
  if (tokens.includes("setup") && /\b(requirement|install|development|dev)\b/i.test(haystack)) {
    score += 3;
  }

  if (section.title && tokens.some((token) => section.title.toLowerCase().includes(token))) {
    score += 2;
  }

  return score;
};

const truncateSectionBody = (body: string, max = MAX_SECTION_BODY_CHARS): string => {
  const trimmed = body.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }

  const cut = trimmed.slice(0, max);
  const lastParagraph = cut.lastIndexOf("\n\n");
  if (lastParagraph > max * 0.5) {
    return `${cut.slice(0, lastParagraph).trim()}\n\n…`;
  }

  return `${cut.trim()}…`;
};

const buildContextQuestionAnswer = (currentRequest: string, pastedContext: string): string => {
  const tokens = getContextQueryTokens(currentRequest);
  const sections = parseMarkdownSections(pastedContext);
  const scored = sections
    .map((section) => ({ section, score: scoreContextSection(section, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected =
    scored.length > 0 ? scored.slice(0, 3) : sections.slice(0, 2).map((section) => ({ section, score: 1 }));

  const topic = currentRequest.replace(/\?+\s*$/, "").trim();
  const parts = selected.map(({ section }) => {
    const body = truncateSectionBody(section.body);
    if (section.level > 0 && section.title) {
      return `### ${section.title}\n\n${body}`;
    }
    return body;
  });

  let answer = [`From the pasted context, here is the relevant material for **${topic}**:`, "", ...parts].join("\n\n");

  if (answer.length > MAX_CONTEXT_ANSWER_CHARS) {
    answer = `${answer.slice(0, MAX_CONTEXT_ANSWER_CHARS - 1).trim()}…`;
  }

  return answer;
};

const buildContextSummaryAnswer = (pastedContext: string | undefined): string => {
  if (!pastedContext?.trim()) {
    return OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE;
  }

  const sections = parseMarkdownSections(pastedContext);
  const titleSection = sections.find((section) => section.level === 1) ?? sections[0];
  const title = titleSection?.title ?? "the pasted document";
  const introduction =
    sections.find((section) => section.level === 0)?.body.trim() ??
    sections.find((section) => section.level <= 1 && section.body.trim())?.body.trim() ??
    "";
  const outline = sections.filter((section) => section.level >= 2).map((section) => `- **${section.title}**`);

  const introExcerpt = introduction ? truncateSectionBody(introduction, 900) : "";

  return [
    `Here is a concise summary of **${title}** from the pasted context:`,
    "",
    introExcerpt || "No introduction paragraph was found in the pasted text.",
    outline.length > 0 ? ["", "Main sections:", ...outline].join("\n") : "",
    "",
    "Ask a follow-up if you want details on architecture, setup, or a comparison with your local Docker state.",
  ]
    .filter(Boolean)
    .join("\n");
};

const buildContextCompareAnswer = (snapshot: AppInsightsContextSnapshot, pastedContext: string | undefined): string => {
  if (!pastedContext?.trim()) {
    return OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE;
  }

  const running = snapshot.containers.filter((container) => container.state.toLowerCase() === "running");
  const referencedImages = snapshot.images.filter((image) =>
    pastedContext.toLowerCase().includes(image.repository.toLowerCase())
  );

  return [
    "Here is a quick comparison between your pasted context and the current local Docker snapshot:",
    "",
    `- **Running containers**: ${running.length} of ${snapshot.containers.length}`,
    `- **Images in snapshot**: ${snapshot.images.length}`,
    referencedImages.length > 0
      ? `- **Images mentioned in pasted context that match locally**: ${referencedImages
          .slice(0, 5)
          .map((image) => `${image.repository}:${image.tag}`)
          .join(", ")}`
      : "- **Images mentioned in pasted context**: none matched exactly in the current snapshot",
    "",
    "Review service names, image tags, and ports in the pasted context against the containers and networks shown in Oxidock.",
  ].join("\n");
};

const buildCleanupAnswer = (snapshot: AppInsightsContextSnapshot): string => {
  const danglingImages = snapshot.images.filter((image) => image.repository === "<none>" || image.tag === "<none>");
  const unattachedImages = snapshot.images.filter((image) => image.containers === 0);

  if (danglingImages.length === 0 && unattachedImages.length === 0) {
    return "I do not see obvious image cleanup candidates in the current snapshot. Avoid broad prune commands unless you have reviewed stopped containers and unused volumes.";
  }

  return [
    `I found **${danglingImages.length} dangling image layer(s)** and **${unattachedImages.length} image(s) not attached to containers**.`,
    "",
    "Review these before deleting anything:",
    ...unattachedImages
      .slice(0, 5)
      .map(
        (image) => `- **${image.repository}:${image.tag}**: ${image.size}, used by ${image.containers} container(s)`
      ),
  ].join("\n");
};

const buildEventAnswer = (snapshot: AppInsightsContextSnapshot): string => {
  if (snapshot.recentEvents.length === 0) {
    return "I do not see recent Docker events in the current snapshot.";
  }

  const suspiciousEvents = snapshot.recentEvents.filter((event) => /die|oom|kill|destroy|error/i.test(event.action));
  const latest = snapshot.recentEvents[0];

  return [
    suspiciousEvents.length > 0
      ? `The recent event stream includes **${suspiciousEvents.length} suspicious event(s)**. The latest notable one is **${suspiciousEvents[0]?.action}** on **${suspiciousEvents[0]?.actorName || "a Docker resource"}**.`
      : `The latest Docker event is **${latest.action}** on **${latest.actorName || "a Docker resource"}**.`,
    "",
    "Recent events:",
    ...snapshot.recentEvents
      .slice(0, 5)
      .map((event) => `- **${event.action}** on ${event.actorName || event.typ} at ${event.time}`),
  ].join("\n");
};

const buildVolumeAnswer = (snapshot: AppInsightsContextSnapshot): string => {
  if (snapshot.volumes.length === 0) {
    return "I do not see Docker volumes in the current snapshot.";
  }

  return [
    `I found **${snapshot.volumes.length} volume(s)** in the current snapshot. The snapshot includes volume metadata, but not enough attachment detail to safely say which are unused.`,
    "",
    "Visible volumes:",
    ...snapshot.volumes.slice(0, 5).map((volume) => `- **${volume.name}** (${volume.driver}, ${volume.scope})`),
  ].join("\n");
};

const buildNetworkAnswer = (snapshot: AppInsightsContextSnapshot): string => {
  if (snapshot.networks.length === 0) {
    return "I do not see Docker networks in the current snapshot.";
  }

  const busiest = [...snapshot.networks].sort((a, b) => b.containerCount - a.containerCount)[0];

  return [
    `I found **${snapshot.networks.length} network(s)**. The busiest one is **${busiest.name}** with **${busiest.containerCount} container(s)** attached.`,
    "",
    "Visible networks:",
    ...snapshot.networks
      .slice(0, 5)
      .map((network) => `- **${network.name}** (${network.driver}): ${network.containerCount} container(s)`),
  ].join("\n");
};

const buildMemoryAnswer = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[],
  question: string
): string => {
  const explicitContainers = findExplicitContainersForQuestion(question, snapshot.containers);
  const memoryContainers = explicitContainers.length > 0 ? explicitContainers : snapshot.containers;
  const memoryRankings = memoryContainers
    .map((container) => ({
      container,
      memoryPercent: parsePercent(container.memoryPercent),
    }))
    .filter(
      (entry): entry is { container: AppInsightsContainerSnapshot; memoryPercent: number } =>
        entry.memoryPercent != null
    )
    .sort((a, b) => b.memoryPercent - a.memoryPercent);
  const oomInsights = insights.filter((insight) => insight.id.startsWith("oom-"));

  if (memoryRankings.length > 0) {
    const [top] = memoryRankings;
    const lines = [
      explicitContainers.length > 0
        ? `**${top.container.name}** is using **${top.container.memoryPercent}** of its configured memory limit.`
        : `**${top.container.name}** is using the most memory right now at **${top.container.memoryPercent}** of its configured limit.`,
      "",
      explicitContainers.length > 0 ? "Matching memory usage:" : "Top memory users:",
      ...memoryRankings
        .slice(0, 5)
        .map(({ container }) => `- **${container.name}**: ${container.memoryPercent} (${container.status})`),
    ];

    if (oomInsights.length > 0) {
      lines.push(
        "",
        `Also worth noting: ${oomInsights
          .slice(0, 3)
          .map((insight) => `**${insight.title}**`)
          .join(", ")}. Exit code 137 usually points to a past OOM kill.`
      );
    }

    return lines.join("\n");
  }

  if (oomInsights.length > 0) {
    return [
      explicitContainers.length > 0
        ? "I could not rank current memory usage for the matching container because the snapshot does not include live memory stats, but I did find OOM/137 history."
        : "I could not rank current memory usage because the snapshot does not include live memory stats, but I did find containers with OOM/137 history.",
      "",
      ...oomInsights.slice(0, 5).map(formatInsightBullet),
    ].join("\n");
  }

  return "I could not find current per-container memory stats in this snapshot. The safest next step is to run `docker stats --no-stream` and compare the memory column.";
};

const matchDocsForQuestion = (question: string): DockerCommandMetadata[] => {
  const { suggestions } = getIntentSuggestions(question, MAX_MATCHED_DOCS);
  if (suggestions.length > 0) {
    return suggestions
      .map((item) => (item.registryId ? getDockerCommand(item.registryId) : null))
      .filter((command): command is DockerCommandMetadata => command != null);
  }

  const normalized = question.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return dockerCommandList
    .filter((command) => {
      const haystack = [command.label, command.explanation, ...command.intents].join(" ").toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, MAX_MATCHED_DOCS);
};

const findContainersForQuestion = (
  question: string,
  containers: AppInsightsContainerSnapshot[]
): AppInsightsContainerSnapshot[] => {
  const tokens = question
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const scored = containers
    .map((container) => {
      const haystack = `${container.name} ${container.image} ${container.project ?? ""}`.toLowerCase();
      const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);
      return { container, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, 2).map((entry) => entry.container);
  }

  return containers.filter((container) => /restart|exit|oom|137/i.test(container.status)).slice(0, 1);
};

export const collectAppInsightsContext = async ({
  question,
  intent: explicitIntent,
  dockerStatus: initialStatus,
  signal,
}: CollectAppInsightsContextOptions): Promise<AppInsightsContextSnapshot> => {
  if (signal?.aborted) {
    throw new DOMException("Context collection aborted", "AbortError");
  }

  const resolved = resolveAssistantIntent(question, explicitIntent);
  const intent = resolved.intent;
  const currentRequest = resolved.currentRequest || question;
  const needsContainerStats =
    intent === "diagnose_container" ||
    intent === "explain_memory" ||
    intent === "compare_context_to_state" ||
    intent === "suggest_next_step";
  const needsLogs =
    intent === "diagnose_container" || intent === "suggest_next_step" || /\b(log|logs)\b/i.test(currentRequest);
  const needsImages =
    intent === "explain_images" || intent === "list_cleanup_candidates" || intent === "compare_context_to_state";
  const needsContextOnly = intent === "summarize_context" || intent === "explain_context";
  const needsVolumes = intent === "explain_volumes" || intent === "list_cleanup_candidates";
  const needsNetworks = intent === "explain_networks" || intent === "compare_context_to_state";
  const needsEvents = intent === "explain_events" || intent === "diagnose_container" || intent === "suggest_next_step";

  const status = initialStatus ?? (await fetchDockerStatus());
  const emptySnapshot: AppInsightsContextSnapshot = {
    collectedAt: new Date().toISOString(),
    docker: {
      isRunning: status.isRunning,
      engineState: status.engineState,
      message: status.message,
      serverVersion: status.serverVersion,
      providerName: status.providerName,
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
  };

  if (!status.isRunning) {
    emptySnapshot.matchedDocs = matchDocsForQuestion(currentRequest).map((doc) => ({
      id: doc.id,
      label: doc.label,
      example: doc.example,
      risk: doc.risk,
    }));
    return emptySnapshot;
  }

  const [containers, images, volumes, networks, events] = await Promise.all([
    needsContextOnly ? Promise.resolve([]) : fetchContainers(true),
    needsImages ? fetchImages() : Promise.resolve([]),
    needsVolumes ? fetchVolumes() : Promise.resolve([]),
    needsNetworks ? fetchNetworks() : Promise.resolve([]),
    needsEvents ? fetchDockerEvents() : Promise.resolve([]),
  ]);

  if (signal?.aborted) {
    throw new DOMException("Context collection aborted", "AbortError");
  }

  const limitedContainers = containers.slice(0, MAX_CONTAINERS);
  const runningIds = limitedContainers
    .filter((container) => container.state.toLowerCase() === "running")
    .map((container) => container.id)
    .slice(0, needsContainerStats ? STATS_CONTAINER_LIMIT : 0);

  const stats = runningIds.length > 0 ? await fetchContainerStats(runningIds).catch(() => []) : [];
  const statsById = new Map(stats.map((entry) => [entry.id, entry]));

  const containerSnapshots: AppInsightsContainerSnapshot[] = limitedContainers.map((container) => {
    const stat = statsById.get(container.id);
    return {
      id: container.id,
      shortId: container.shortId,
      name: container.name,
      image: container.image,
      state: container.state,
      status: container.status,
      project: container.project,
      service: container.service,
      cpuPercent: stat?.cpuPercent,
      memoryPercent: stat?.memoryPercent,
    };
  });

  const logTargets = needsLogs ? findContainersForQuestion(currentRequest, containerSnapshots) : [];
  const logExcerpts: AppInsightsContextSnapshot["logExcerpts"] = [];

  for (const target of logTargets) {
    if (signal?.aborted) {
      throw new DOMException("Context collection aborted", "AbortError");
    }

    try {
      const { logs } = await fetchContainerLogs(target.id);
      if (logs.trim()) {
        logExcerpts.push({
          containerName: target.name,
          excerpt: truncate(logs.trim(), MAX_LOG_EXCERPT_CHARS),
        });
      }
    } catch {
      // Skip log fetch failures — insights can still use status/events.
    }
  }

  const running = containerSnapshots.filter((c) => c.state.toLowerCase() === "running").length;
  const exited = containerSnapshots.filter((c) => c.state.toLowerCase() !== "running").length;

  return {
    collectedAt: new Date().toISOString(),
    docker: emptySnapshot.docker,
    counts: {
      containers: containerSnapshots.length,
      running,
      exited,
      images: images.length,
      volumes: volumes.length,
      networks: networks.length,
    },
    containers: containerSnapshots,
    images: images.slice(0, MAX_IMAGES).map((image) => ({
      repository: image.repository,
      tag: image.tag,
      size: image.size,
      containers: image.containers,
    })),
    volumes: volumes.slice(0, MAX_VOLUMES).map((volume) => ({
      name: volume.name,
      driver: volume.driver,
      scope: volume.scope,
    })),
    networks: networks.slice(0, MAX_NETWORKS).map((network) => ({
      name: network.name,
      driver: network.driver,
      containerCount: network.containerCount,
    })),
    recentEvents: events.slice(0, MAX_EVENTS).map((event) => ({
      time: event.time,
      action: event.action,
      actorName: event.actorName,
      typ: event.typ,
    })),
    matchedDocs: matchDocsForQuestion(currentRequest).map((doc) => ({
      id: doc.id,
      label: doc.label,
      example: doc.example,
      risk: doc.risk,
    })),
    logExcerpts,
  };
};

export const buildDeterministicInsights = (snapshot: AppInsightsContextSnapshot): DeterministicInsight[] => {
  const insights: DeterministicInsight[] = [];

  if (!snapshot.docker.isRunning) {
    insights.push({
      id: "engine-stopped",
      severity: "warning",
      title: "Docker engine is not reachable",
      detail: snapshot.docker.message,
      sourceIds: ["engine"],
    });
    return insights;
  }

  for (const container of snapshot.containers) {
    const sourceId = `container:${container.shortId}`;
    const statusLower = container.status.toLowerCase();
    const stateLower = container.state.toLowerCase();

    if (statusLower.includes("137") || statusLower.includes("oom")) {
      insights.push({
        id: `oom-${container.shortId}`,
        severity: "critical",
        title: `${container.name} may have been OOM-killed`,
        detail: `Status: ${container.status}. Exit code 137 often means the kernel killed the process for high memory use.`,
        sourceIds: [sourceId],
        suggestedCommand: `docker update --memory=1g --memory-swap=2g ${container.name}`,
      });
    }

    if (/restart/i.test(statusLower) || stateLower === "restarting") {
      insights.push({
        id: `restart-${container.shortId}`,
        severity: "warning",
        title: `${container.name} is restarting`,
        detail: container.status,
        sourceIds: [sourceId],
        suggestedCommand: `docker logs --tail 50 ${container.name}`,
      });
    }

    if (stateLower === "exited" || statusLower.includes("exited")) {
      insights.push({
        id: `exited-${container.shortId}`,
        severity: "info",
        title: `${container.name} is not running`,
        detail: container.status,
        sourceIds: [sourceId],
        suggestedCommand: `docker logs --tail 50 ${container.name}`,
      });
    }

    const memoryPercent = parsePercent(container.memoryPercent);
    if (memoryPercent != null && memoryPercent >= 85) {
      insights.push({
        id: `mem-${container.shortId}`,
        severity: "warning",
        title: `${container.name} is using ${memoryPercent.toFixed(0)}% of its memory limit`,
        detail: `Current usage: ${container.memoryPercent ?? "unknown"}.`,
        sourceIds: [sourceId],
      });
    }

    const cpuPercent = parsePercent(container.cpuPercent);
    if (cpuPercent != null && cpuPercent >= 90) {
      insights.push({
        id: `cpu-${container.shortId}`,
        severity: "warning",
        title: `${container.name} CPU is elevated`,
        detail: `Current CPU: ${container.cpuPercent ?? "unknown"}.`,
        sourceIds: [sourceId],
      });
    }
  }

  const danglingImages = snapshot.images.filter((image) => image.repository === "<none>" || image.tag === "<none>");
  if (danglingImages.length > 0) {
    insights.push({
      id: "dangling-images",
      severity: "info",
      title: `${danglingImages.length} dangling image layer(s)`,
      detail: "Untagged images can be reclaimed safely after review.",
      sourceIds: danglingImages.map((_, index) => `image:dangling-${index}`),
      suggestedCommand: "docker image prune",
    });
  }

  const errorEvents = snapshot.recentEvents.filter((event) => /die|oom|kill|destroy|error/i.test(event.action));
  if (errorEvents.length > 0) {
    const latest = errorEvents[0];
    insights.push({
      id: "recent-error-events",
      severity: "warning",
      title: "Recent Docker events need attention",
      detail: `${latest.action} on ${latest.actorName || "resource"} at ${latest.time}`,
      sourceIds: ["events"],
    });
  }

  return insights;
};

export const buildDeterministicAnswer = (
  snapshot: AppInsightsContextSnapshot,
  insights: DeterministicInsight[],
  question: string,
  options?: { intent?: AssistantIntent; pastedContext?: string; hasConversationContext?: boolean }
): string => {
  const resolved = resolveAssistantIntent(question, options?.intent, options?.hasConversationContext ?? false);
  const { intent, pastedContext } = resolved;
  const effectivePastedContext = options?.pastedContext ?? pastedContext;

  if (intent === "out_of_scope") {
    return OXIDOCK_ASSISTANT_SCOPE_MESSAGE;
  }

  if (intent === "clarify") {
    return effectivePastedContext?.trim()
      ? OXIDOCK_ASSISTANT_CLARIFY_MESSAGE
      : OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE;
  }

  if (intent === "explain_context") {
    return effectivePastedContext?.trim()
      ? buildContextQuestionAnswer(resolved.currentRequest || question, effectivePastedContext)
      : OXIDOCK_ASSISTANT_VAGUE_FOLLOWUP_MESSAGE;
  }

  if (intent === "summarize_context") {
    return buildContextSummaryAnswer(effectivePastedContext);
  }

  if (!snapshot.docker.isRunning) {
    const lines: string[] = [];
    lines.push("Docker does not appear to be running on this machine. Start your container engine, then ask again.");
    if (snapshot.matchedDocs.length > 0) {
      lines.push("", `Related docs: ${snapshot.matchedDocs.map((doc) => doc.label).join(", ")}.`);
    }
    return lines.join("\n");
  }

  switch (intent) {
    case "compare_context_to_state":
      return buildContextCompareAnswer(snapshot, effectivePastedContext);
    case "explain_memory":
      return buildMemoryAnswer(snapshot, insights, question);
    case "explain_images":
    case "list_cleanup_candidates":
      return buildImageAnswer(snapshot, intent);
    case "explain_events":
      return buildEventAnswer(snapshot);
    case "explain_volumes":
      return buildVolumeAnswer(snapshot);
    case "explain_networks":
      return buildNetworkAnswer(snapshot);
    default:
      break;
  }

  const relevantInsights = filterInsightsForQuestion(insights, question, snapshot, intent);

  if (relevantInsights.length === 0) {
    return `I do not see an obvious issue in the current snapshot: ${snapshot.counts.running} of ${snapshot.counts.containers} containers are running, and Docker is reachable.`;
  }

  const sortedInsights = sortInsightsBySeverity(relevantInsights);
  const primary = sortedInsights[0];
  const lines = [
    `The main thing I found is **${primary.title}**. ${primary.detail}`,
    "",
    "Most relevant findings:",
    ...sortedInsights.slice(0, 4).map(formatInsightBullet),
  ];

  if (snapshot.logExcerpts.length > 0) {
    lines.push("", "I also found relevant logs; they are shown in the log excerpt panel below.");
  }

  return lines.join("\n");
};

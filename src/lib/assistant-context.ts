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

const isMemoryQuestion = (question: string): boolean => /\b(memory|mem|ram)\b/i.test(question);
const isImageQuestion = (question: string): boolean =>
  /\b(image|images|dangling|cleanup|clean up|prune|disk|space|delete|deleting|remove|resources|reclaim|free)\b/i.test(
    question
  );
const isCleanupQuestion = (question: string): boolean =>
  /\b(cleanup|clean up|prune|delete|deleting|remove|resources|reclaim|free)\b/i.test(question);
const isEventQuestion = (question: string): boolean =>
  /\b(event|events|recent|history|happened|timeline)\b/i.test(question);
const isVolumeQuestion = (question: string): boolean => /\b(volume|volumes)\b/i.test(question);
const isNetworkQuestion = (question: string): boolean =>
  /\b(network|networks|port|ports|connect|connection)\b/i.test(question);
const isFailureQuestion = (question: string): boolean =>
  /\b(restart|restarting|crash|exited|exit|failed|down|unhealthy|oom|137|killed|log|logs)\b/i.test(question);

const insightRank: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const sortInsightsBySeverity = (insights: DeterministicInsight[]): DeterministicInsight[] =>
  [...insights].sort((a, b) => insightRank[a.severity] - insightRank[b.severity]);

const formatInsightBullet = (insight: DeterministicInsight): string => `- **${insight.title}**: ${insight.detail}`;

export const filterInsightsForQuestion = (
  insights: DeterministicInsight[],
  question: string
): DeterministicInsight[] => {
  if (isImageQuestion(question)) {
    return insights.filter((insight) => insight.id === "dangling-images");
  }

  if (isEventQuestion(question)) {
    return insights.filter((insight) => insight.id === "recent-error-events");
  }

  if (isFailureQuestion(question)) {
    return insights.filter(
      (insight) =>
        insight.id.startsWith("oom-") ||
        insight.id.startsWith("restart-") ||
        insight.id.startsWith("exited-") ||
        insight.id === "recent-error-events"
    );
  }

  return insights;
};

const buildImageAnswer = (snapshot: AppInsightsContextSnapshot, question: string): string => {
  const danglingImages = snapshot.images.filter((image) => image.repository === "<none>" || image.tag === "<none>");
  const attachedImages = snapshot.images.filter((image) => image.containers > 0);
  const unattachedImages = snapshot.images.filter((image) => image.containers === 0);

  if (isCleanupQuestion(question)) {
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

const buildMemoryAnswer = (snapshot: AppInsightsContextSnapshot, insights: DeterministicInsight[]): string => {
  const memoryRankings = snapshot.containers
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
      `**${top.container.name}** is using the most memory right now at **${top.container.memoryPercent}** of its configured limit.`,
      "",
      "Top memory users:",
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
      "I could not rank current memory usage because the snapshot does not include live memory stats, but I did find containers with OOM/137 history.",
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
  dockerStatus: initialStatus,
  signal,
}: CollectAppInsightsContextOptions): Promise<AppInsightsContextSnapshot> => {
  if (signal?.aborted) {
    throw new DOMException("Context collection aborted", "AbortError");
  }

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
    emptySnapshot.matchedDocs = matchDocsForQuestion(question).map((doc) => ({
      id: doc.id,
      label: doc.label,
      example: doc.example,
      risk: doc.risk,
    }));
    return emptySnapshot;
  }

  const [containers, images, volumes, networks, events] = await Promise.all([
    fetchContainers(true),
    fetchImages(),
    fetchVolumes(),
    fetchNetworks(),
    fetchDockerEvents(),
  ]);

  if (signal?.aborted) {
    throw new DOMException("Context collection aborted", "AbortError");
  }

  const limitedContainers = containers.slice(0, MAX_CONTAINERS);
  const runningIds = limitedContainers
    .filter((container) => container.state.toLowerCase() === "running")
    .map((container) => container.id)
    .slice(0, STATS_CONTAINER_LIMIT);

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

  const logTargets = findContainersForQuestion(question, containerSnapshots);
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
    matchedDocs: matchDocsForQuestion(question).map((doc) => ({
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
  question: string
): string => {
  const trimmedQuestion = question.trim();

  if (!snapshot.docker.isRunning) {
    const lines: string[] = [];
    lines.push("Docker does not appear to be running on this machine. Start your container engine, then ask again.");
    if (snapshot.matchedDocs.length > 0) {
      lines.push("", `Related docs: ${snapshot.matchedDocs.map((doc) => doc.label).join(", ")}.`);
    }
    return lines.join("\n");
  }

  if (isMemoryQuestion(trimmedQuestion)) {
    return buildMemoryAnswer(snapshot, insights);
  }

  if (isImageQuestion(trimmedQuestion)) {
    return buildImageAnswer(snapshot, trimmedQuestion);
  }

  if (isEventQuestion(trimmedQuestion)) {
    return buildEventAnswer(snapshot);
  }

  if (isVolumeQuestion(trimmedQuestion)) {
    return buildVolumeAnswer(snapshot);
  }

  if (isNetworkQuestion(trimmedQuestion)) {
    return buildNetworkAnswer(snapshot);
  }

  const relevantInsights = filterInsightsForQuestion(insights, trimmedQuestion);

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

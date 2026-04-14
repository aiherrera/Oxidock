import { formatFormattedBytes, parseFormattedBytes } from "./format-bytes";
import type {
  ContainerInfo,
  ContainerStatsInfo,
  ContainerTableRow,
  ProjectHealth,
  ProjectTableRow,
  TableRow,
} from "../types/docker";

export const normalizeState = (state: string) => state.toLowerCase();

export const isRunning = (container: ContainerInfo) => normalizeState(container.state) === "running";

export const isExited = (container: ContainerInfo) => {
  const state = normalizeState(container.state);
  return state === "exited" || state === "dead" || state === "created";
};

const EMPTY_STATS: ContainerStatsInfo = {
  id: "",
  cpuPercent: "0%",
  memoryUsage: "0B / 0B",
  memoryPercent: "0%",
  diskReadWrite: "0B / 0B",
  networkIo: "0B / 0B",
  pids: "0",
};

export const emptyStats = (): ContainerStatsInfo => ({ ...EMPTY_STATS });

export const filterContainers = (
  containers: ContainerInfo[],
  options: {
    showAll: boolean;
    query: string;
  }
) => {
  const query = options.query.trim().toLowerCase();

  return containers.filter((container) => {
    if (!options.showAll && !isRunning(container)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      container.name.toLowerCase().includes(query) ||
      container.shortId.toLowerCase().includes(query) ||
      container.id.toLowerCase().includes(query) ||
      container.image.toLowerCase().includes(query) ||
      (container.project?.toLowerCase().includes(query) ?? false) ||
      (container.service?.toLowerCase().includes(query) ?? false)
    );
  });
};

export const countRunning = (containers: ContainerInfo[]) => containers.filter(isRunning).length;

export const getProjectHealth = (containers: ContainerInfo[]): ProjectHealth => {
  if (containers.length === 0) {
    return "stopped";
  }

  const runningCount = containers.filter(isRunning).length;

  if (runningCount === containers.length) {
    return "healthy";
  }

  if (runningCount === 0) {
    return "stopped";
  }

  return "partial";
};

export const getContainerHealth = (container: ContainerInfo): ProjectHealth =>
  isRunning(container) ? "healthy" : "stopped";

export const parseStatsPercent = (value: string) => {
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePercent = parseStatsPercent;

const parseBytesPair = (value: string) => {
  const [left = "0B", right = "0B"] = value.split("/").map((part) => part.trim());
  return {
    leftBytes: parseFormattedBytes(left),
    rightBytes: parseFormattedBytes(right),
  };
};

const parseIoPair = (value: string) => {
  const [left = "0B", right = "0B"] = value.split("/").map((part) => part.trim());
  return {
    leftBytes: parseFormattedBytes(left),
    rightBytes: parseFormattedBytes(right),
  };
};

const sumPair = (parts: { leftBytes: number; rightBytes: number }[]) =>
  parts.reduce(
    (totals, part) => ({
      leftBytes: totals.leftBytes + part.leftBytes,
      rightBytes: totals.rightBytes + part.rightBytes,
    }),
    { leftBytes: 0, rightBytes: 0 }
  );

export const aggregateStats = (
  containers: ContainerInfo[],
  statsById: Map<string, ContainerStatsInfo>
): ContainerStatsInfo | null => {
  const stats = containers
    .map((container) => statsById.get(container.id))
    .filter((entry): entry is ContainerStatsInfo => Boolean(entry));

  if (stats.length === 0) {
    return null;
  }

  const cpuTotal = stats.reduce((total, entry) => total + parsePercent(entry.cpuPercent), 0);
  const memoryPercentTotal = stats.reduce((total, entry) => total + parsePercent(entry.memoryPercent), 0);

  const memoryParts = stats.map((entry) => parseBytesPair(entry.memoryUsage));
  const diskParts = stats.map((entry) => parseIoPair(entry.diskReadWrite));
  const networkParts = stats.map((entry) => parseIoPair(entry.networkIo));
  const pidsTotal = stats.reduce((total, entry) => total + Number.parseInt(entry.pids, 10), 0);

  const memoryTotals = sumPair(memoryParts);
  const diskTotals = sumPair(diskParts);
  const networkTotals = sumPair(networkParts);
  const memoryPercent =
    memoryTotals.rightBytes > 0
      ? `${((memoryTotals.leftBytes / memoryTotals.rightBytes) * 100).toFixed(2)}%`
      : `${(memoryPercentTotal / stats.length).toFixed(2)}%`;

  return {
    id: "",
    cpuPercent: `${cpuTotal.toFixed(2)}%`,
    memoryUsage: `${formatFormattedBytes(memoryTotals.leftBytes)} / ${formatFormattedBytes(memoryTotals.rightBytes)}`,
    memoryPercent,
    diskReadWrite: `${formatFormattedBytes(diskTotals.leftBytes)} / ${formatFormattedBytes(diskTotals.rightBytes)}`,
    networkIo: `${formatFormattedBytes(networkTotals.leftBytes)} / ${formatFormattedBytes(networkTotals.rightBytes)}`,
    pids: Number.isFinite(pidsTotal) ? String(pidsTotal) : "0",
  };
};

export const buildTableRows = (
  containers: ContainerInfo[],
  options: {
    statsById: Map<string, ContainerStatsInfo>;
    expandedProjects: Set<string>;
  }
): TableRow[] => {
  const standalone: ContainerInfo[] = [];
  const projects = new Map<string, ContainerInfo[]>();

  for (const container of containers) {
    if (container.project) {
      const group = projects.get(container.project) ?? [];
      group.push(container);
      projects.set(container.project, group);
    } else {
      standalone.push(container);
    }
  }

  const rows: TableRow[] = [];

  const sortedProjects = [...projects.entries()].sort(([left], [right]) => left.localeCompare(right));

  for (const [project, projectContainers] of sortedProjects) {
    const sortedContainers = [...projectContainers].sort((left, right) =>
      (left.service ?? left.name).localeCompare(right.service ?? right.name)
    );
    const expanded = options.expandedProjects.has(project);

    rows.push({
      kind: "project",
      project,
      containers: sortedContainers,
      health: getProjectHealth(sortedContainers),
      stats: aggregateStats(sortedContainers, options.statsById),
      expanded,
    });

    if (expanded) {
      for (const container of sortedContainers) {
        rows.push({
          kind: "container",
          container,
          stats: options.statsById.get(container.id) ?? null,
          depth: 1,
        });
      }
    }
  }

  const sortedStandalone = [...standalone].sort((left, right) => left.name.localeCompare(right.name));

  for (const container of sortedStandalone) {
    rows.push({
      kind: "container",
      container,
      stats: options.statsById.get(container.id) ?? null,
      depth: 0,
    });
  }

  return rows;
};

export const flattenVisibleContainers = (rows: TableRow[]) =>
  rows.flatMap((row) => {
    if (row.kind === "project") {
      return row.expanded ? row.containers : [];
    }

    return [row.container];
  });

export type { ContainerTableRow, ProjectTableRow };

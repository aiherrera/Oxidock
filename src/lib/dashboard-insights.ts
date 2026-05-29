import { isExited, isRunning } from "./container-utils";
import type { AppPage } from "../types/app";
import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";

export type DashboardInsightSeverity = "info" | "warning" | "critical";

export type DashboardInsightAction = { type: "navigate"; page: AppPage } | { type: "playground"; command: string };

export type DashboardInsight = {
  id: string;
  severity: DashboardInsightSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  action: DashboardInsightAction;
};

export type DashboardInsightSummary = {
  containers: ContainerInfo[];
  images: ImageInfo[];
  volumes: VolumeInfo[];
  networks: NetworkInfo[];
};

const BUILTIN_NETWORKS = new Set(["bridge", "host", "none"]);

const severityRank: Record<DashboardInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const isDanglingImage = (image: ImageInfo) => image.repository === "<none>" || image.tag === "<none>";

export const isBuiltInNetwork = (network: NetworkInfo) => BUILTIN_NETWORKS.has(network.name.toLowerCase());

const isFailedOrUnstableContainer = (container: ContainerInfo) => {
  const statusLower = container.status.toLowerCase();
  const stateLower = container.state.toLowerCase();

  return (
    stateLower === "restarting" ||
    /restart/i.test(statusLower) ||
    statusLower.includes("137") ||
    statusLower.includes("oom")
  );
};

const isStoppedContainer = (container: ContainerInfo) =>
  !isRunning(container) && isExited(container) && !isFailedOrUnstableContainer(container);

const formatStoppedDetail = (containers: ContainerInfo[]) => {
  if (containers.length === 0) {
    return "";
  }

  const sample = containers[0];
  const age = sample.lastStartedAt && sample.lastStartedAt !== "—" ? sample.lastStartedAt : sample.status;

  if (containers.length === 1) {
    return `${sample.name} has been stopped${age ? ` (${age})` : ""}. Review before removing.`;
  }

  return `${containers.length} containers are stopped. Oldest visible: ${sample.name}${age ? ` (${age})` : ""}.`;
};

const formatFailedDetail = (containers: ContainerInfo[]) => {
  const names = containers
    .slice(0, 3)
    .map((c) => c.name)
    .join(", ");
  const suffix = containers.length > 3 ? ` and ${containers.length - 3} more` : "";
  return `Check logs for: ${names}${suffix}.`;
};

export const buildDashboardInsights = (summary: DashboardInsightSummary): DashboardInsight[] => {
  const insights: DashboardInsight[] = [];

  const failedContainers = summary.containers.filter(isFailedOrUnstableContainer);
  if (failedContainers.length > 0) {
    const sample = failedContainers[0];
    insights.push({
      id: "failed-containers",
      severity: failedContainers.some(
        (c) => c.status.toLowerCase().includes("137") || c.status.toLowerCase().includes("oom")
      )
        ? "critical"
        : "warning",
      title:
        failedContainers.length === 1
          ? `${sample.name} needs attention`
          : `${failedContainers.length} containers need attention`,
      detail: formatFailedDetail(failedContainers),
      actionLabel: "Review logs in CLI",
      action: { type: "playground", command: `docker logs --tail 50 ${sample.name}` },
    });
  }

  const stoppedContainers = summary.containers.filter(isStoppedContainer);
  if (stoppedContainers.length > 0) {
    insights.push({
      id: "stopped-containers",
      severity: "info",
      title: stoppedContainers.length === 1 ? "1 stopped container" : `${stoppedContainers.length} stopped containers`,
      detail: formatStoppedDetail(stoppedContainers),
      actionLabel: "Review containers",
      action: { type: "navigate", page: "containers" },
    });
  }

  const danglingImages = summary.images.filter(isDanglingImage);
  if (danglingImages.length > 0) {
    insights.push({
      id: "dangling-images",
      severity: "info",
      title: danglingImages.length === 1 ? "1 dangling image" : `${danglingImages.length} dangling images`,
      detail: "Untagged image layers can be pruned after review to reclaim disk space.",
      actionLabel: "List dangling images",
      action: { type: "playground", command: "docker image ls --filter dangling=true" },
    });
  }

  const unusedImages = summary.images.filter((image) => image.containers === 0 && !isDanglingImage(image));
  if (unusedImages.length > 0) {
    insights.push({
      id: "unused-images",
      severity: "info",
      title: unusedImages.length === 1 ? "1 unused image" : `${unusedImages.length} unused images`,
      detail: "Images not used by any container may be safe to remove after you confirm they are not needed.",
      actionLabel: "Browse images",
      action: { type: "navigate", page: "images" },
    });
  }

  const emptyNetworks = summary.networks.filter(
    (network) => network.containerCount === 0 && !isBuiltInNetwork(network)
  );
  if (emptyNetworks.length > 0) {
    insights.push({
      id: "empty-networks",
      severity: "info",
      title: emptyNetworks.length === 1 ? "1 unused network" : `${emptyNetworks.length} unused networks`,
      detail: "Custom networks with no attached containers can often be removed after review.",
      actionLabel: "Review networks",
      action: { type: "navigate", page: "networks" },
    });
  }

  if (summary.volumes.length > 0) {
    insights.push({
      id: "volume-review",
      severity: "info",
      title: "Review volumes for cleanup",
      detail: `${summary.volumes.length} volume(s) on disk. Attachment usage is not shown here — inspect before pruning.`,
      actionLabel: "Check disk usage",
      action: { type: "playground", command: "docker system df -v" },
    });
  }

  return insights.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
};

export const insightSeverityClass = (severity: DashboardInsightSeverity) => {
  switch (severity) {
    case "critical":
      return "border-(--status-danger-border) bg-(--status-danger-bg)";
    case "warning":
      return "border-(--status-warning-border) bg-(--status-warning-bg)";
    default:
      return "border-(--status-info-border) bg-(--status-info-bg)";
  }
};

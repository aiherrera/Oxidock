import type { EngineLifecycleCapability } from "./engine";

export type EngineState = "running" | "paused" | "stopped" | "unavailable";

export type DockerStatus = {
  isRunning: boolean;
  engineState: EngineState;
  message: string;
  serverVersion: string | null;
  apiVersion: string | null;
  providerId: string | null;
  providerName: string;
  contextName: string | null;
  endpointLabel: string;
  lifecycleCapabilities: EngineLifecycleCapability[];
};

export type ContainerInfo = {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
  createdAt: string;
  project: string | null;
  service: string | null;
  command: string;
  lastStartedAt: string;
};

export type ContainerStatsInfo = {
  id: string;
  cpuPercent: string;
  memoryUsage: string;
  memoryPercent: string;
  diskReadWrite: string;
  networkIo: string;
  pids: string;
};

export type ContainerInspectDetail = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: string;
  ports: string[];
  networks: string[];
  mounts: string[];
  command: string;
  rawJson: string;
};

export type ContainerLogsResult = {
  logs: string;
};

export type ProjectHealth = "healthy" | "partial" | "stopped";

export type ContainerTableRow = {
  kind: "container";
  container: ContainerInfo;
  stats: ContainerStatsInfo | null;
  depth: number;
};

export type ProjectTableRow = {
  kind: "project";
  project: string;
  containers: ContainerInfo[];
  health: ProjectHealth;
  stats: ContainerStatsInfo | null;
  expanded: boolean;
};

export type TableRow = ContainerTableRow | ProjectTableRow;

export type ImageInfo = {
  id: string;
  shortId: string;
  repository: string;
  tag: string;
  size: string;
  createdAt: string;
  containers: number;
};

export type VolumeInfo = {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  labels: Record<string, string>;
};

export type NetworkInfo = {
  id: string;
  shortId: string;
  name: string;
  driver: string;
  scope: string;
  attachable: boolean;
  internal: boolean;
  containerCount: number;
};

export type DockerEventInfo = {
  time: string;
  typ: string;
  action: string;
  actorId: string;
  actorName: string;
  attributes: Record<string, string>;
};

export type DockerCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

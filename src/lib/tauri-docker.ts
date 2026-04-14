import { invoke } from "@tauri-apps/api/core";
import type {
  ContainerInfo,
  ContainerInspectDetail,
  ContainerLogsResult,
  ContainerStatsInfo,
  DockerCommandResult,
  DockerEventInfo,
  DockerStatus,
  ImageInfo,
  NetworkInfo,
  VolumeInfo,
} from "../types/docker";

export const fetchDockerStatus = () => invoke<DockerStatus>("get_docker_status");

export const fetchContainers = (all: boolean) => invoke<ContainerInfo[]>("get_containers", { all });

export const fetchContainerStats = (ids: string[]) => invoke<ContainerStatsInfo[]>("get_container_stats", { ids });

export const inspectContainer = (id: string) => invoke<ContainerInspectDetail>("inspect_container", { id });

export const fetchContainerLogs = (id: string) => invoke<ContainerLogsResult>("get_container_logs", { id });

export const startContainer = (id: string) => invoke<void>("start_container", { id });

export const stopContainer = (id: string) => invoke<void>("stop_container", { id });

export const restartContainer = (id: string) => invoke<void>("restart_container", { id });

export const removeContainer = (id: string, force = false) => invoke<void>("remove_container", { id, force });

export const fetchImages = () => invoke<ImageInfo[]>("get_images");

export const fetchVolumes = () => invoke<VolumeInfo[]>("get_volumes");

export const fetchNetworks = () => invoke<NetworkInfo[]>("get_networks");

export const fetchDockerEvents = () => invoke<DockerEventInfo[]>("get_docker_events");

export type RunDockerCommandOptions = {
  confirmDestructive?: boolean;
};

export const runDockerCommand = (command: string, options?: RunDockerCommandOptions) =>
  invoke<DockerCommandResult>("run_docker_command", {
    command,
    confirmDestructive: options?.confirmDestructive ?? false,
  });

export type CommandRiskLevel = "safe" | "medium" | "destructive";

export type CommandClassification = {
  normalized: string;
  risk: CommandRiskLevel;
  reasons: string[];
};

export const classifyDockerCommand = (command: string) =>
  invoke<CommandClassification>("classify_docker_command", { command });

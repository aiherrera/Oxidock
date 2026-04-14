import { invoke } from "@tauri-apps/api/core";
import type { DockerCommandRisk } from "./docker-command-registry";

export type LocalAiInstallState = "notInstalled" | "installing" | "installed" | "error";

export type LocalAiInstallProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

export type LocalAiAssistantStatus = {
  state: LocalAiInstallState;
  modelName: string;
  modelSizeLabel: string;
  message: string | null;
  progress?: LocalAiInstallProgress | null;
};

const DEFAULT_STATUS: LocalAiAssistantStatus = {
  state: "notInstalled",
  modelName: "oxidock-assist",
  modelSizeLabel: "~200 MB",
  message: null,
  progress: null,
};

export const defaultLocalAiAssistantStatus: LocalAiAssistantStatus = DEFAULT_STATUS;

export const getLocalAiAssistantStatus = async (): Promise<LocalAiAssistantStatus> =>
  invoke<LocalAiAssistantStatus>("get_ai_assistant_status");

export const installLocalAiAssistant = async (): Promise<LocalAiAssistantStatus> =>
  invoke<LocalAiAssistantStatus>("install_ai_assistant");

export const uninstallLocalAiAssistant = async (): Promise<LocalAiAssistantStatus> =>
  invoke<LocalAiAssistantStatus>("remove_ai_assistant");

export type AiCommandSuggestion = {
  id: string;
  label: string;
  completion: string;
  explanation: string;
  risk: DockerCommandRisk;
  confidence: number;
  source: "ai";
};

export type SuggestDockerCommandsResponse = {
  suggestions: AiCommandSuggestion[];
};

export const suggestDockerCommands = (input: string) =>
  invoke<SuggestDockerCommandsResponse>("suggest_docker_commands", {
    input,
  });

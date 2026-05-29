import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DockerCommandRisk } from "./docker-command-registry";

export const AI_ASSISTANT_INSTALL_STATUS_EVENT = "ai-assistant-install-status";

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
  modelSizeLabel: "~380 MB",
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

export const listenLocalAiAssistantInstallStatus = (
  onStatus: (status: LocalAiAssistantStatus) => void
): Promise<() => void> =>
  listen<LocalAiAssistantStatus>(AI_ASSISTANT_INSTALL_STATUS_EVENT, (event) => {
    onStatus(event.payload);
  });

export const getInvokeErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

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

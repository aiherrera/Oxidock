import {
  dockerCommandList,
  type DockerCommandId,
  type DockerCommandMetadata,
  type DockerCommandRisk,
} from "./docker-command-registry";

export type SuggestionSource = "registry" | "intent" | "ai";

export type CommandSuggestion = {
  id: string;
  label: string;
  completion: string;
  explanation: string;
  description: string;
  risk: DockerCommandRisk;
  score: number;
  source: SuggestionSource;
  registryId?: DockerCommandId;
};

export type SuggestionResult = {
  suggestions: CommandSuggestion[];
  inlineSuffix: string;
};

const normalizeInput = (value: string) => value.trim().toLowerCase();

export const stripDockerPrefix = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("docker ")) {
    return trimmed.slice(7);
  }
  if (trimmed.toLowerCase() === "docker") {
    return "";
  }
  return trimmed;
};

const tokenize = (value: string) => normalizeInput(stripDockerPrefix(value)).split(/\s+/).filter(Boolean);

const searchableText = (command: DockerCommandMetadata) => {
  const parts = [
    command.cli,
    command.label,
    command.explanation,
    command.description,
    command.example,
    ...command.aliases,
    ...command.intents,
    command.category,
  ];
  return normalizeInput(parts.join(" "));
};

const prefixScore = (input: string, command: DockerCommandMetadata): number => {
  const normalizedInput = normalizeInput(input);
  const cli = normalizeInput(command.cli);
  const example = normalizeInput(command.example);

  if (!normalizedInput) {
    return 1;
  }

  if (cli.startsWith(normalizedInput) || example.startsWith(normalizedInput)) {
    return 100 + (cli.length - normalizedInput.length);
  }

  const subcommand = stripDockerPrefix(command.cli);
  const inputSub = stripDockerPrefix(input);
  if (subcommand.toLowerCase().startsWith(inputSub.toLowerCase())) {
    return 80;
  }

  const tokens = tokenize(input);
  const haystack = searchableText(command);
  const allTokensMatch = tokens.every((token) => haystack.includes(token));
  if (allTokensMatch && tokens.length > 0) {
    return 50 + tokens.length * 5;
  }

  if (haystack.includes(normalizeInput(stripDockerPrefix(input)))) {
    return 30;
  }

  return 0;
};

const toSuggestion = (
  command: DockerCommandMetadata,
  score: number,
  source: SuggestionSource = "registry"
): CommandSuggestion => ({
  id: command.id,
  label: command.label,
  completion: command.example,
  explanation: command.explanation,
  description: command.description,
  risk: command.risk,
  score,
  source,
  registryId: command.id,
});

export const getCommandSuggestions = (input: string, limit = 8): SuggestionResult => {
  const trimmed = input.trim();
  const ranked = dockerCommandList
    .map((command) => ({
      command,
      score: prefixScore(trimmed, command),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const suggestions = ranked.map(({ command, score }) => toSuggestion(command, score, "registry"));

  const inlineSuffix = computeInlineSuffix(trimmed, suggestions[0]?.completion);

  return { suggestions, inlineSuffix };
};

export const computeInlineSuffix = (input: string, completion?: string): string => {
  if (!completion) {
    return "";
  }

  const normalizedInput = input;
  const normalizedCompletion = completion;

  if (normalizedCompletion.toLowerCase().startsWith(normalizedInput.toLowerCase())) {
    return normalizedCompletion.slice(normalizedInput.length);
  }

  return "";
};

export const applyCompletion = (input: string, completion: string): string => {
  const suffix = computeInlineSuffix(input, completion);
  if (suffix) {
    return input + suffix;
  }
  return completion;
};

export const isDockerCommandInput = (input: string): boolean => {
  const trimmed = input.trim().toLowerCase();
  return trimmed.startsWith("docker") || trimmed === "";
};

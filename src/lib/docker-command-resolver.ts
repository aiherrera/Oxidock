import { dockerCommandList, type DockerCommandId, type DockerCommandMetadata } from "./docker-command-registry";

const normalizeCommand = (value: string): string => value.trim().split(/\s+/).filter(Boolean).join(" ").toLowerCase();

const stripDockerPrefix = (value: string): string => {
  const normalized = normalizeCommand(value);
  if (normalized.startsWith("docker ")) {
    return normalized.slice(7);
  }
  if (normalized === "docker") {
    return "";
  }
  return normalized;
};

const matchesPlaceholderPattern = (pattern: string, input: string): boolean => {
  const patternTokens = normalizeCommand(pattern).split(" ");
  const inputTokens = normalizeCommand(input).split(" ");

  if (patternTokens.length !== inputTokens.length) {
    return false;
  }

  return patternTokens.every((token, index) => {
    if (token.startsWith("<") && token.endsWith(">")) {
      return inputTokens[index]?.length > 0;
    }
    return token === inputTokens[index];
  });
};

const scorePrefixMatch = (command: DockerCommandMetadata, input: string): number => {
  const inputSub = stripDockerPrefix(input);
  const cliSub = stripDockerPrefix(command.cli);
  const exampleSub = stripDockerPrefix(command.example);

  if (!inputSub) {
    return 0;
  }

  if (cliSub === inputSub || exampleSub === inputSub) {
    return 1000;
  }

  if (matchesPlaceholderPattern(command.cli, input) || matchesPlaceholderPattern(command.example, input)) {
    return 900;
  }

  if (cliSub.startsWith(inputSub) || exampleSub.startsWith(inputSub)) {
    return 500 + inputSub.length;
  }

  const inputTokens = inputSub.split(" ");
  const cliTokens = cliSub.split(" ");
  const sharedPrefix = inputTokens.every((token, index) => cliTokens[index] === token);

  if (sharedPrefix && inputTokens.length <= cliTokens.length) {
    return 300 + inputTokens.length * 10;
  }

  for (const alias of command.aliases) {
    const aliasNorm = normalizeCommand(alias);
    if (aliasNorm === inputSub || aliasNorm.startsWith(inputSub)) {
      return 200;
    }
  }

  return 0;
};

export const resolveRegistryCommand = (completion: string): DockerCommandMetadata | null => {
  const trimmed = completion.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedInput = normalizeCommand(trimmed);

  const exactMatch = dockerCommandList.find((command) => {
    const candidates = [
      normalizeCommand(command.cli),
      normalizeCommand(command.example),
      ...command.aliases.map((alias) => normalizeCommand(alias)),
    ];
    return candidates.includes(normalizedInput);
  });

  if (exactMatch) {
    return exactMatch;
  }

  const placeholderMatch = dockerCommandList.find(
    (command) => matchesPlaceholderPattern(command.cli, trimmed) || matchesPlaceholderPattern(command.example, trimmed)
  );

  if (placeholderMatch) {
    return placeholderMatch;
  }

  const ranked = dockerCommandList
    .map((command) => ({
      command,
      score: scorePrefixMatch(command, trimmed),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.command ?? null;
};

export const resolveRegistryCommandId = (completion: string): DockerCommandId | null =>
  resolveRegistryCommand(completion)?.id ?? null;

import { dockerCommandList, type DockerCommandMetadata } from "./docker-command-registry";
import { type CommandSuggestion, type SuggestionResult, computeInlineSuffix } from "./docker-command-suggestions";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "show",
  "list",
  "see",
  "get",
  "what",
  "how",
  "do",
  "i",
  "to",
  "for",
  "of",
  "is",
  "are",
  "me",
  "please",
]);

const normalizeInput = (value: string) => value.trim().toLowerCase();

const tokenizeIntent = (value: string) =>
  normalizeInput(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const intentSearchableText = (command: DockerCommandMetadata) => {
  const parts = [
    command.label,
    command.explanation,
    command.description,
    ...command.intents,
    ...command.aliases,
    command.whenToUse ?? "",
  ];
  return normalizeInput(parts.join(" "));
};

const scoreIntentMatch = (input: string, command: DockerCommandMetadata): number => {
  const normalizedInput = normalizeInput(input);
  if (!normalizedInput) {
    return 0;
  }

  let score = 0;
  const haystack = intentSearchableText(command);
  const tokens = tokenizeIntent(input);

  for (const intent of command.intents) {
    const normalizedIntent = normalizeInput(intent);
    if (normalizedIntent === normalizedInput) {
      score += 200;
    } else if (normalizedIntent.includes(normalizedInput) || normalizedInput.includes(normalizedIntent)) {
      score += 120;
    }
  }

  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  if (matchedTokens.length > 0) {
    score += matchedTokens.length * 25;
  }

  if (haystack.includes(normalizedInput)) {
    score += 40;
  }

  return score;
};

export const getIntentSuggestions = (input: string, limit = 8): SuggestionResult => {
  const trimmed = input.trim();
  if (trimmed.length < 3) {
    return { suggestions: [], inlineSuffix: "" };
  }

  const ranked = dockerCommandList
    .map((command) => ({
      command,
      score: scoreIntentMatch(trimmed, command),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const suggestions: CommandSuggestion[] = ranked.map(({ command, score }) => ({
    id: command.id,
    label: command.label,
    completion: command.example,
    explanation: command.explanation,
    description: command.description,
    risk: command.risk,
    score,
    source: "intent",
    registryId: command.id,
  }));

  return {
    suggestions,
    inlineSuffix: computeInlineSuffix(trimmed, suggestions[0]?.completion),
  };
};

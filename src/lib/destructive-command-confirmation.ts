export const DEFAULT_DESTRUCTIVE_CONFIRMATION_PHRASE = "Oxidock" as const;

type ExtractProjectResult = { projectName: string | null };

const extractComposeProjectName = (command: string): ExtractProjectResult => {
  const tokens = command.trim().split(/\s+/g).filter(Boolean);
  if (tokens.length < 3) {
    return { projectName: null };
  }

  const [first, second] = tokens;
  if (first?.toLowerCase() !== "docker" || second?.toLowerCase() !== "compose") {
    return { projectName: null };
  }

  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i]?.toLowerCase();
    if (!token) {
      continue;
    }

    if (token === "-p" || token === "--project-name") {
      const next = tokens[i + 1];
      if (typeof next === "string" && next.trim().length > 0) {
        return { projectName: next.trim() };
      }
      return { projectName: null };
    }

    if (token.startsWith("--project-name=")) {
      const value = token.slice("--project-name=".length).trim();
      return { projectName: value.length > 0 ? value : null };
    }

    if (token.startsWith("-p=")) {
      const value = token.slice("-p=".length).trim();
      return { projectName: value.length > 0 ? value : null };
    }
  }

  return { projectName: null };
};

export const getDestructiveConfirmationPhrase = (normalizedDockerCommand: string): string => {
  const { projectName } = extractComposeProjectName(normalizedDockerCommand);
  return projectName ?? DEFAULT_DESTRUCTIVE_CONFIRMATION_PHRASE;
};


export const DEFAULT_ASSISTANT_SUGGESTIONS = [
  "Why is my postgres container restarting?",
  "Which containers use the most memory?",
  "Show dangling images I can clean up",
  "Summarize recent Docker events",
  "What volumes and networks are in use?",
] as const;

const SUGGESTION_LIMIT = 5;

const SUGGESTION_GROUPS = [
  {
    match: /\b(memory|mem|ram|oom|137|killed)\b/i,
    suggestions: [
      "Which running containers are close to their memory limit?",
      "Which stopped containers look like they were OOM-killed?",
      "How can I reduce memory pressure safely?",
      "What command should I run to confirm current memory usage?",
      "Which container should I inspect first for memory issues?",
    ],
  },
  {
    match: /\b(restart|restarting|crash|exited|exit|failed|down|unhealthy)\b/i,
    suggestions: [
      "Which containers are failing or restarting right now?",
      "Show me the logs for the most suspicious container",
      "What is the likely root cause of the restart loop?",
      "What safe commands can I run to diagnose this?",
      "Which recent Docker events explain the failure?",
    ],
  },
  {
    match: /\b(image|images|dangling|cleanup|clean up|prune|disk|space|storage)\b/i,
    suggestions: [
      "Which images look safe to clean up?",
      "How much disk space can I reclaim safely?",
      "What is the safest prune command for this machine?",
      "Which images are still attached to containers?",
      "What should I review before deleting Docker resources?",
    ],
  },
  {
    match: /\b(event|events|recent|history|happened|timeline)\b/i,
    suggestions: [
      "What happened most recently in Docker?",
      "Which events look like errors or restarts?",
      "Which container changed state most recently?",
      "Do recent events explain the current container state?",
      "What command should I run to monitor new events?",
    ],
  },
  {
    match: /\b(volume|volumes|network|networks|port|ports|connect|connection)\b/i,
    suggestions: [
      "Which volumes are attached to active containers?",
      "Which networks have the most containers attached?",
      "What volumes or networks look unused?",
      "How do I inspect the network for this service?",
      "Which containers may be affected by networking issues?",
    ],
  },
] as const;

const normalizeSuggestion = (value: string): string => value.trim().toLowerCase();

export const buildAssistantSuggestions = (context: string | null | undefined): string[] => {
  const normalizedContext = normalizeSuggestion(context ?? "");
  const matchedGroup = SUGGESTION_GROUPS.find((group) => group.match.test(normalizedContext));
  const suggestions = matchedGroup?.suggestions ?? DEFAULT_ASSISTANT_SUGGESTIONS;

  return suggestions
    .filter((suggestion) => normalizeSuggestion(suggestion) !== normalizedContext)
    .slice(0, SUGGESTION_LIMIT);
};

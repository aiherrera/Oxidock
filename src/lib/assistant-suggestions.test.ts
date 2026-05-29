import { describe, expect, it } from "vitest";
import { buildAssistantSuggestions, DEFAULT_ASSISTANT_SUGGESTIONS } from "./assistant-suggestions";

describe("buildAssistantSuggestions", () => {
  it("returns default suggestions without context", () => {
    expect(buildAssistantSuggestions(null)).toEqual([...DEFAULT_ASSISTANT_SUGGESTIONS]);
  });

  it("returns memory follow-ups for memory questions", () => {
    const suggestions = buildAssistantSuggestions("Which containers use the most memory?");

    expect(suggestions).toContain("Which running containers are close to their memory limit?");
    expect(suggestions).toContain("What command should I run to confirm current memory usage?");
    expect(suggestions).not.toContain("Which containers use the most memory?");
  });

  it("returns failure follow-ups for restart questions", () => {
    const suggestions = buildAssistantSuggestions("Why is my postgres container restarting?");

    expect(suggestions).toContain("Which containers are failing or restarting right now?");
    expect(suggestions).toContain("Show me the logs for the most suspicious container");
  });
});

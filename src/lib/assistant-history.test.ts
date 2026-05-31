import { afterEach, describe, expect, it } from "vitest";
import {
  ASSISTANT_CHAT_HISTORY_KEY,
  clearAssistantChatHistory,
  loadAssistantChatHistory,
  parseAssistantChatHistory,
  saveAssistantChatHistory,
  type AssistantChatTurn,
} from "./assistant-history";

afterEach(() => {
  window.localStorage.clear();
});

describe("assistant chat history", () => {
  it("returns an empty history for invalid stored data", () => {
    expect(parseAssistantChatHistory("not json")).toEqual([]);
    expect(parseAssistantChatHistory(JSON.stringify({ role: "user" }))).toEqual([]);
  });

  it("sanitizes persisted assistant turns", () => {
    const parsed = parseAssistantChatHistory(
      JSON.stringify([
        { id: "u1", role: "user", content: "Which container is hot?", response: { answer: "ignored" } },
        {
          id: "u2",
          role: "user",
          content: "Summarize this log",
          attachments: [{ id: "paste-1", label: "Pasted text (500 chars)", mediaType: "text/plain" }],
        },
        {
          id: "a1",
          role: "assistant",
          content: "api is using the most memory.",
          response: {
            answer: "api is using the most memory.",
            reasoning: "- api has high memory",
            sources: [{ id: "container:api", kind: "container", label: "api", detail: "Up" }],
            suggestedCommands: [
              {
                command: "docker stats --no-stream",
                label: "Check stats",
                explanation: "Shows current resource use",
                risk: "safe",
              },
            ],
            stackTraces: [{ title: "api logs", content: "Error: boom" }],
            usedModel: true,
          },
        },
        { role: "system", content: "discard me" },
      ])
    );

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ id: "u1", role: "user", content: "Which container is hot?" });
    expect(parsed[1]?.attachments?.[0]).toMatchObject({ label: "Pasted text (500 chars)" });
    expect(parsed[2]?.response?.sources[0]).toMatchObject({ kind: "container", label: "api" });
    expect(parsed[2]?.response?.usedModel).toBe(true);
  });

  it("bounds saved history and clears empty history", () => {
    const turns: AssistantChatTurn[] = Array.from({ length: 60 }, (_, index) => ({
      id: `turn-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `turn ${index}`,
    }));

    saveAssistantChatHistory(turns);

    const loaded = loadAssistantChatHistory();
    expect(loaded).toHaveLength(50);
    expect(loaded[0]?.id).toBe("turn-10");

    clearAssistantChatHistory();
    expect(window.localStorage.getItem(ASSISTANT_CHAT_HISTORY_KEY)).toBeNull();
  });
});

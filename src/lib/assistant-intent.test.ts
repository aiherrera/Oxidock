import { describe, expect, it } from "vitest";
import { classifyAssistantIntent, parseAssistantQuestionParts } from "./assistant-intent";

describe("classifyAssistantIntent", () => {
  it("marks general-knowledge questions as out of scope", () => {
    const result = classifyAssistantIntent({
      currentRequest: "Who is the president of the United States?",
    });

    expect(result.intent).toBe("out_of_scope");
    expect(result.inScope).toBe(false);
  });

  it("classifies container failure questions as diagnose_container", () => {
    const result = classifyAssistantIntent({
      currentRequest: "Why is postgres restarting?",
    });

    expect(result.intent).toBe("diagnose_container");
    expect(result.inScope).toBe(true);
  });

  it("distinguishes events from images even with overlapping words", () => {
    const events = classifyAssistantIntent({
      currentRequest: "What recent Docker events happened?",
    });
    const images = classifyAssistantIntent({
      currentRequest: "Which images are still attached to containers?",
    });

    expect(events.intent).toBe("explain_events");
    expect(images.intent).toBe("explain_images");
  });

  it("routes command-seeking event questions to command guidance", () => {
    const result = classifyAssistantIntent({
      currentRequest: "What command should I run to monitor new events?",
    });

    expect(result.intent).toBe("suggest_command");
    expect(result.inScope).toBe(true);
  });

  it("lets command request shape outrank memory keywords", () => {
    const result = classifyAssistantIntent({
      currentRequest: "What command should I run to confirm current memory usage?",
    });

    expect(result.intent).toBe("suggest_command");
  });

  it("lets command request shape outrank failure keywords", () => {
    const result = classifyAssistantIntent({
      currentRequest: "What safe commands can I run to diagnose this restart loop?",
    });

    expect(result.intent).toBe("suggest_command");
  });

  it("routes cleanup questions to list_cleanup_candidates", () => {
    const result = classifyAssistantIntent({
      currentRequest: "What should I review before deleting Docker resources?",
    });

    expect(result.intent).toBe("list_cleanup_candidates");
  });

  it("routes architecture questions with pasted context to explain_context", () => {
    const result = classifyAssistantIntent({
      currentRequest: "how is the architecture of oxidock?",
      pastedContext: "# Oxidock\n\n## Architecture\n\nTauri and React.",
    });

    expect(result.intent).toBe("explain_context");
    expect(result.inScope).toBe(true);
  });

  it("routes summarize requests with pasted context to summarize_context", () => {
    const result = classifyAssistantIntent({
      currentRequest: "Summarize this",
      pastedContext: "# README\n\nOxidock is a Docker desktop app.",
    });

    expect(result.intent).toBe("summarize_context");
    expect(result.inScope).toBe(true);
  });

  it("routes compare requests with pasted context to compare_context_to_state", () => {
    const result = classifyAssistantIntent({
      currentRequest: "Compare this with my Docker state",
      pastedContext: "services:\n  web:\n    image: nginx",
    });

    expect(result.intent).toBe("compare_context_to_state");
  });

  it("treats attachment-only input as clarify", () => {
    const result = classifyAssistantIntent({
      currentRequest: "",
      pastedContext: "Long README content",
    });

    expect(result.intent).toBe("clarify");
    expect(result.inScope).toBe(false);
  });

  it("uses prior context for vague follow-ups", () => {
    const result = classifyAssistantIntent({
      currentRequest: "What about this?",
      hasConversationContext: true,
    });

    expect(result.intent).toBe("summarize_context");
    expect(result.inScope).toBe(true);
  });
});

describe("parseAssistantQuestionParts", () => {
  it("keeps single-section questions as the current request", () => {
    expect(parseAssistantQuestionParts("Why is postgres restarting?")).toEqual({
      currentRequest: "Why is postgres restarting?",
    });
  });

  it("splits typed prompt from pasted attachment body", () => {
    expect(parseAssistantQuestionParts("Summarize this\n\nREADME:\n# Title")).toEqual({
      currentRequest: "Summarize this",
      pastedContext: "README:\n# Title",
    });
  });
});

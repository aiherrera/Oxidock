import { describe, expect, it } from "vitest";
import { buildAssistantQuestionFromMessage, getAssistantPromptAttachmentSummaries } from "./assistant-prompt-message";

describe("buildAssistantQuestionFromMessage", () => {
  it("returns trimmed textarea text when there are no attachments", async () => {
    const question = await buildAssistantQuestionFromMessage({
      text: "  Why is postgres restarting?  ",
      files: [],
    });

    expect(question).toBe("Why is postgres restarting?");
  });

  it("merges textarea text with text-like attachment bodies", async () => {
    const blob = new Blob(["line one\nline two"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    try {
      const question = await buildAssistantQuestionFromMessage({
        text: "Summarize this log",
        files: [
          {
            type: "file",
            filename: "Pasted text (2 chars).txt",
            mediaType: "text/plain",
            url,
          },
        ],
      });

      expect(question).toBe("Summarize this log\n\nPasted text (2 chars):\nline one\nline two");
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  it("reads text-like attachments from data URLs", async () => {
    const question = await buildAssistantQuestionFromMessage({
      text: "Summarize this log",
      files: [
        {
          type: "file",
          filename: "Pasted text (7 chars).txt",
          mediaType: "text/plain",
          url: "data:text/plain;base64,bG9nIGJvZHk=",
        },
      ],
    });

    expect(question).toBe("Summarize this log\n\nPasted text (7 chars):\nlog body");
  });

  it("can submit attachment-only prompts", async () => {
    const blob = new Blob(["only attachment body"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    try {
      const question = await buildAssistantQuestionFromMessage({
        text: "   ",
        files: [
          {
            type: "file",
            filename: "Pasted text (21 chars).txt",
            mediaType: "text/plain",
            url,
          },
        ],
      });

      expect(question).toBe("Pasted text (21 chars):\nonly attachment body");
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  it("summarizes text-like attachments for chat display", () => {
    const summaries = getAssistantPromptAttachmentSummaries({
      text: "Summarize this log",
      files: [
        {
          type: "file",
          filename: "Pasted text (500 chars).txt",
          mediaType: "text/plain",
          url: "blob:test",
        },
      ],
    });

    expect(summaries).toEqual([
      {
        id: "Pasted text (500 chars).txt-0",
        label: "Pasted text (500 chars)",
        mediaType: "text/plain",
      },
    ]);
  });
});

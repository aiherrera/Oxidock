import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { AssistantChatAttachment } from "./assistant-history";

/** Pasted plain text at or above this length becomes a removable attachment chip. */
export const ASSISTANT_LONG_PASTE_CHAR_THRESHOLD = 500;

const isTextLikeAttachment = (mediaType: string | undefined, filename: string | undefined): boolean => {
  if (mediaType?.startsWith("text/")) {
    return true;
  }

  if (!filename) {
    return false;
  }

  const lower = filename.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log") || lower.endsWith(".json");
};

const readAttachmentText = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    return response.text();
  } catch {
    return "";
  }
};

const getAttachmentLabel = (filename: string | undefined): string => filename?.replace(/\.txt$/i, "") ?? "Pasted text";

export function getAssistantPromptAttachmentSummaries(message: PromptInputMessage): AssistantChatAttachment[] {
  return message.files
    .filter((file) => isTextLikeAttachment(file.mediaType, file.filename))
    .map((file, index) => ({
      id: `${file.filename ?? "attachment"}-${index}`,
      label: getAttachmentLabel(file.filename),
      mediaType: file.mediaType,
    }));
}

/**
 * Builds the assistant question string from prompt input text plus text-like attachments.
 */
export async function buildAssistantQuestionFromMessage(message: PromptInputMessage): Promise<string> {
  const parts: string[] = [];
  const trimmedText = message.text.trim();

  if (trimmedText) {
    parts.push(trimmedText);
  }

  for (const file of message.files) {
    if (!file.url || !isTextLikeAttachment(file.mediaType, file.filename)) {
      continue;
    }

    const body = await readAttachmentText(file.url);
    const label = getAttachmentLabel(file.filename);
    const trimmedBody = body.trim();
    parts.push(trimmedBody ? `${label}:\n${trimmedBody}` : label);
  }

  return parts.join("\n\n").trim();
}

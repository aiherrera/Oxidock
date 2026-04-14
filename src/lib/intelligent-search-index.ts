import { dockerDocsLinks, type DockerDocsLink } from "./docker-docs-links";
import { dockerCommandList, type DockerCommandId, type DockerCommandMetadata } from "./docker-command-registry";
import { dockerCommandLessons, type DockerCommandLesson } from "./docker-command-lessons";

export type LessonSearchEntry = {
  lesson: DockerCommandLesson;
  searchableText: string;
};

export type CommandSearchEntry = {
  command: DockerCommandMetadata;
  searchableText: string;
};

export type DocsLinkSearchEntry = {
  link: DockerDocsLink;
  searchableText: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

const buildSearchableText = (...parts: string[]) => normalize(parts.filter(Boolean).join(" "));

export const lessonSearchIndex: LessonSearchEntry[] = dockerCommandLessons.map((lesson) => ({
  lesson,
  searchableText: buildSearchableText(lesson.title, lesson.subtitle, lesson.goal, lesson.id.replace(/-/g, " ")),
}));

export const commandSearchIndex: CommandSearchEntry[] = dockerCommandList.map((command) => ({
  command,
  searchableText: buildSearchableText(
    command.label,
    command.explanation,
    command.description,
    command.cli,
    command.example,
    command.whenToUse ?? "",
    command.category,
    ...command.aliases,
    ...command.intents
  ),
}));

export const docsLinkSearchIndex: DocsLinkSearchEntry[] = dockerDocsLinks.map((link) => ({
  link,
  searchableText: buildSearchableText(link.title, link.description, ...link.keywords, ...(link.categories ?? [])),
}));

const commandLessonById = new Map<DockerCommandId, DockerCommandLesson>();
for (const lesson of dockerCommandLessons) {
  for (const commandId of lesson.commandIds) {
    commandLessonById.set(commandId, lesson);
  }
}

export const getLessonForCommand = (commandId: DockerCommandId) => commandLessonById.get(commandId);

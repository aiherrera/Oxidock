import type { AppPage } from "./app";
import type { DockerCommandLessonId } from "../lib/docker-command-lessons";
import type { DockerCommandId } from "../lib/docker-command-registry";

export type SearchScope = "local" | "registry" | "learn" | "docs";

export type SearchResultKind =
  | "container"
  | "project"
  | "image"
  | "volume"
  | "network"
  | "page"
  | "registry-image"
  | "lesson"
  | "command"
  | "docs-link";

export type SearchResultAction =
  | {
      type: "navigate";
      page: AppPage;
      query?: string;
      imagesViewMode?: "local" | "registry";
      lessonId?: DockerCommandLessonId;
      commandId?: DockerCommandId;
    }
  | { type: "open-playground"; command: string }
  | { type: "open-external"; url: string };

export type IntelligentSearchResult = {
  id: string;
  kind: SearchResultKind;
  scope: SearchScope;
  title: string;
  subtitle?: string;
  badge: string;
  score: number;
  action: SearchResultAction;
};

export type IntelligentSearchGroup = {
  scope: SearchScope;
  label: string;
  results: IntelligentSearchResult[];
};

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  local: "Local resources",
  registry: "Registry images",
  learn: "Lessons & commands",
  docs: "Docker docs",
};

export const SEARCH_SCOPE_ORDER: SearchScope[] = ["local", "learn", "registry", "docs"];

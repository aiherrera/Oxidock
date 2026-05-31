import type { AppPage } from "../types/app";
import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";
import type {
  IntelligentSearchGroup,
  IntelligentSearchResult,
  SearchResultKind,
  SearchScope,
} from "../types/intelligent-search";
import { SEARCH_SCOPE_LABELS, SEARCH_SCOPE_ORDER } from "../types/intelligent-search";
import type { RegistrySearchResult } from "../types/registry";
import { getIntentSuggestions } from "./docker-intent-matcher";
import {
  commandSearchIndex,
  docsLinkSearchIndex,
  getLessonForCommand,
  lessonSearchIndex,
} from "./intelligent-search-index";
import { filterByQuery } from "./search-utils";

export type LocalDockerSnapshot = {
  containers: ContainerInfo[];
  images: ImageInfo[];
  volumes: VolumeInfo[];
  networks: NetworkInfo[];
};

const normalize = (value: string) => value.trim().toLowerCase();

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
  "find",
  "search",
]);

const tokenize = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const scoreTextMatch = (query: string, haystack: string): number => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;

  if (haystack === normalizedQuery) {
    score += 200;
  } else if (haystack.startsWith(normalizedQuery)) {
    score += 140;
  } else if (haystack.includes(normalizedQuery)) {
    score += 80;
  }

  const tokens = tokenize(query);
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  if (matchedTokens.length > 0) {
    score += matchedTokens.length * 30;
  }

  return score;
};

const REGISTRY_HINTS = ["pull", "image", "registry", "hub", "docker hub", "find image", "search image"];

const PAGE_RELATED_RESULT_KINDS: Partial<Record<AppPage, readonly SearchResultKind[]>> = {
  containers: ["container", "project"],
  images: ["image", "registry-image"],
  volumes: ["volume"],
  networks: ["network"],
  docs: ["lesson", "command", "docs-link"],
  cli: ["command"],
};

const PAGE_SCOPE_ORDER: Partial<Record<AppPage, readonly SearchScope[]>> = {
  images: ["local", "registry", "learn", "docs"],
  docs: ["learn", "docs", "local", "registry"],
  cli: ["learn", "local", "registry", "docs"],
};

export const looksLikeRegistryQuery = (query: string): boolean => {
  const normalized = normalize(query);
  if (!normalized) {
    return false;
  }

  if (REGISTRY_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  if (/^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?$/i.test(normalized)) {
    return true;
  }

  return false;
};

export const looksLikeLearningQuery = (query: string): boolean => {
  const normalized = normalize(query);
  if (normalized.length < 3) {
    return false;
  }

  if (
    normalized.startsWith("how ") ||
    normalized.startsWith("what ") ||
    normalized.includes("learn") ||
    normalized.includes("help")
  ) {
    return true;
  }

  return getIntentSuggestions(query, 1).suggestions.length > 0;
};

const makeResult = (
  result: Omit<IntelligentSearchResult, "scope"> & { scope?: SearchScope }
): IntelligentSearchResult => result as IntelligentSearchResult;

const searchLocalResources = (query: string, snapshot: LocalDockerSnapshot): IntelligentSearchResult[] => {
  const results: IntelligentSearchResult[] = [];
  const normalized = normalize(query);
  if (!normalized) {
    return results;
  }

  const projectNames = new Set<string>();
  for (const container of snapshot.containers) {
    if (container.project) {
      projectNames.add(container.project);
    }
  }

  for (const project of projectNames) {
    const score = scoreTextMatch(query, normalize(project));
    if (score > 0) {
      results.push(
        makeResult({
          id: `project:${project}`,
          kind: "project",
          scope: "local",
          title: project,
          subtitle: "Compose project",
          badge: "Local project",
          score: score + 20,
          action: {
            type: "navigate",
            page: "containers",
            query: project,
          },
        })
      );
    }
  }

  for (const container of filterByQuery(snapshot.containers, query, (item) => [
    item.name,
    item.id,
    item.shortId,
    item.image,
    item.project ?? "",
    item.service ?? "",
    item.state,
  ]).slice(0, 6)) {
    results.push(
      makeResult({
        id: `container:${container.id}`,
        kind: "container",
        scope: "local",
        title: container.name,
        subtitle: `${container.image} · ${container.state}`,
        badge: "Local container",
        score:
          scoreTextMatch(query, normalize(container.name)) + scoreTextMatch(query, normalize(container.image)) + 10,
        action: {
          type: "navigate",
          page: "containers",
          query: container.name,
        },
      })
    );
  }

  for (const image of filterByQuery(snapshot.images, query, (item) => [
    item.repository,
    item.tag,
    item.id,
    item.shortId,
  ]).slice(0, 4)) {
    results.push(
      makeResult({
        id: `image:${image.id}`,
        kind: "image",
        scope: "local",
        title: `${image.repository}:${image.tag}`,
        subtitle: image.shortId,
        badge: "Local image",
        score: scoreTextMatch(query, normalize(`${image.repository}:${image.tag}`)),
        action: {
          type: "navigate",
          page: "images",
          query: `${image.repository}:${image.tag}`,
          imagesViewMode: "local",
        },
      })
    );
  }

  for (const volume of filterByQuery(snapshot.volumes, query, (item) => [
    item.name,
    item.driver,
    item.mountpoint,
  ]).slice(0, 4)) {
    results.push(
      makeResult({
        id: `volume:${volume.name}`,
        kind: "volume",
        scope: "local",
        title: volume.name,
        subtitle: volume.driver,
        badge: "Local volume",
        score: scoreTextMatch(query, normalize(volume.name)),
        action: {
          type: "navigate",
          page: "volumes",
          query: volume.name,
        },
      })
    );
  }

  for (const network of filterByQuery(snapshot.networks, query, (item) => [
    item.name,
    item.id,
    item.shortId,
    item.driver,
  ]).slice(0, 4)) {
    results.push(
      makeResult({
        id: `network:${network.id}`,
        kind: "network",
        scope: "local",
        title: network.name,
        subtitle: network.driver,
        badge: "Local network",
        score: scoreTextMatch(query, normalize(network.name)),
        action: {
          type: "navigate",
          page: "networks",
          query: network.name,
        },
      })
    );
  }

  const pageMatches: { page: AppPage; label: string; keywords: string[] }[] = [
    { page: "dashboard", label: "Dashboard", keywords: ["dashboard", "overview", "home"] },
    { page: "logs", label: "Logs", keywords: ["log", "logs", "stdout"] },
    { page: "events", label: "Events", keywords: ["event", "events", "monitor"] },
    { page: "cli", label: "CLI Playground", keywords: ["cli", "command", "playground"] },
    { page: "docs", label: "Command School", keywords: ["docs", "lesson", "learn", "course", "command school"] },
    { page: "assistant", label: "AI Assistant", keywords: ["assistant", "ai", "help"] },
  ];

  for (const match of pageMatches) {
    const haystack = normalize([match.label, ...match.keywords].join(" "));
    const score = scoreTextMatch(query, haystack);
    if (score > 0) {
      results.push(
        makeResult({
          id: `page:${match.page}`,
          kind: "page",
          scope: "local",
          title: match.label,
          subtitle: "Open section",
          badge: "Navigate",
          score: score - 5,
          action: {
            type: "navigate",
            page: match.page,
            query,
          },
        })
      );
    }
  }

  return results.sort((left, right) => right.score - left.score);
};

export const searchLearnResults = (query: string): IntelligentSearchResult[] => {
  const results: IntelligentSearchResult[] = [];
  const normalized = normalize(query);
  if (normalized.length < 2) {
    return results;
  }

  for (const entry of lessonSearchIndex) {
    const score = scoreTextMatch(query, entry.searchableText);
    if (score <= 0) {
      continue;
    }

    results.push(
      makeResult({
        id: `lesson:${entry.lesson.id}`,
        kind: "lesson",
        scope: "learn",
        title: entry.lesson.title,
        subtitle: entry.lesson.subtitle,
        badge: "Lesson",
        score,
        action: {
          type: "navigate",
          page: "docs",
          lessonId: entry.lesson.id,
          query,
        },
      })
    );
  }

  const includedCommandIds = new Set<string>();
  const intentSuggestions = getIntentSuggestions(query, 6).suggestions;
  for (const suggestion of intentSuggestions) {
    if (includedCommandIds.has(suggestion.id)) {
      continue;
    }
    includedCommandIds.add(suggestion.id);

    const lesson = suggestion.registryId ? getLessonForCommand(suggestion.registryId) : undefined;

    results.push(
      makeResult({
        id: `command:${suggestion.id}`,
        kind: "command",
        scope: "learn",
        title: suggestion.label,
        subtitle: suggestion.explanation,
        badge: "Command",
        score: suggestion.score + (lesson ? 5 : 0),
        action: lesson
          ? {
              type: "navigate",
              page: "docs",
              lessonId: lesson.id,
              commandId: suggestion.registryId,
              query,
            }
          : {
              type: "open-playground",
              command: suggestion.completion,
            },
      })
    );
  }

  for (const entry of commandSearchIndex) {
    const score = scoreTextMatch(query, entry.searchableText);
    if (score <= 40) {
      continue;
    }

    if (includedCommandIds.has(entry.command.id)) {
      continue;
    }
    includedCommandIds.add(entry.command.id);

    const lesson = getLessonForCommand(entry.command.id);
    results.push(
      makeResult({
        id: `command:${entry.command.id}`,
        kind: "command",
        scope: "learn",
        title: entry.command.label,
        subtitle: entry.command.explanation,
        badge: "Command",
        score: score - 10,
        action: lesson
          ? {
              type: "navigate",
              page: "docs",
              lessonId: lesson.id,
              commandId: entry.command.id,
              query,
            }
          : {
              type: "open-playground",
              command: entry.command.example,
            },
      })
    );
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 8);
};

const searchDocsLinks = (query: string): IntelligentSearchResult[] => {
  const results: IntelligentSearchResult[] = [];
  const normalized = normalize(query);
  if (normalized.length < 2) {
    return results;
  }

  for (const entry of docsLinkSearchIndex) {
    const score = scoreTextMatch(query, entry.searchableText);
    if (score <= 0) {
      continue;
    }

    results.push(
      makeResult({
        id: `docs:${entry.link.id}`,
        kind: "docs-link",
        scope: "docs",
        title: entry.link.title,
        subtitle: entry.link.description,
        badge: "Docker docs",
        score: score - 15,
        action: {
          type: "open-external",
          url: entry.link.url,
        },
      })
    );
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 4);
};

export const mapRegistryResults = (query: string, registryResults: RegistrySearchResult[]): IntelligentSearchResult[] =>
  registryResults.slice(0, 6).map((result, index) =>
    makeResult({
      id: `registry:${result.registryId}:${result.pullReference}`,
      kind: "registry-image",
      scope: "registry",
      title: result.name,
      subtitle: result.registryName,
      badge: result.isOfficial ? "Official image" : "Registry image",
      score: 100 - index,
      action: {
        type: "navigate",
        page: "images",
        query,
        imagesViewMode: "registry",
      },
    })
  );

export type IntelligentSearchOptions = {
  query: string;
  snapshot: LocalDockerSnapshot;
  currentPage?: AppPage;
  registryResults?: RegistrySearchResult[];
  includeRegistry?: boolean;
};

const getPageScopeOrder = (currentPage?: AppPage): readonly SearchScope[] =>
  (currentPage ? PAGE_SCOPE_ORDER[currentPage] : undefined) ?? SEARCH_SCOPE_ORDER;

export const shouldSearchRegistries = (query: string, currentPage?: AppPage): boolean =>
  currentPage === "images" || looksLikeRegistryQuery(query);

const isPageRelatedResult = (result: IntelligentSearchResult, currentPage?: AppPage): boolean => {
  if (!currentPage) {
    return false;
  }

  const relatedKinds = PAGE_RELATED_RESULT_KINDS[currentPage];
  if (relatedKinds?.includes(result.kind)) {
    return true;
  }

  return result.action.type === "navigate" && result.action.page === currentPage && result.kind !== "page";
};

const prioritizePageRelatedResults = (
  results: IntelligentSearchResult[],
  currentPage?: AppPage
): IntelligentSearchResult[] =>
  [...results].sort((left, right) => {
    const leftRelated = isPageRelatedResult(left, currentPage);
    const rightRelated = isPageRelatedResult(right, currentPage);

    if (leftRelated !== rightRelated) {
      return leftRelated ? -1 : 1;
    }

    return right.score - left.score;
  });

export const buildIntelligentSearchGroups = ({
  query,
  snapshot,
  currentPage,
  registryResults = [],
  includeRegistry = true,
}: IntelligentSearchOptions): IntelligentSearchGroup[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const grouped = new Map<SearchScope, IntelligentSearchResult[]>();

  const localResults = searchLocalResources(trimmed, snapshot);
  if (localResults.length > 0) {
    grouped.set("local", prioritizePageRelatedResults(localResults, currentPage).slice(0, 8));
  }

  const learnResults = searchLearnResults(trimmed);
  if (learnResults.length > 0) {
    grouped.set("learn", learnResults);
  }

  const registryEligible = shouldSearchRegistries(trimmed, currentPage);
  if (includeRegistry && (registryEligible || registryResults.length > 0)) {
    const registryMapped = mapRegistryResults(trimmed, registryResults);
    if (registryMapped.length > 0) {
      grouped.set("registry", registryMapped);
    } else if (registryEligible) {
      grouped.set("registry", [
        makeResult({
          id: "registry:search-action",
          kind: "registry-image",
          scope: "registry",
          title: `Search registries for "${trimmed}"`,
          subtitle: "Docker Hub and configured registries",
          badge: "Registry search",
          score: 50,
          action: {
            type: "navigate",
            page: "images",
            query: trimmed,
            imagesViewMode: "registry",
          },
        }),
      ]);
    }
  }

  const docsResults = searchDocsLinks(trimmed);
  if (docsResults.length > 0) {
    grouped.set("docs", docsResults);
  }

  return getPageScopeOrder(currentPage).flatMap((scope) => {
    const results = grouped.get(scope);
    if (!results || results.length === 0) {
      return [];
    }

    return [
      {
        scope,
        label: SEARCH_SCOPE_LABELS[scope],
        results,
      },
    ];
  });
};

export const flattenSearchGroups = (groups: IntelligentSearchGroup[]) => groups.flatMap((group) => group.results);

export const extractRegistryQuery = (query: string): string => {
  const normalized = normalize(query);
  const prefixes = ["find image for ", "find image ", "search image for ", "search image ", "pull ", "image "];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      return query.slice(prefix.length).trim();
    }
  }

  return query.trim();
};

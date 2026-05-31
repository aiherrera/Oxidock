import { lazy, Suspense, type Dispatch, type SetStateAction } from "react";
import { ContainersPage } from "./containers-page";
import { PageLoadingSkeleton } from "./page-shell";
import type { CliHistoryEntry } from "./cli-playground-page";
import type { DockerCommandLessonId } from "../lib/docker-command-lessons";
import type { DockerCommandId } from "../lib/docker-command-registry";
import type { AppPage } from "../types/app";
import type { IntelligentSearchResult } from "../types/intelligent-search";
import type { DockerStatus } from "../types/docker";
import type { ThemePreference } from "../lib/theme-settings";

const DashboardPage = lazy(() => import("./dashboard-page").then((module) => ({ default: module.DashboardPage })));
const ImagesPage = lazy(() => import("./images-page").then((module) => ({ default: module.ImagesPage })));
const VolumesPage = lazy(() => import("./volumes-page").then((module) => ({ default: module.VolumesPage })));
const NetworksPage = lazy(() => import("./networks-page").then((module) => ({ default: module.NetworksPage })));
const EventsPage = lazy(() => import("./events-page").then((module) => ({ default: module.EventsPage })));
const LogsPage = lazy(() => import("./logs-page").then((module) => ({ default: module.LogsPage })));
const AssistantPage = lazy(() => import("./assistant-page").then((module) => ({ default: module.AssistantPage })));
const CliPlaygroundPage = lazy(() =>
  import("./cli-playground-page").then((module) => ({ default: module.CliPlaygroundPage }))
);
const DocsPage = lazy(() => import("./docs-page").then((module) => ({ default: module.DocsPage })));
const SettingsPage = lazy(() => import("./settings-page").then((module) => ({ default: module.SettingsPage })));

const LazyPageFallback = () => (
  <div className="flex min-h-0 flex-1 flex-col p-6">
    <PageLoadingSkeleton />
  </div>
);

type AppRouterProps = {
  activePage: AppPage;
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
  docsLessonId: DockerCommandLessonId;
  docsCommandId?: DockerCommandId;
  imagesViewMode: "local" | "registry";
  playgroundCommandDraft: string;
  playgroundErrorMessage: string | null;
  playgroundHistory: CliHistoryEntry[];
  playgroundCommand?: string;
  playgroundIsRunning: boolean;
  isLoadingStatus: boolean;
  themePreference: ThemePreference;
  onPlaygroundCommandDraftChange: Dispatch<SetStateAction<string>>;
  onPlaygroundErrorMessageChange: Dispatch<SetStateAction<string | null>>;
  onPlaygroundHistoryChange: Dispatch<SetStateAction<CliHistoryEntry[]>>;
  onPlaygroundInitialCommandApplied: () => void;
  onPlaygroundIsRunningChange: Dispatch<SetStateAction<boolean>>;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onEngineChanged: (revision: number) => void;
  onOpenPlayground: (command: string) => void;
  onNavigatePage: (page: AppPage) => void;
  onResetImagesViewMode: () => void;
  onOpenSettingsPage: () => void;
  onDocsCommandTargetConsumed: () => void;
  onSearchResultSelect: (result: IntelligentSearchResult) => void;
};

export function AppRouter({
  activePage,
  dockerStatus,
  engineRevision,
  searchQuery,
  docsLessonId,
  docsCommandId,
  imagesViewMode,
  playgroundCommandDraft,
  playgroundErrorMessage,
  playgroundHistory,
  playgroundCommand,
  playgroundIsRunning,
  isLoadingStatus,
  themePreference,
  onPlaygroundCommandDraftChange,
  onPlaygroundErrorMessageChange,
  onPlaygroundHistoryChange,
  onPlaygroundInitialCommandApplied,
  onPlaygroundIsRunningChange,
  onThemePreferenceChange,
  onEngineChanged,
  onOpenPlayground,
  onNavigatePage,
  onResetImagesViewMode,
  onOpenSettingsPage,
  onDocsCommandTargetConsumed,
  onSearchResultSelect,
}: AppRouterProps) {
  switch (activePage) {
    case "dashboard":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <DashboardPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            onNavigate={onNavigatePage}
            onOpenPlayground={onOpenPlayground}
          />
        </Suspense>
      );
    case "containers":
      return (
        <ContainersPage
          dockerStatus={dockerStatus}
          engineRevision={engineRevision}
          searchQuery={searchQuery}
        />
      );
    case "images":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <ImagesPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            initialViewMode={imagesViewMode}
            searchQuery={searchQuery}
            onOpenPlayground={onOpenPlayground}
            onSearchResultSelect={onSearchResultSelect}
            onViewModeApplied={onResetImagesViewMode}
          />
        </Suspense>
      );
    case "volumes":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <VolumesPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            searchQuery={searchQuery}
          />
        </Suspense>
      );
    case "networks":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <NetworksPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            searchQuery={searchQuery}
          />
        </Suspense>
      );
    case "events":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <EventsPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            searchQuery={searchQuery}
          />
        </Suspense>
      );
    case "logs":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <LogsPage
            dockerStatus={dockerStatus}
            engineRevision={engineRevision}
            searchQuery={searchQuery}
          />
        </Suspense>
      );
    case "assistant":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <AssistantPage
            dockerStatus={dockerStatus}
            onOpenPlayground={onOpenPlayground}
            onOpenSettingsPage={onOpenSettingsPage}
          />
        </Suspense>
      );
    case "cli":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <CliPlaygroundPage
            command={playgroundCommandDraft}
            dockerStatus={dockerStatus}
            errorMessage={playgroundErrorMessage}
            history={playgroundHistory}
            initialCommand={playgroundCommand}
            isRunning={playgroundIsRunning}
            setCommand={onPlaygroundCommandDraftChange}
            setErrorMessage={onPlaygroundErrorMessageChange}
            setHistory={onPlaygroundHistoryChange}
            setIsRunning={onPlaygroundIsRunningChange}
            onInitialCommandApplied={onPlaygroundInitialCommandApplied}
            onOpenSettingsPage={onOpenSettingsPage}
          />
        </Suspense>
      );
    case "docs":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <DocsPage
            initialCommandId={docsCommandId}
            initialLessonId={docsLessonId}
            onCommandTargetConsumed={onDocsCommandTargetConsumed}
            onOpenPlayground={onOpenPlayground}
          />
        </Suspense>
      );
    case "settings":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <SettingsPage
            isLoading={isLoadingStatus}
            themePreference={themePreference}
            onThemePreferenceChange={onThemePreferenceChange}
            onEngineChanged={onEngineChanged}
          />
        </Suspense>
      );
    default:
      return null;
  }
}

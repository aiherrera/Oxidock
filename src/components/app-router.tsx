import { lazy, Suspense } from "react";
import { ContainersPage } from "./containers-page";
import { PageLoadingSkeleton } from "./page-shell";
import type { DockerCommandLessonId } from "../lib/docker-command-lessons";
import type { DockerCommandId } from "../lib/docker-command-registry";
import type { AppPage } from "../types/app";
import type { DockerStatus } from "../types/docker";
import type { ThemePreference } from "../lib/theme-settings";

const ImagesPage = lazy(() => import("./images-page").then((module) => ({ default: module.ImagesPage })));
const VolumesPage = lazy(() => import("./volumes-page").then((module) => ({ default: module.VolumesPage })));
const NetworksPage = lazy(() => import("./networks-page").then((module) => ({ default: module.NetworksPage })));
const EventsPage = lazy(() => import("./events-page").then((module) => ({ default: module.EventsPage })));
const LogsPage = lazy(() => import("./logs-page").then((module) => ({ default: module.LogsPage })));
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
  playgroundCommand?: string;
  isLoadingStatus: boolean;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onEngineChanged: (revision: number) => void;
  onOpenPlayground: (command: string) => void;
  onResetImagesViewMode: () => void;
  onOpenSettingsPage: () => void;
  onDocsCommandTargetConsumed: () => void;
};

export function AppRouter({
  activePage,
  dockerStatus,
  engineRevision,
  searchQuery,
  docsLessonId,
  docsCommandId,
  imagesViewMode,
  playgroundCommand,
  isLoadingStatus,
  themePreference,
  onThemePreferenceChange,
  onEngineChanged,
  onOpenPlayground,
  onResetImagesViewMode,
  onOpenSettingsPage,
  onDocsCommandTargetConsumed,
}: AppRouterProps) {
  switch (activePage) {
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
    case "cli":
      return (
        <Suspense fallback={<LazyPageFallback />}>
          <CliPlaygroundPage
            dockerStatus={dockerStatus}
            initialCommand={playgroundCommand}
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

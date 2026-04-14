import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { AppRouter } from "./components/app-router";
import { AppShell } from "./components/app-shell";
import { Sidebar } from "./components/sidebar";
import type { TitleBarHandle } from "./components/title-bar";
import { useAppNavigation } from "./hooks/use-app-navigation";
import { useAppShortcuts } from "./hooks/use-app-shortcuts";
import { useMenuActions } from "./hooks/use-menu-actions";
import { useTheme } from "./hooks/use-theme";
import {
  formatShortcutLabel,
  loadShortcutSettings,
  SHORTCUT_SETTINGS_CHANGED_EVENT,
  type ShortcutSettings,
} from "./lib/shortcut-settings";
import { useDockerStatusChanged } from "./lib/docker-change-events";
import { fetchDockerStatus } from "./lib/tauri-docker";
import type { DockerCommandLessonId } from "./lib/docker-command-lessons";
import type { DockerCommandId } from "./lib/docker-command-registry";
import type { AppPage } from "./types/app";
import type { DockerStatus } from "./types/docker";

function App() {
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const [activePage, setActivePage] = useState<AppPage>("containers");
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [engineRevision, setEngineRevision] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [docsLessonId, setDocsLessonId] = useState<DockerCommandLessonId>("first-steps");
  const [docsCommandId, setDocsCommandId] = useState<DockerCommandId | undefined>();
  const [imagesViewMode, setImagesViewMode] = useState<"local" | "registry">("local");
  const [playgroundCommand, setPlaygroundCommand] = useState<string>();
  const preserveSearchOnNextPageRef = useRef(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(() => loadShortcutSettings());
  const titleBarRef = useRef<TitleBarHandle>(null);
  const searchEnabledRef = useRef(false);

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingStatus(true);
    }

    try {
      setDockerStatus(await fetchDockerStatus());
    } catch {
      setDockerStatus({
        isRunning: false,
        engineState: "unavailable",
        message: "Oxidock could not reach Docker. Check that Docker Engine is running.",
        serverVersion: null,
        apiVersion: null,
        providerId: null,
        providerName: "Docker",
        contextName: null,
        endpointLabel: "Default",
        lifecycleCapabilities: [],
      });
    } finally {
      if (!options?.silent) {
        setIsLoadingStatus(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useDockerStatusChanged(
    useCallback(() => {
      void loadStatus({ silent: true });
    }, [loadStatus])
  );

  const refreshDockerData = useCallback(async () => {
    await loadStatus();
    setEngineRevision((revision) => revision + 1);
  }, [loadStatus]);

  useEffect(() => {
    if (preserveSearchOnNextPageRef.current) {
      preserveSearchOnNextPageRef.current = false;
      return;
    }

    setSearchQuery("");
  }, [activePage]);

  useEffect(() => {
    const reloadShortcuts = () => {
      setShortcutSettings(loadShortcutSettings());
    };

    window.addEventListener(SHORTCUT_SETTINGS_CHANGED_EVENT, reloadShortcuts);
    return () => window.removeEventListener(SHORTCUT_SETTINGS_CHANGED_EVENT, reloadShortcuts);
  }, []);

  const searchEnabled = activePage !== "settings";
  searchEnabledRef.current = searchEnabled;

  const { openPlaygroundWithCommand, resetImagesViewMode, handleSearchResultSelect, buildShortcutHandlers } =
    useAppNavigation({
      preserveSearchOnNextPageRef,
      setActivePage,
      setSearchQuery,
      setDocsLessonId,
      setDocsCommandId,
      setImagesViewMode,
      setPlaygroundCommand,
      titleBarRef,
      searchEnabled,
      loadStatus,
    });

  useMenuActions({
    titleBarRef,
    searchEnabledRef,
    onPageChange: setActivePage,
    onRefreshDocker: refreshDockerData,
  });

  const shortcutHandlers = useMemo(() => buildShortcutHandlers(), [buildShortcutHandlers]);

  useAppShortcuts(shortcutSettings, shortcutHandlers);

  const searchShortcutLabel = formatShortcutLabel(shortcutSettings.focusSearch);

  const handleEngineChanged = useCallback(
    (revision: number) => {
      setEngineRevision(revision);
      void loadStatus();
    },
    [loadStatus]
  );

  const pageContent = (
    <AppRouter
      activePage={activePage}
      dockerStatus={dockerStatus}
      docsLessonId={docsLessonId}
      docsCommandId={docsCommandId}
      onDocsCommandTargetConsumed={() => setDocsCommandId(undefined)}
      engineRevision={engineRevision}
      imagesViewMode={imagesViewMode}
      isLoadingStatus={isLoadingStatus}
      playgroundCommand={playgroundCommand}
      searchQuery={searchQuery}
      themePreference={themePreference}
      onEngineChanged={handleEngineChanged}
      onOpenPlayground={openPlaygroundWithCommand}
      onOpenSettingsPage={() => setActivePage("settings")}
      onResetImagesViewMode={resetImagesViewMode}
      onThemePreferenceChange={setThemePreference}
    />
  );

  return (
    <AppShell
      dockerStatus={dockerStatus}
      engineRevision={engineRevision}
      isLoading={isLoadingStatus}
      searchEnabled={searchEnabled}
      searchQuery={searchQuery}
      searchShortcutLabel={searchShortcutLabel}
      titleBarRef={titleBarRef}
      sidebar={
        <Sidebar
          activePage={activePage}
          autoCollapse={activePage === "cli" || activePage === "docs"}
          isLoading={isLoadingStatus}
          status={dockerStatus}
          onEngineChanged={handleEngineChanged}
          onPageChange={setActivePage}
        />
      }
      onOpenSettings={() => setActivePage("settings")}
      onOpenHelp={() => setActivePage("docs")}
      onRefresh={() => void refreshDockerData()}
      onSearchChange={setSearchQuery}
      onSearchResultSelect={(result) => void handleSearchResultSelect(result)}
    >
      {pageContent}
    </AppShell>
  );
}

export default App;

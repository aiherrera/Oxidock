import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { DockerCommandLessonId } from "../lib/docker-command-lessons";
import type { DockerCommandId } from "../lib/docker-command-registry";
import { shortcutActionToPage, type ShortcutActionId } from "../lib/shortcut-settings";
import type { AppPage } from "../types/app";
import type { IntelligentSearchResult, SearchResultAction } from "../types/intelligent-search";
import type { TitleBarHandle } from "../components/title-bar";

type UseAppNavigationOptions = {
  preserveSearchOnNextPageRef: MutableRefObject<boolean>;
  setActivePage: Dispatch<SetStateAction<AppPage>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setDocsLessonId: Dispatch<SetStateAction<DockerCommandLessonId>>;
  setDocsCommandId: Dispatch<SetStateAction<DockerCommandId | undefined>>;
  setImagesViewMode: Dispatch<SetStateAction<"local" | "registry">>;
  setPlaygroundCommand: Dispatch<SetStateAction<string | undefined>>;
  titleBarRef: MutableRefObject<TitleBarHandle | null>;
  searchEnabled: boolean;
  loadStatus: () => Promise<void>;
};

export function useAppNavigation({
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
}: UseAppNavigationOptions) {
  const openPlaygroundWithCommand = useCallback(
    (command: string) => {
      setPlaygroundCommand(command);
      setActivePage("cli");
    },
    [setActivePage, setPlaygroundCommand]
  );

  const resetImagesViewMode = useCallback(() => {
    setImagesViewMode("local");
  }, [setImagesViewMode]);

  const handleSearchResultSelect = useCallback(
    async (result: IntelligentSearchResult) => {
      const runAction = async (action: SearchResultAction) => {
        switch (action.type) {
          case "open-external":
            await openUrl(action.url);
            return;
          case "open-playground":
            if (action.command) {
              preserveSearchOnNextPageRef.current = true;
              openPlaygroundWithCommand(action.command);
            }
            return;
          case "navigate": {
            preserveSearchOnNextPageRef.current = true;
            if (action.query !== undefined) {
              setSearchQuery(action.query);
            }
            if (action.page === "docs") {
              setDocsCommandId(action.commandId);
            }
            if (action.lessonId) {
              setDocsLessonId(action.lessonId);
            }
            if (action.imagesViewMode) {
              setImagesViewMode(action.imagesViewMode);
            }
            setActivePage(action.page);
            return;
          }
          default:
            return;
        }
      };

      await runAction(result.action);
    },
    [
      openPlaygroundWithCommand,
      preserveSearchOnNextPageRef,
      setActivePage,
      setDocsLessonId,
      setDocsCommandId,
      setImagesViewMode,
      setSearchQuery,
    ]
  );

  const buildShortcutHandlers = useCallback((): Partial<Record<ShortcutActionId, () => void>> => {
    const handlers: Partial<Record<ShortcutActionId, () => void>> = {
      focusSearch: () => {
        if (searchEnabled) {
          titleBarRef.current?.focusSearch();
        }
      },
      refresh: () => {
        void loadStatus();
      },
      openSettings: () => {
        setActivePage("settings");
      },
    };

    const navigationActions: ShortcutActionId[] = [
      "navigateContainers",
      "navigateImages",
      "navigateVolumes",
      "navigateNetworks",
      "navigateEvents",
      "navigateLogs",
      "navigateCli",
      "navigateDocs",
    ];

    for (const actionId of navigationActions) {
      const page = shortcutActionToPage(actionId);
      if (page) {
        handlers[actionId] = () => setActivePage(page);
      }
    }

    return handlers;
  }, [loadStatus, searchEnabled, setActivePage, titleBarRef]);

  return {
    openPlaygroundWithCommand,
    resetImagesViewMode,
    handleSearchResultSelect,
    buildShortcutHandlers,
  };
}

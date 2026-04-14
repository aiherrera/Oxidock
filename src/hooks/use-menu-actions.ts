import { listen } from "@tauri-apps/api/event";
import { useEffect, type RefObject } from "react";
import type { TitleBarHandle } from "../components/title-bar";
import { isMenuActionId, MENU_ACTION_EVENT, pageFromMenuAction, type MenuActionPayload } from "../lib/menu-events";
import type { AppPage } from "../types/app";

type UseMenuActionsOptions = {
  titleBarRef: RefObject<TitleBarHandle | null>;
  searchEnabledRef: RefObject<boolean>;
  onPageChange: (page: AppPage) => void;
  onRefreshDocker: () => void | Promise<void>;
};

export function useMenuActions({
  titleBarRef,
  searchEnabledRef,
  onPageChange,
  onRefreshDocker,
}: UseMenuActionsOptions) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setupMenuListener = async () => {
      unlisten = await listen<MenuActionPayload>(MENU_ACTION_EVENT, (event) => {
        const action = event.payload.action;
        if (!isMenuActionId(action)) {
          return;
        }

        const page = pageFromMenuAction(action);
        if (page) {
          onPageChange(page);
        }

        if (action === "refresh_docker") {
          void onRefreshDocker();
        }

        if (action === "focus_search" && searchEnabledRef.current) {
          titleBarRef.current?.focusSearch();
        }
      });

      if (disposed) {
        unlisten();
      }
    };

    void setupMenuListener();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onPageChange, onRefreshDocker, searchEnabledRef, titleBarRef]);
}

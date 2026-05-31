import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useIntelligentSearch } from "../hooks/use-intelligent-search";
import type { AppPage } from "../types/app";
import type { IntelligentSearchResult } from "../types/intelligent-search";
import type { DockerStatus } from "../types/docker";
import { GlobalSearchPalette, type GlobalSearchPaletteHandle } from "./global-search-palette";
import { statusBadgeDanger, statusBadgeSuccess } from "../lib/theme-classes";
import { IconBook, IconRefresh, IconSettings } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type TitleBarHandle = {
  focusSearch: () => void;
};

type TitleBarProps = {
  searchQuery: string;
  activePage?: AppPage;
  searchEnabled?: boolean;
  searchShortcutLabel?: string;
  isLoading: boolean;
  status: DockerStatus | null;
  engineRevision?: number;
  onSearchChange: (query: string) => void;
  onSearchResultSelect: (result: IntelligentSearchResult) => void;
  onRefresh: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
};

export const TitleBar = forwardRef<TitleBarHandle, TitleBarProps>(function TitleBar(
  {
    searchQuery,
    activePage,
    searchEnabled = true,
    searchShortcutLabel = "⌘K",
    isLoading,
    status,
    engineRevision = 0,
    onSearchChange,
    onSearchResultSelect,
    onRefresh,
    onOpenHelp,
    onOpenSettings,
  },
  ref
) {
  const desktopPaletteRef = useRef<GlobalSearchPaletteHandle>(null);
  const mobilePaletteRef = useRef<GlobalSearchPaletteHandle>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isRunning = Boolean(status?.isRunning);

  const { groups, isSearchingRegistry, registryMessage } = useIntelligentSearch({
    query: searchQuery,
    currentPage: activePage,
    enabled: searchEnabled && paletteOpen,
    dockerRunning: isRunning,
    engineRevision,
  });

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        desktopPaletteRef.current?.focusSearch();
        return;
      }

      mobilePaletteRef.current?.focusSearch();
    },
  }));

  return (
    <header className="title-bar shrink-0 border-b border-(--border) bg-(--titlebar)">
      <div
        className="flex h-(--titlebar-height) items-center gap-3 px-3"
        data-tauri-drag-region="deep"
      >
        <div
          className="title-bar__brand min-w-20"
          data-tauri-drag-region
        >
          <span
            className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium sm:inline-flex ${
              isLoading ? "border-(--border) text-(--text-muted)" : isRunning ? statusBadgeSuccess : statusBadgeDanger
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isLoading ? "animate-pulse bg-slate-400" : isRunning ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {isLoading ? "Syncing" : isRunning ? (status?.providerName ?? "Engine live") : "Offline"}
          </span>
        </div>

        <div
          aria-hidden
          className="hidden min-w-8 flex-1 md:block"
          data-tauri-drag-region
        />

        {searchEnabled ? (
          <div className="title-bar__search hidden w-full max-w-xl min-w-0 md:block">
            <GlobalSearchPalette
              ref={desktopPaletteRef}
              groups={groups}
              isSearchingRegistry={isSearchingRegistry}
              registryMessage={registryMessage}
              searchQuery={searchQuery}
              searchShortcutLabel={searchShortcutLabel}
              onOpenChange={setPaletteOpen}
              onSearchChange={onSearchChange}
              onSelectResult={onSearchResultSelect}
            />
          </div>
        ) : null}

        <div
          aria-hidden
          className="hidden min-w-4 flex-1 lg:block"
          data-tauri-drag-region
        />

        <div className="title-bar__actions ml-auto flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              aria-label="Refresh Docker data"
              className="inline-flex size-8 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-50"
              disabled={isLoading}
              type="button"
              onClick={onRefresh}
            >
              <IconRefresh className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh Docker status and visible data</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              aria-label="Open documentation"
              className="inline-flex size-8 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
              disabled={!onOpenHelp}
              type="button"
              onClick={onOpenHelp}
            >
              <IconBook className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {onOpenHelp ? "Open Docker command docs and examples" : "Documentation unavailable"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              aria-label="Open settings"
              className="inline-flex size-8 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
              disabled={!onOpenSettings}
              type="button"
              onClick={onOpenSettings}
            >
              <IconSettings className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {onOpenSettings ? "Open settings (Cmd+,)" : "Settings unavailable"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {searchEnabled ? (
        <div className="border-t border-(--border) px-3 py-2 md:hidden">
          <GlobalSearchPalette
            ref={mobilePaletteRef}
            groups={groups}
            isSearchingRegistry={isSearchingRegistry}
            registryMessage={registryMessage}
            searchQuery={searchQuery}
            onOpenChange={setPaletteOpen}
            onSearchChange={onSearchChange}
            onSelectResult={onSearchResultSelect}
          />
        </div>
      ) : null}
    </header>
  );
});

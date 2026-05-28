import type { ReactNode, Ref } from "react";
import type { IntelligentSearchResult } from "../types/intelligent-search";
import type { DockerStatus } from "../types/docker";
import { TitleBar, type TitleBarHandle } from "./title-bar";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  searchQuery: string;
  searchEnabled?: boolean;
  searchShortcutLabel?: string;
  isLoading: boolean;
  dockerStatus: DockerStatus | null;
  engineRevision?: number;
  titleBarRef?: Ref<TitleBarHandle>;
  onSearchChange: (query: string) => void;
  onSearchResultSelect: (result: IntelligentSearchResult) => void;
  onRefresh: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
};

export function AppShell({
  sidebar,
  children,
  searchQuery,
  searchEnabled = true,
  searchShortcutLabel,
  isLoading,
  dockerStatus,
  engineRevision = 0,
  titleBarRef,
  onSearchChange,
  onSearchResultSelect,
  onRefresh,
  onOpenHelp,
  onOpenSettings,
}: AppShellProps) {
  return (
    <div className="flex h-screen min-h-[640px] min-w-[960px] flex-col overflow-hidden bg-(--bg) text-(--text-primary)">
      <TitleBar
        ref={titleBarRef}
        isLoading={isLoading}
        searchEnabled={searchEnabled}
        searchQuery={searchQuery}
        searchShortcutLabel={searchShortcutLabel}
        engineRevision={engineRevision}
        status={dockerStatus}
        onOpenHelp={onOpenHelp}
        onOpenSettings={onOpenSettings}
        onRefresh={onRefresh}
        onSearchChange={onSearchChange}
        onSearchResultSelect={onSearchResultSelect}
      />

      <div className="flex min-h-0 flex-1">
        {sidebar}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

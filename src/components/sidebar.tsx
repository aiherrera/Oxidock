import { useEffect, useState } from "react";
import type { AppPage } from "../types/app";
import { APP_PAGES } from "../types/app";
import type { DockerStatus } from "../types/docker";
import { useEngineLifecycle } from "../hooks/use-engine-lifecycle";
import { getEngineStateColorClass, getEngineStateLabel, getSidebarLifecycleActions } from "../lib/engine-ui";
import type { EngineLifecycleAction } from "../types/engine";
import { BrandLogo } from "./brand-logo";
import {
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconBook,
  IconEvents,
  IconImageStack,
  IconLogs,
  IconNetwork,
  IconPause,
  IconPlay,
  IconSettings,
  IconStop,
  IconTerminal,
  IconVolume,
} from "./icons";

type SidebarProps = {
  activePage: AppPage;
  status: DockerStatus | null;
  isLoading: boolean;
  autoCollapse?: boolean;
  onEngineChanged?: (revision: number) => void;
  onPageChange: (page: AppPage) => void;
};

const COMPACT_SIDEBAR_QUERY = "(max-width: 1023px)";

const pageIcons: Record<AppPage, typeof IconBox> = {
  containers: IconBox,
  images: IconImageStack,
  volumes: IconVolume,
  networks: IconNetwork,
  events: IconEvents,
  logs: IconLogs,
  cli: IconTerminal,
  docs: IconBook,
  settings: IconSettings,
};

const lifecycleIconByAction: Record<EngineLifecycleAction, typeof IconPlay> = {
  start: IconPlay,
  pause: IconPause,
  stop: IconStop,
};

export function Sidebar({
  activePage,
  status,
  isLoading,
  autoCollapse = false,
  onEngineChanged,
  onPageChange,
}: SidebarProps) {
  const isRunning = Boolean(status?.isRunning);
  const engineLabel = status?.providerName ?? "Container engine";
  const [isCompact, setIsCompact] = useState(false);
  const { runningLifecycleAction, actionError, runLifecycleAction } = useEngineLifecycle({
    providerId: status?.providerId,
    onEngineChanged,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_SIDEBAR_QUERY);
    const syncCompactState = () => setIsCompact(mediaQuery.matches);

    syncCompactState();
    mediaQuery.addEventListener("change", syncCompactState);

    return () => mediaQuery.removeEventListener("change", syncCompactState);
  }, []);

  useEffect(() => {
    if (autoCollapse) {
      setIsCompact(true);
    }
  }, [autoCollapse]);

  const ToggleIcon = isCompact ? IconChevronRight : IconChevronLeft;
  const overviewItems = APP_PAGES.filter((page) => page.section === "overview");
  const toolItems = APP_PAGES.filter((page) => page.section === "tools");
  const engineState = isLoading ? "checking" : (status?.engineState ?? "unavailable");
  const stateLabel = getEngineStateLabel(engineState, runningLifecycleAction);
  const stateColorClass = getEngineStateColorClass(engineState, runningLifecycleAction);
  const lifecycleActions = getSidebarLifecycleActions(status?.engineState, status?.lifecycleCapabilities ?? []);

  const renderNavItem = (page: (typeof APP_PAGES)[number]) => {
    const Icon = pageIcons[page.id];
    const isActive = activePage === page.id;

    return (
      <li key={page.id}>
        <button
          aria-current={isActive ? "page" : undefined}
          aria-label={page.label}
          className={`flex min-h-11 w-full items-center rounded-md text-sm transition ${
            isCompact ? "justify-center px-2" : "gap-2 px-2.5"
          } ${
            isActive
              ? "bg-(--accent-soft) text-(--accent)"
              : "text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
          type="button"
          title={page.label}
          onClick={() => onPageChange(page.id)}
        >
          <Icon className="size-5 shrink-0" />
          <span className={isCompact ? "sr-only" : ""}>{page.label}</span>
        </button>
      </li>
    );
  };

  return (
    <aside
      className={`relative z-40 flex h-full shrink-0 flex-col border-r border-(--border) bg-(--sidebar) transition-[width] duration-200 ${
        isCompact ? "w-16" : "w-64"
      }`}
    >
      <button
        aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={!isCompact}
        className="absolute right-0 top-14 z-50 flex size-9 translate-x-1/2 items-center justify-center rounded-full border border-(--border) bg-(--surface-elevated) text-(--text-secondary) shadow-lg transition hover:border-(--accent) hover:text-(--accent)"
        type="button"
        onClick={() => setIsCompact((current) => !current)}
      >
        <ToggleIcon className="size-5" />
      </button>

      <div
        className={`flex items-center border-b border-(--border) py-4 ${
          isCompact ? "justify-center px-2" : "gap-2 px-4"
        }`}
      >
        <BrandLogo compact={isCompact} />
        <span
          aria-hidden={isCompact}
          className={`rounded border border-(--border) px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-(--text-muted) ${
            isCompact ? "hidden" : "ml-auto"
          }`}
        >
          BETA
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p
          className={`px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted) ${
            isCompact ? "sr-only" : ""
          }`}
        >
          Overview
        </p>
        <ul className="mt-2 space-y-0.5">{overviewItems.map(renderNavItem)}</ul>

        <p
          className={`mt-6 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted) ${
            isCompact ? "sr-only" : ""
          }`}
        >
          Tools
        </p>
        <ul className="mt-2 space-y-0.5">{toolItems.map(renderNavItem)}</ul>
      </nav>

      <div className={`border-t border-(--border) ${isCompact ? "py-1 px-3" : "p-3"}`}>
        <div
          className={`flex items-center rounded-lg border border-(--border) bg-(--surface) ${
            isCompact ? "min-h-9 p-0" : "min-h-22 p-3"
          }`}
          title={
            isLoading
              ? `${engineLabel}: Checking...`
              : isRunning
                ? `${engineLabel}: Connected`
                : `${engineLabel}: ${stateLabel}`
          }
        >
          <div
            className={`w-full ${
              isCompact ? "flex items-center justify-center" : "flex items-center justify-between gap-3"
            }`}
          >
            <div className={isCompact ? "flex items-center justify-center" : "min-w-0"}>
              <p className={`text-xs font-medium text-(--text-secondary) ${isCompact ? "sr-only" : ""}`}>
                {engineLabel}
              </p>
              <p className={`flex items-center gap-2 text-sm text-(--text-primary) ${isCompact ? "" : "mt-2"}`}>
                <span
                  className={`shrink-0 rounded-full ${isCompact ? "size-3" : "size-2"} ${
                    isLoading ? "animate-pulse bg-slate-500" : stateColorClass
                  }`}
                />
                <span className={isCompact ? "sr-only" : "truncate"}>{stateLabel}</span>
              </p>
              {!isCompact && actionError ? (
                <p className="mt-2 line-clamp-2 text-xs text-red-400">{actionError}</p>
              ) : null}
            </div>
            {!isCompact ? (
              <div className="ml-auto flex shrink-0 flex-col items-end gap-2 text-right">
                {lifecycleActions.length > 0 ? (
                  <div className="flex justify-end gap-1.5">
                    {lifecycleActions.map((capability) => {
                      const ActionIcon = lifecycleIconByAction[capability.action];
                      const isActionRunning = runningLifecycleAction === capability.action;
                      const disabled = runningLifecycleAction !== null || isLoading;

                      return (
                        <button
                          key={capability.action}
                          aria-label={capability.label}
                          className="flex size-7 items-center justify-center rounded-md border border-(--border) text-(--text-primary) transition hover:bg-(--surface-hover) disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disabled}
                          title={capability.label}
                          type="button"
                          onClick={() => void runLifecycleAction(capability)}
                        >
                          <ActionIcon className={`size-4 ${isActionRunning ? "animate-pulse" : ""}`} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {status?.serverVersion || status?.apiVersion ? (
                  <div className="text-xs text-(--text-muted)">
                    {status?.serverVersion ? <p>v{status.serverVersion}</p> : null}
                    {status?.apiVersion ? <p>API {status.apiVersion}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

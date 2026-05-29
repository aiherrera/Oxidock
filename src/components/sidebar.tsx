import { useEffect, useState } from "react";
import type { AppPage } from "../types/app";
import { APP_PAGE_SECTIONS, getAppPagesBySection } from "../types/app";
import type { DockerStatus } from "../types/docker";
import { BrandLogo } from "./brand-logo";
import { SidebarResourcePanel } from "./sidebar-resource-panel";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  IconAssistant,
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconCommandSchool,
  IconDashboard,
  IconEvents,
  IconImageStack,
  IconLogs,
  IconNetwork,
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

const pageDescriptions: Record<AppPage, string> = {
  dashboard: "Scan Docker health, app insights, and the quickest next action.",
  containers: "Inspect, search, and manage running or stopped containers.",
  images: "Browse local images, registry results, tags, and cleanup options.",
  volumes: "Review persistent data usage and spot orphaned Docker volumes.",
  networks: "Map Docker networks and see how containers are connected.",
  events: "Watch recent Docker activity as it happens across the engine.",
  logs: "Search and read container output without leaving Oxidock.",
  docs: "Learn practical Docker commands through guided lessons.",
  cli: "Run Docker commands safely with history and helpful context.",
  assistant: "Ask for Docker help grounded in your local app state.",
  settings: "Tune app preferences, theme, and Docker engine settings.",
};

const pageIcons: Record<AppPage, typeof IconBox> = {
  dashboard: IconDashboard,
  containers: IconBox,
  images: IconImageStack,
  volumes: IconVolume,
  networks: IconNetwork,
  events: IconEvents,
  logs: IconLogs,
  assistant: IconAssistant,
  cli: IconTerminal,
  docs: IconCommandSchool,
  settings: IconDashboard,
};

export function Sidebar({ activePage, autoCollapse = false, onPageChange }: SidebarProps) {
  const [isCompact, setIsCompact] = useState(false);

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

  const renderNavItem = (page: ReturnType<typeof getAppPagesBySection>[number]) => {
    const Icon = pageIcons[page.id];
    const isActive = activePage === page.id;
    const sectionLabel = APP_PAGE_SECTIONS.find((section) => section.id === page.section)?.label ?? "Navigate";

    return (
      <li key={page.id}>
        <Tooltip>
          <TooltipTrigger
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
            onClick={() => onPageChange(page.id)}
          >
            <Icon className="size-5 shrink-0" />
            <span className={isCompact ? "sr-only" : ""}>{page.label}</span>
          </TooltipTrigger>
          <TooltipContent
            align="start"
            className="w-72 rounded-xl border border-(--border) bg-(--surface-elevated) p-3 text-(--text-primary) shadow-2xl shadow-black/20 backdrop-blur"
            side="right"
            sideOffset={12}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--border) bg-(--surface-hover) text-(--accent)">
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold leading-none">{page.label}</span>
                  {isActive ? (
                    <span className="rounded-full border border-(--accent)/40 bg-(--accent-soft) px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-(--accent)">
                      Active
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block text-xs leading-5 text-(--text-muted)">{pageDescriptions[page.id]}</span>
                <span className="mt-2 inline-flex rounded-full border border-(--border) px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">
                  {sectionLabel}
                </span>
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </li>
    );
  };

  return (
    <aside
      className={`relative z-40 flex h-full shrink-0 flex-col border-r border-(--border) bg-(--sidebar) transition-[width] duration-200 ${
        isCompact ? "w-16" : "w-64"
      }`}
    >
      <Tooltip>
        <TooltipTrigger
          aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={!isCompact}
          className="absolute right-0 top-14 z-50 flex size-9 translate-x-1/2 items-center justify-center rounded-full border border-(--border) bg-(--surface-elevated) text-(--text-secondary) shadow-lg transition hover:border-(--accent) hover:text-(--accent)"
          type="button"
          onClick={() => setIsCompact((current) => !current)}
        >
          <ToggleIcon className="size-5" />
        </TooltipTrigger>
        <TooltipContent
          align="center"
          className="rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-xs font-medium text-(--text-primary) shadow-xl"
          side="right"
          sideOffset={12}
        >
          {isCompact ? "Expand navigation" : "Collapse navigation"}
        </TooltipContent>
      </Tooltip>

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
        {APP_PAGE_SECTIONS.map((section, sectionIndex) => (
          <div
            className={sectionIndex > 0 ? "mt-6" : undefined}
            key={section.id}
          >
            <p
              className={`px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted) ${
                isCompact ? "sr-only" : ""
              }`}
            >
              {section.label}
            </p>
            <ul className="mt-2 space-y-0.5">{getAppPagesBySection(section.id).map(renderNavItem)}</ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-(--border) ${isCompact ? "px-2 py-2" : "p-3"}`}>
        <SidebarResourcePanel compact={isCompact} />
      </div>
    </aside>
  );
}

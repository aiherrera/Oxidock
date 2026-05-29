import type { ReactNode } from "react";
import { ContainersTotalsMetrics } from "./containers-totals-metrics";
import type { ContainerStatsInfo } from "../types/docker";

type ContainersToolbarProps = {
  showAll: boolean;
  runningCount: number;
  totalCount: number;
  containerTotals: ContainerStatsInfo | null;
  actions?: ReactNode;
  onShowAllChange: (showAll: boolean) => void;
};

export function ContainersToolbar({
  showAll,
  runningCount,
  totalCount,
  containerTotals,
  actions,
  onShowAllChange,
}: ContainersToolbarProps) {
  return (
    <div className="relative z-20 space-y-4 border-b border-(--border) bg-(--bg) px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-(--text-primary)">Containers</h1>
          <p className="mt-1 text-sm text-(--text-muted)">Manage your running and stopped containers.</p>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              !showAll
                ? "bg-(--surface-elevated) text-(--text-primary)"
                : "text-(--text-muted) hover:text-(--text-primary)"
            }`}
            type="button"
            onClick={() => onShowAllChange(false)}
          >
            Running only ({runningCount})
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              showAll
                ? "bg-(--surface-elevated) text-(--text-primary)"
                : "text-(--text-muted) hover:text-(--text-primary)"
            }`}
            type="button"
            onClick={() => onShowAllChange(true)}
          >
            All containers ({totalCount})
          </button>
        </div>
        <ContainersTotalsMetrics totals={containerTotals} />
      </div>
    </div>
  );
}

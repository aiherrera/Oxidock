import type { ContainerStatsInfo } from "../types/docker";

type ContainersTotalsMetricsProps = {
  totals: ContainerStatsInfo | null;
};

export function ContainersTotalsMetrics({ totals }: ContainersTotalsMetricsProps) {
  const ram = totals?.memoryUsage ?? "--";
  const cpu = totals?.cpuPercent ?? "--";
  const disk = totals?.diskReadWrite ?? "--";

  return (
    <div
      aria-label="Container resource totals"
      className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">All containers usage</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-(--text-secondary) sm:justify-end">
        <span>
          RAM <span className="text-(--text-primary)">{ram}</span>
        </span>
        <span>
          CPU <span className="text-(--text-primary)">{cpu}</span>
        </span>
        <span>
          Disk <span className="text-(--text-primary)">{disk}</span>
        </span>
      </div>
    </div>
  );
}

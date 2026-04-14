import { isRunning, parseStatsPercent } from "../lib/container-utils";
import type { ContainerInfo, ContainerStatsInfo } from "../types/docker";

type ContainerStatsPanelProps = {
  container: ContainerInfo;
  stats: ContainerStatsInfo | null;
};

type StatCardProps = {
  label: string;
  value: string;
  subValue?: string;
  percent?: number;
};

const StatCard = ({ label, value, subValue, percent }: StatCardProps) => (
  <div className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3">
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-(--text-muted)">{label}</p>
    <p className="mt-1 font-mono text-sm text-(--text-primary)">{value}</p>
    {subValue ? <p className="mt-0.5 text-xs text-(--text-secondary)">{subValue}</p> : null}
    {percent !== undefined ? (
      <div
        aria-hidden
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--border)"
      >
        <div
          className="h-full rounded-full bg-(--accent) transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    ) : null}
  </div>
);

export function ContainerStatsPanel({ container, stats }: ContainerStatsPanelProps) {
  const running = isRunning(container);

  if (!running) {
    return (
      <div className="rounded-lg border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
        Live stats are only available while the container is running.
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
          <p className="animate-pulse">Collecting stats…</p>
          <p className="mt-2 text-xs">
            The first sample may take a moment. CPU usage becomes more accurate after the next update.
          </p>
        </div>
        <p className="text-center text-xs text-(--text-muted)">Updated every 2s</p>
      </div>
    );
  }

  const cpuPercent = parseStatsPercent(stats.cpuPercent);
  const memoryPercent = parseStatsPercent(stats.memoryPercent);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="CPU"
          percent={cpuPercent}
          value={stats.cpuPercent}
        />
        <StatCard
          label="Memory"
          percent={memoryPercent}
          subValue={stats.memoryPercent}
          value={stats.memoryUsage}
        />
        <StatCard
          label="Disk read / write"
          value={stats.diskReadWrite}
        />
        <StatCard
          label="Network I/O"
          value={stats.networkIo}
        />
        <StatCard
          label="PIDs"
          value={stats.pids}
        />
      </div>
      <p className="text-center text-xs text-(--text-muted)">Updated every 2s</p>
    </div>
  );
}

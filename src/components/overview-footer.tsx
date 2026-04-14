import { useAppResourceUsage } from "../hooks/use-app-resource-usage";

type OverviewFooterProps = {
  statusLabel: string;
};

export function OverviewFooter({ statusLabel }: OverviewFooterProps) {
  const metrics = useAppResourceUsage();

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-(--border) px-4 py-3 text-sm text-(--text-muted) sm:px-6">
      <p className="min-w-0">{statusLabel}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-(--text-secondary)">
        <span>RAM {metrics.ram}</span>
        <span>CPU {metrics.cpu}</span>
        <span>
          Disk: {metrics.diskUsed} used (limit {metrics.diskLimit})
        </span>
      </div>
    </footer>
  );
}

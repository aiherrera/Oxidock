import type { DockerStatus } from "../types/docker";

type DockerStatusCardProps = {
  status: DockerStatus | null;
  isLoading: boolean;
};

export function DockerStatusCard({ status, isLoading }: DockerStatusCardProps) {
  const isRunning = Boolean(status?.isRunning);
  const indicatorClass = isRunning ? "bg-emerald-400" : "bg-red-400";

  return (
    <section className="rounded-3xl border border-(--border) bg-(--surface) p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--text-muted)">Docker daemon</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold text-(--text-primary)">
            <span className={`size-2.5 rounded-full ${isLoading ? "animate-pulse bg-slate-500" : indicatorClass}`} />
            {isLoading ? "Checking status" : isRunning ? "Connected" : "Unavailable"}
          </h2>
        </div>
        {status?.serverVersion ? (
          <span className="rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs text-(--text-secondary)">
            Engine {status.serverVersion}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-(--text-muted)">
        {status?.message ?? "Oxidock checks the local Docker Engine through typed Tauri IPC."}
      </p>
    </section>
  );
}

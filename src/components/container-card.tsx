import { CommandBadge } from "./command-badge";
import { CommandTooltip } from "./command-tooltip";
import type { ContainerInfo } from "../types/docker";
import { statusBadgeSuccess, statusBadgeWarning } from "../lib/theme-classes";
import { CopyContainerId } from "./copy-container-id";

type ContainerCardProps = {
  container: ContainerInfo;
};

const stateClasses: Record<string, string> = {
  running: statusBadgeSuccess,
  exited: "border border-(--border) bg-(--surface-hover) text-(--text-muted)",
  paused: statusBadgeWarning,
  restarting: "border border-(--accent)/30 bg-(--accent-soft) text-(--accent)",
};

const actionButtonClass =
  "rounded-xl border border-(--border) bg-(--surface-elevated) px-3 py-2 text-xs font-semibold text-(--text-secondary) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-50";

export function ContainerCard({ container }: ContainerCardProps) {
  const normalizedState = container.state.toLowerCase();
  const stateClass =
    stateClasses[normalizedState] ?? "border border-(--border) bg-(--surface-hover) text-(--text-muted)";

  return (
    <article className="rounded-3xl border border-(--border) bg-(--surface) p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-(--text-primary)">{container.name}</h3>
          <CopyContainerId
            className="mt-1"
            shortId={container.shortId}
          />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${stateClass}`}>
          {container.state || "unknown"}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-(--text-muted)">Image</dt>
          <dd className="mt-1 truncate font-mono text-(--text-secondary)">{container.image}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-(--text-muted)">Status</dt>
          <dd className="mt-1 text-(--text-secondary)">{container.status || "No status reported"}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <CommandBadge
          commandId="containers.inspect"
          container={container.name}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <CommandTooltip
          commandId="containers.inspect"
          container={container.name}
        >
          <button
            className={actionButtonClass}
            type="button"
            disabled
          >
            Inspect
          </button>
        </CommandTooltip>
        <CommandTooltip
          commandId="containers.logs"
          container={container.name}
        >
          <button
            className={actionButtonClass}
            type="button"
            disabled
          >
            Logs
          </button>
        </CommandTooltip>
        <CommandTooltip
          commandId="containers.start"
          container={container.name}
        >
          <button
            className={actionButtonClass}
            type="button"
            disabled
          >
            Start
          </button>
        </CommandTooltip>
        <CommandTooltip
          commandId="containers.stop"
          container={container.name}
        >
          <button
            className={actionButtonClass}
            type="button"
            disabled
          >
            Stop
          </button>
        </CommandTooltip>
        <CommandTooltip
          commandId="containers.restart"
          container={container.name}
        >
          <button
            className={actionButtonClass}
            type="button"
            disabled
          >
            Restart
          </button>
        </CommandTooltip>
      </div>
    </article>
  );
}

import type { ContainerStatsInfo, ProjectHealth, TableRow } from "../types/docker";
import { getContainerHealth, isRunning } from "../lib/container-utils";
import { CopyContainerId } from "./copy-container-id";
import { IconBox, IconChevronDown, IconChevronRight, IconInfo, IconMore, IconTerminal } from "./icons";

type ContainersTableProps = {
  rows: TableRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenInspector: (id: string) => void;
  onToggleProject: (project: string) => void;
};

const EMPTY_CELL = "—";

const TABLE_COLUMNS = [
  "w-10",
  "w-[13rem]",
  "w-[9rem]",
  "w-[12rem]",
  "w-[8rem]",
  "w-[6rem]",
  "w-[11rem]",
  "w-[7rem]",
  "w-[11rem]",
  "w-[11rem]",
  "w-[5rem]",
  "w-[8rem]",
  "w-[7rem]",
] as const;

const StatusDot = ({ health }: { health: ProjectHealth }) => {
  if (health === "healthy") {
    return (
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full bg-emerald-400"
      />
    );
  }

  if (health === "partial") {
    return (
      <span
        aria-hidden
        className="relative size-2.5 shrink-0"
      >
        <span className="absolute inset-0 rounded-full bg-slate-600" />
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-emerald-400" />
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full bg-slate-500"
    />
  );
};

const StatsCells = ({ stats }: { stats: ContainerStatsInfo | null }) => (
  <>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">{stats?.cpuPercent ?? "0%"}</td>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">
      {stats?.memoryUsage ?? "0B / 0B"}
    </td>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">{stats?.memoryPercent ?? "0%"}</td>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">
      {stats?.diskReadWrite ?? "0B / 0B"}
    </td>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">
      {stats?.networkIo ?? "0B / 0B"}
    </td>
    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-(--text-secondary)">{stats?.pids ?? "0"}</td>
  </>
);

export function ContainersTable({
  rows,
  selectedId,
  onSelect,
  onOpenInspector,
  onToggleProject,
}: ContainersTableProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[1400px] table-fixed border-collapse text-sm">
          <colgroup>
            {TABLE_COLUMNS.map((className, index) => (
              <col
                className={className}
                key={`${className}-${index}`}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-(--surface)">
            <tr className="whitespace-nowrap border-b border-(--border) text-left text-(--text-muted)">
              <th className="w-10 px-4 py-3 font-medium" />
              <th className="min-w-48 px-3 py-3 font-medium">Name</th>
              <th className="min-w-36 px-3 py-3 font-medium">Container ID</th>
              <th className="min-w-40 px-3 py-3 font-medium">Image</th>
              <th className="min-w-32 px-3 py-3 font-medium">Ports</th>
              <th className="min-w-20 px-3 py-3 font-medium">CPU (%)</th>
              <th className="min-w-36 px-3 py-3 font-medium">Memory usage</th>
              <th className="min-w-20 px-3 py-3 font-medium">Memory (%)</th>
              <th className="min-w-36 px-3 py-3 font-medium">Disk read/write</th>
              <th className="min-w-36 px-3 py-3 font-medium">Network I/O</th>
              <th className="min-w-16 px-3 py-3 font-medium">PIDS</th>
              <th className="min-w-32 px-3 py-3 font-medium">Last started</th>
              <th className="min-w-28 px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "project") {
                return (
                  <tr
                    className="cursor-pointer border-b border-(--border) bg-(--surface-elevated)/40 transition hover:bg-(--surface-hover)"
                    key={`project-${row.project}`}
                    onClick={() => onToggleProject(row.project)}
                  >
                    <td className="px-4 py-3">
                      <input
                        checked={false}
                        className="size-4 rounded border-(--border) bg-(--surface) accent-(--accent)"
                        type="checkbox"
                        readOnly
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {row.expanded ? (
                          <IconChevronDown className="size-4 shrink-0 text-(--text-muted)" />
                        ) : (
                          <IconChevronRight className="size-4 shrink-0 text-(--text-muted)" />
                        )}
                        <StatusDot health={row.health} />
                        <span className="font-medium text-(--text-primary) underline decoration-dashed decoration-(--text-muted) underline-offset-4">
                          {row.project}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-(--text-muted)">{EMPTY_CELL}</td>
                    <td className="px-3 py-3 text-(--text-muted)">{EMPTY_CELL}</td>
                    <td className="px-3 py-3 text-(--text-muted)">{EMPTY_CELL}</td>
                    <StatsCells stats={row.stats} />
                    <td className="whitespace-nowrap px-3 py-3 text-(--text-muted)">{EMPTY_CELL}</td>
                    <td className="px-3 py-3" />
                  </tr>
                );
              }

              const { container, stats, depth } = row;
              const selected = selectedId === container.id;
              const running = isRunning(container);
              const displayName = container.service ?? container.name;

              return (
                <tr
                  className={`cursor-pointer border-b border-(--border) transition ${
                    selected ? "bg-(--accent-soft) ring-1 ring-inset ring-(--accent)/40" : "hover:bg-(--surface-hover)"
                  }`}
                  key={container.id}
                  onClick={() => onSelect(container.id)}
                >
                  <td className="px-4 py-3">
                    <input
                      checked={selected}
                      className="size-4 rounded border-(--border) bg-(--surface) accent-(--accent)"
                      type="checkbox"
                      readOnly
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${depth * 1.25}rem` }}
                    >
                      {depth > 0 ? (
                        <span
                          className="size-4 shrink-0"
                          aria-hidden
                        />
                      ) : null}
                      <StatusDot health={getContainerHealth(container)} />
                      <IconBox className="size-4 shrink-0 text-(--text-muted)" />
                      <span className="truncate font-medium text-(--text-primary)">{displayName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <CopyContainerId shortId={container.shortId} />
                  </td>
                  <td className="max-w-48 truncate px-3 py-3 text-(--text-secondary)">{container.image}</td>
                  <td className="px-3 py-3">
                    {container.ports.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {container.ports.map((port) => (
                          <span
                            className="font-mono text-xs text-(--accent)"
                            key={`${container.id}-${port}`}
                          >
                            {port}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-(--text-muted)">{EMPTY_CELL}</span>
                    )}
                  </td>
                  <StatsCells stats={stats} />
                  <td className="whitespace-nowrap px-3 py-3 text-(--text-secondary)">
                    {container.lastStartedAt || EMPTY_CELL}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Inspect ${container.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenInspector(container.id);
                        }}
                      >
                        <IconInfo className="size-4" />
                      </button>
                      <button
                        aria-label={`Terminal ${container.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
                        type="button"
                        disabled={!running}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(container.id);
                        }}
                      >
                        <IconTerminal className="size-4" />
                      </button>
                      <button
                        aria-label={`More actions for ${container.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <IconMore className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-(--text-muted)">No containers match the current filters.</div>
        ) : null}
      </div>
    </div>
  );
}

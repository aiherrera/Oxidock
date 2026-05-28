import { useEffect, useMemo, useRef, useState } from "react";
import type { ContainerInfo, ContainerStatsInfo, ProjectHealth, TableRow } from "../types/docker";
import { getContainerHealth } from "../lib/container-utils";
import { getContainerActionAvailability } from "../lib/container-action-availability";
import { CopyContainerId } from "./copy-container-id";
import { CommandTooltip } from "./command-tooltip";
import {
  IconBox,
  IconChevronDown,
  IconChevronRight,
  IconInfo,
  IconMore,
  IconTerminal,
  IconPlay,
  IconRefresh,
  IconStop,
  IconTrash,
} from "./icons";

type ContainersTableProps = {
  rows: TableRow[];
  selectedId: string | null;
  onSelectRow: (id: string) => void;
  onOpenInspectTab: (id: string) => void;
  onOpenLogsTab: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onRequestRemove: (id: string, force: boolean) => void;
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
  onSelectRow,
  onOpenInspectTab,
  onOpenLogsTab,
  onStart,
  onStop,
  onRestart,
  onRequestRemove,
  onToggleProject,
}: ContainersTableProps) {
  const [openMenuForId, setOpenMenuForId] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<{
    container: ContainerInfo;
    force: boolean;
  } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const containersById = useMemo(() => {
    const map = new Map<string, ContainerInfo>();
    for (const row of rows) {
      if (row.kind === "container") {
        map.set(row.container.id, row.container);
      }
    }
    return map;
  }, [rows]);

  useEffect(() => {
    if (!openMenuForId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuForId(null);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const button = menuButtonRef.current;
      if (button && button.contains(target)) {
        return;
      }

      setOpenMenuForId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openMenuForId]);

  const activeMenuContainer = openMenuForId ? (containersById.get(openMenuForId) ?? null) : null;

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
              const availability = getContainerActionAvailability(container);
              const displayName = container.service ?? container.name;

              return (
                <tr
                  className={`cursor-pointer border-b border-(--border) transition ${
                    selected ? "bg-(--accent-soft) ring-1 ring-inset ring-(--accent)/40" : "hover:bg-(--surface-hover)"
                  }`}
                  key={container.id}
                  onClick={() => onSelectRow(container.id)}
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
                      <CommandTooltip
                        commandId="containers.inspect"
                        container={container.name}
                      >
                        <button
                          aria-label={`Inspect ${container.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenInspectTab(container.id);
                          }}
                        >
                          <IconInfo className="size-4" />
                        </button>
                      </CommandTooltip>

                      <CommandTooltip
                        commandId="containers.logs"
                        container={container.name}
                      >
                        <button
                          aria-label={`Logs ${container.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-45"
                          type="button"
                          disabled={!availability.canViewLogs}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenLogsTab(container.id);
                          }}
                        >
                          <IconTerminal className="size-4" />
                        </button>
                      </CommandTooltip>

                      <button
                        aria-label={`More actions for ${container.name}`}
                        className="relative inline-flex size-9 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
                        type="button"
                        ref={(node) => {
                          if (openMenuForId === container.id) {
                            menuButtonRef.current = node;
                          }
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuForId((current) => (current === container.id ? null : container.id));
                        }}
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

        {activeMenuContainer ? (
          <div className="pointer-events-none fixed inset-0 z-50">
            <div className="pointer-events-auto absolute right-6 top-24 w-56 rounded-xl border border-(--border) bg-(--surface-elevated) p-1 shadow-2xl shadow-black/30">
              <MenuItem
                label="Start"
                icon={<IconPlay className="size-4" />}
                disabled={!getContainerActionAvailability(activeMenuContainer).canStart}
                onSelect={() => {
                  setOpenMenuForId(null);
                  onStart(activeMenuContainer.id);
                }}
              />
              <MenuItem
                label="Stop"
                icon={<IconStop className="size-4" />}
                disabled={!getContainerActionAvailability(activeMenuContainer).canStop}
                onSelect={() => {
                  setOpenMenuForId(null);
                  onStop(activeMenuContainer.id);
                }}
              />
              <MenuItem
                label="Restart"
                icon={<IconRefresh className="size-4" />}
                disabled={!getContainerActionAvailability(activeMenuContainer).canRestart}
                onSelect={() => {
                  setOpenMenuForId(null);
                  onRestart(activeMenuContainer.id);
                }}
              />
              <div className="my-1 h-px bg-(--border)" />
              <MenuItem
                label="Remove"
                icon={<IconTrash className="size-4" />}
                tone="danger"
                disabled={!getContainerActionAvailability(activeMenuContainer).canRemove}
                onSelect={() => {
                  setOpenMenuForId(null);
                  const availability = getContainerActionAvailability(activeMenuContainer);
                  setRemoveDialog({
                    container: activeMenuContainer,
                    force: availability.forceRemove,
                  });
                }}
              />
            </div>
          </div>
        ) : null}

        {removeDialog ? (
          <RemoveContainerDialog
            container={removeDialog.container}
            force={removeDialog.force}
            open={Boolean(removeDialog)}
            onCancel={() => setRemoveDialog(null)}
            onConfirm={() => {
              const { container, force } = removeDialog;
              setRemoveDialog(null);
              onRequestRemove(container.id, force);
            }}
          />
        ) : null}

        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-(--text-muted)">No containers match the current filters.</div>
        ) : null}
      </div>
    </div>
  );
}

type MenuItemProps = {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  tone?: "default" | "danger";
  onSelect: () => void;
};

const MenuItem = ({ label, icon, disabled, tone = "default", onSelect }: MenuItemProps) => (
  <button
    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition ${
      tone === "danger"
        ? "text-red-100 hover:bg-red-500/15 disabled:text-(--text-muted)"
        : "text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:text-(--text-muted)"
    } disabled:cursor-not-allowed disabled:opacity-60`}
    type="button"
    disabled={disabled}
    onClick={onSelect}
  >
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
  </button>
);

type RemoveContainerDialogProps = {
  container: ContainerInfo;
  force: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const RemoveContainerDialog = ({ container, force, open, onCancel, onConfirm }: RemoveContainerDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return (
    <div
      aria-labelledby="remove-container-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
    >
      <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-(--surface-elevated) p-5 shadow-2xl shadow-black/40">
        <h2
          className="text-base font-semibold text-(--text-primary)"
          id="remove-container-title"
        >
          {force ? "Force remove container?" : "Remove container?"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
          {force
            ? `This will stop ${container.name} and permanently delete the container.`
            : `This will permanently delete ${container.name}.`}
        </p>
        <p className="mt-3 rounded-lg border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs text-(--code-text)">
          {force ? "docker rm -f" : "docker rm"} {container.shortId}
        </p>
        <p className="mt-3 text-xs leading-5 text-(--text-muted)">
          Container filesystems are not recoverable after removal. Named volumes are not removed by this action.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="inline-flex min-h-10 items-center rounded-lg border border-(--border) px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover)"
            ref={cancelRef}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/25"
            type="button"
            onClick={onConfirm}
          >
            Remove container
          </button>
        </div>
      </div>
    </div>
  );
};

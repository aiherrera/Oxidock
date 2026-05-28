import { IconTrash } from "./icons";

type ResourceBulkActionsBarProps = {
  selectedCount: number;
  visibleCount?: number;
  resourceLabel: string;
  isDeleting?: boolean;
  allVisibleSelected?: boolean;
  onSelectAllVisible?: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function ResourceBulkActionsBar({
  selectedCount,
  visibleCount,
  resourceLabel,
  isDeleting = false,
  allVisibleSelected = false,
  onSelectAllVisible,
  onDelete,
  onClearSelection,
}: ResourceBulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const label = selectedCount === 1 ? `1 ${resourceLabel}` : `${selectedCount} ${resourceLabel}s`;
  const canSelectAllVisible = Boolean(onSelectAllVisible && visibleCount && visibleCount > selectedCount);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-(--accent)/30 bg-(--accent-soft) px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-(--text-primary)">{label} selected</span>
        {canSelectAllVisible ? (
          <button
            className="rounded-md px-2 py-1 font-medium text-(--accent) transition hover:bg-(--surface-hover)"
            disabled={isDeleting}
            type="button"
            onClick={onSelectAllVisible}
          >
            Select all {visibleCount} visible rows
          </button>
        ) : allVisibleSelected && visibleCount ? (
          <span className="text-(--text-muted)">All {visibleCount} visible rows selected</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md px-3 py-1.5 text-sm text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
          disabled={isDeleting}
          type="button"
          onClick={onClearSelection}
        >
          Clear selection
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-100"
          disabled={isDeleting}
          type="button"
          onClick={onDelete}
        >
          <IconTrash className="size-4" />
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

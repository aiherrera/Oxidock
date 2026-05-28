import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type BulkDeleteDialogProps = {
  open: boolean;
  title: string;
  description: string;
  itemLabels: string[];
  confirmLabel?: string;
  isDeleting?: boolean;
  showForceOption?: boolean;
  forceChecked?: boolean;
  forceLabel?: string;
  onForceCheckedChange?: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const PREVIEW_LIMIT = 5;

export function BulkDeleteDialog({
  open,
  title,
  description,
  itemLabels,
  confirmLabel = "Delete selected",
  isDeleting = false,
  showForceOption = false,
  forceChecked = false,
  forceLabel = "Force delete protected or in-use resources",
  onForceCheckedChange,
  onCancel,
  onConfirm,
}: BulkDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const preview = itemLabels.slice(0, PREVIEW_LIMIT);
  const remainder = itemLabels.length - preview.length;

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
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-labelledby="bulk-delete-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
    >
      <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-(--surface-elevated) p-5 shadow-2xl shadow-black/40">
        <h2
          className="text-base font-semibold text-(--text-primary)"
          id="bulk-delete-title"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-(--text-secondary)">{description}</p>

        {preview.length > 0 ? (
          <ul className="mt-4 max-h-40 space-y-1 overflow-auto rounded-lg border border-(--border) bg-(--surface) p-3 text-sm text-(--text-primary)">
            {preview.map((label) => (
              <li key={label}>{label}</li>
            ))}
            {remainder > 0 ? <li className="text-(--text-muted)">and {remainder} more</li> : null}
          </ul>
        ) : null}

        {showForceOption ? (
          <label className="mt-4 flex items-start gap-2 text-sm text-(--text-secondary)">
            <input
              checked={forceChecked}
              className="mt-0.5 size-4 rounded border-(--border) accent-(--accent)"
              disabled={isDeleting}
              type="checkbox"
              onChange={(event) => onForceCheckedChange?.(event.target.checked)}
            />
            <span>{forceLabel}</span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-60"
            disabled={isDeleting}
            ref={cancelRef}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting || (showForceOption && !forceChecked)}
            type="button"
            onClick={onConfirm}
          >
            {isDeleting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

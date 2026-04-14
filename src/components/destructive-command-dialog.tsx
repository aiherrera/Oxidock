import { useEffect, useRef } from "react";
import { riskLabels, type DockerCommandMetadata } from "../lib/docker-command-registry";
import { alertDanger, riskBadgeClasses, statusBadgeDanger } from "../lib/theme-classes";

type DestructiveCommandDialogProps = {
  open: boolean;
  command: string;
  reasons: string[];
  registryMatch: DockerCommandMetadata | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenSettings: () => void;
};

export function DestructiveCommandDialog({
  open,
  command,
  reasons,
  registryMatch,
  onCancel,
  onConfirm,
  onOpenSettings,
}: DestructiveCommandDialogProps) {
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
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const label = registryMatch?.label ?? "Destructive command";
  const description =
    registryMatch?.description ?? "This command may delete containers, images, volumes, or other Docker data.";

  return (
    <div
      aria-labelledby="destructive-command-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
    >
      <div className={`w-full max-w-lg rounded-xl bg-(--surface-elevated) p-5 shadow-2xl ${statusBadgeDanger}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-base font-semibold text-(--text-primary)"
              id="destructive-command-title"
            >
              Confirm destructive command
            </h2>
            <p className="mt-1 text-xs text-(--text-muted)">{label}</p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${riskBadgeClasses.destructive}`}
          >
            {riskLabels.destructive}
          </span>
        </div>

        <p className="mt-3 font-mono text-xs text-(--text-primary)">{command}</p>

        <p className="mt-3 text-xs leading-5 text-(--text-muted)">{description}</p>

        {reasons.length > 0 ? (
          <ul className={`mt-3 list-inside list-disc text-xs leading-5 ${alertDanger}`}>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            className="text-xs text-(--text-muted) underline-offset-2 hover:text-(--text-secondary) hover:underline"
            type="button"
            onClick={onOpenSettings}
          >
            Open CLI safety settings
          </button>
          <button
            ref={cancelRef}
            className="inline-flex min-h-10 items-center rounded-lg border border-(--border) px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover)"
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
            Run anyway
          </button>
        </div>
      </div>
    </div>
  );
}

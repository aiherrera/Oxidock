import { useEffect, useRef, useState } from "react";
import { riskLabels, type DockerCommandMetadata } from "../lib/docker-command-registry";
import { alertDanger, riskBadgeClasses, statusBadgeDanger } from "../lib/theme-classes";

type DestructiveCommandDialogProps = {
  open: boolean;
  command: string;
  confirmationPhrase: string;
  reasons: string[];
  registryMatch: DockerCommandMetadata | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenSettings: () => void;
};

export function DestructiveCommandDialog({
  open,
  command,
  confirmationPhrase,
  reasons,
  registryMatch,
  onCancel,
  onConfirm,
  onOpenSettings,
}: DestructiveCommandDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTyped("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTyped("");
    }
  }, [open, command]);

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

  const label = registryMatch?.label ?? "Destructive command";
  const description =
    registryMatch?.description ?? "This command may delete containers, images, volumes, or other Docker data.";

  const normalizedPhrase = confirmationPhrase.trim();
  const isPhraseMatched = typed.trim() === normalizedPhrase && normalizedPhrase.length > 0;

  if (!open) {
    return null;
  }

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

        <div className="mt-4 rounded-lg border border-(--border) bg-(--surface) p-3">
          <p className="text-xs text-(--text-secondary)">
            Type{" "}
            <span className="rounded border border-(--border) bg-(--surface-elevated) px-1.5 py-0.5 font-mono text-[0.7rem] text-(--text-primary)">
              {normalizedPhrase}
            </span>{" "}
            to confirm.
          </p>
          <label className="mt-2 block">
            <span className="sr-only">Confirmation phrase</span>
            <input
              ref={inputRef}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="mt-1 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-xs text-(--text-primary) outline-none focus:border-(--accent)/50 focus:ring-2 focus:ring-(--accent)/25"
              placeholder={normalizedPhrase}
              spellCheck={false}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
          <p className="mt-2 text-[0.7rem] leading-5 text-(--text-muted)">
            This helps prevent accidental destructive actions.
          </p>
        </div>

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
            disabled={!isPhraseMatched}
          >
            Run anyway
          </button>
        </div>
      </div>
    </div>
  );
}

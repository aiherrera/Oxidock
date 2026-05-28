import { useCallback, useEffect, useState } from "react";
import { formatFormattedBytes } from "../lib/format-bytes";
import {
  defaultLocalAiAssistantStatus,
  getInvokeErrorMessage,
  getLocalAiAssistantStatus,
  installLocalAiAssistant,
  listenLocalAiAssistantInstallStatus,
  uninstallLocalAiAssistant,
  type LocalAiAssistantStatus,
  type LocalAiInstallProgress,
} from "../lib/local-ai-assistant";
import { alertDanger, statusBadgeSuccess } from "../lib/theme-classes";

const INSTALL_STEPS = [
  { id: "download", label: "Download model", match: /download/i },
  { id: "verify", label: "Verify checksum", match: /verif/i },
  { id: "finalize", label: "Finalize installation", match: /finaliz/i },
] as const;

function formatProgressDetail(progress: LocalAiInstallProgress | null | undefined): string | null {
  if (!progress) {
    return null;
  }

  const downloaded = formatFormattedBytes(progress.downloadedBytes);
  if (progress.totalBytes != null && progress.percent != null) {
    const total = formatFormattedBytes(progress.totalBytes);
    return `${downloaded} of ${total} (${Math.round(progress.percent)}%)`;
  }

  return `Downloaded ${downloaded}`;
}

function getActiveInstallStepIndex(message: string | null): number {
  if (!message) {
    return 0;
  }

  const index = INSTALL_STEPS.findIndex((step) => step.match.test(message));
  return index >= 0 ? index : 0;
}

function InstallProgressPanel({
  message,
  progress,
}: {
  message: string | null;
  progress: LocalAiInstallProgress | null | undefined;
}) {
  const activeStepIndex = getActiveInstallStepIndex(message);
  const progressDetail = formatProgressDetail(progress);
  const percent =
    progress?.percent != null ? Math.min(100, Math.max(0, Math.round(progress.percent))) : null;

  return (
    <div className="mt-3 space-y-2">
      {percent != null ? (
        <div className="space-y-1">
          <div
            aria-label="Download progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-1.5 overflow-hidden rounded-full bg-(--surface-hover)"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-(--accent) transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progressDetail ? <p className="text-xs text-(--text-muted)">{progressDetail}</p> : null}
        </div>
      ) : progressDetail ? (
        <p className="text-xs text-(--text-muted)">{progressDetail}</p>
      ) : null}

      <ol className="space-y-1 text-xs text-(--text-muted)">
        {INSTALL_STEPS.map((step, index) => {
          const isActive = index === activeStepIndex;
          const isComplete = index < activeStepIndex;

          return (
            <li
              key={step.id}
              className={
                isActive
                  ? "font-medium text-(--text-secondary)"
                  : isComplete
                    ? "text-(--text-secondary)"
                    : undefined
              }
            >
              {isComplete ? "✓ " : isActive ? "• " : "○ "}
              {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CliAiAssistantCard() {
  const [status, setStatus] = useState<LocalAiAssistantStatus>(defaultLocalAiAssistantStatus);

  useEffect(() => {
    void getLocalAiAssistantStatus()
      .then((next) => setStatus(next))
      .catch(() => setStatus(defaultLocalAiAssistantStatus));
  }, []);

  const isInstalling = status.state === "installing";

  useEffect(() => {
    if (!isInstalling) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listenLocalAiAssistantInstallStatus((next) => {
        if (!disposed) {
          setStatus(next);
        }
      });

      if (disposed) {
        unlisten();
      }
    };

    void setup();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isInstalling]);

  const handleInstall = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      state: "installing",
      message: "Starting download…",
      progress: null,
    }));

    try {
      const next = await installLocalAiAssistant();
      setStatus(next);
    } catch (error) {
      setStatus((current) => ({
        ...current,
        state: "error",
        message: getInvokeErrorMessage(error, "Install failed. Try again later."),
        progress: null,
      }));
    }
  }, []);

  const handleUninstall = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      state: "installing",
      message: "Removing assistant…",
      progress: null,
    }));

    try {
      const next = await uninstallLocalAiAssistant();
      setStatus(next);
    } catch (error) {
      setStatus((current) => ({
        ...current,
        state: "error",
        message: getInvokeErrorMessage(error, "Remove failed. Try again later."),
        progress: null,
      }));
    }
  }, []);

  const isInstalled = status.state === "installed";

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-(--text-primary)">Local AI assistant</h3>
          <p className="mt-1 text-xs leading-5 text-(--text-muted)">
            Command suggestions work immediately from the built-in Docker guide. Install the optional {status.modelName}{" "}
            model ({status.modelSizeLabel}) for natural-language help and richer completions—similar to Docker
            Desktop&apos;s assistant.
          </p>
          {status.message ? (
            <p
              className={`mt-2 text-xs ${
                status.state === "error" ? `rounded-md px-2 py-1 ${alertDanger}` : "text-(--text-secondary)"
              }`}
            >
              {status.message}
            </p>
          ) : null}
          {isInstalling ? <InstallProgressPanel message={status.message} progress={status.progress} /> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {isInstalled ? (
            <button
              className="inline-flex min-h-9 items-center rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
              type="button"
              onClick={() => void handleUninstall()}
            >
              Remove
            </button>
          ) : (
            <button
              className="inline-flex min-h-9 items-center rounded-lg bg-(--accent) px-3 py-1.5 text-xs font-medium text-white transition hover:bg-(--accent-hover) disabled:opacity-60"
              disabled={isInstalling}
              type="button"
              onClick={() => void handleInstall()}
            >
              {isInstalling ? "Installing…" : "Install assistant"}
            </button>
          )}
        </div>
      </div>
      {isInstalled ? (
        <p className={`mt-3 text-xs ${statusBadgeSuccess}`}>
          Assistant enabled — the built-in Docker guide stays the source of truth, and AI suggestions are layered on as
          optional completions.
        </p>
      ) : null}
    </section>
  );
}

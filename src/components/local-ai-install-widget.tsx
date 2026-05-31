import { useCallback, useEffect, useRef, useState } from "react";
import { formatFormattedBytes } from "../lib/format-bytes";
import {
  getLocalAiAssistantStatus,
  listenLocalAiAssistantInstallStatus,
  type LocalAiAssistantStatus,
  type LocalAiInstallProgress,
} from "../lib/local-ai-assistant";
import { IconAssistant, IconX } from "./icons";

type LocalAiInstallWidgetProps = {
  onOpenAssistant: () => void;
};

type WidgetMode = "hidden" | "installing" | "ready";

const formatProgressDetail = (progress: LocalAiInstallProgress | null | undefined): string | null => {
  if (!progress) {
    return null;
  }

  const downloaded = formatFormattedBytes(progress.downloadedBytes);
  if (progress.totalBytes != null && progress.percent != null) {
    return `${downloaded} of ${formatFormattedBytes(progress.totalBytes)} (${Math.round(progress.percent)}%)`;
  }

  return `Downloaded ${downloaded}`;
};

const getWidgetMode = (status: LocalAiAssistantStatus | null, showReady: boolean): WidgetMode => {
  if (status?.state === "installing") {
    return "installing";
  }

  if (status?.state === "installed" && showReady) {
    return "ready";
  }

  return "hidden";
};

export function LocalAiInstallWidget({ onOpenAssistant }: LocalAiInstallWidgetProps) {
  const [status, setStatus] = useState<LocalAiAssistantStatus | null>(null);
  const [showReady, setShowReady] = useState(false);
  const observedInstallRef = useRef(false);

  const applyStatus = useCallback((next: LocalAiAssistantStatus, options?: { fromInitialLoad?: boolean }) => {
    setStatus(next);

    if (next.state === "installing") {
      observedInstallRef.current = true;
      setShowReady(false);
      return;
    }

    if (next.state === "installed" && observedInstallRef.current && !options?.fromInitialLoad) {
      observedInstallRef.current = false;
      setShowReady(true);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getLocalAiAssistantStatus()
      .then((next) => {
        if (!disposed) {
          applyStatus(next, { fromInitialLoad: true });
        }
      })
      .catch(() => {
        // The widget is non-critical; failures should not interrupt the app shell.
      });

    const setupListener = async () => {
      unlisten = await listenLocalAiAssistantInstallStatus((next) => {
        if (!disposed) {
          applyStatus(next);
        }
      });

      if (disposed) {
        unlisten();
      }
    };

    void setupListener();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [applyStatus]);

  const mode = getWidgetMode(status, showReady);
  if (mode === "hidden") {
    return null;
  }

  const percent =
    status?.progress?.percent != null ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : null;
  const progressDetail = formatProgressDetail(status?.progress);

  return (
    <aside
      aria-label={mode === "ready" ? "Assistant ready" : "Assistant install progress"}
      className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-(--border) bg-(--surface) p-4 text-sm shadow-2xl shadow-black/20"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent)">
          <IconAssistant className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">
                {mode === "ready" ? "Local AI assistant is ready" : "Installing local AI assistant"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-(--text-muted)">
                {mode === "ready"
                  ? "The model finished downloading and is ready to use."
                  : (status?.message ?? "Downloading the assistant model in the background.")}
              </p>
            </div>
            {mode === "ready" ? (
              <button
                aria-label="Dismiss assistant install notification"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
                type="button"
                onClick={() => setShowReady(false)}
              >
                <IconX className="size-4" />
              </button>
            ) : null}
          </div>

          {mode === "installing" ? (
            <div className="mt-3 space-y-1">
              {percent != null ? (
                <div
                  aria-label="Assistant model download progress"
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
              ) : null}
              {progressDetail ? <p className="text-xs text-(--text-muted)">{progressDetail}</p> : null}
            </div>
          ) : (
            <button
              className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-(--accent) px-3 py-1.5 text-xs font-medium text-white transition hover:bg-(--accent-hover)"
              type="button"
              onClick={() => {
                setShowReady(false);
                onOpenAssistant();
              }}
            >
              Open AI Assistant
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

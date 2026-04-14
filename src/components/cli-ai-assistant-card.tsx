import { useCallback, useEffect, useState } from "react";
import {
  getLocalAiAssistantStatus,
  installLocalAiAssistant,
  uninstallLocalAiAssistant,
  defaultLocalAiAssistantStatus,
  type LocalAiAssistantStatus,
} from "../lib/local-ai-assistant";
import { alertDanger, statusBadgeSuccess } from "../lib/theme-classes";

export function CliAiAssistantCard() {
  const [status, setStatus] = useState<LocalAiAssistantStatus>(defaultLocalAiAssistantStatus);

  useEffect(() => {
    void getLocalAiAssistantStatus()
      .then((next) => setStatus(next))
      .catch(() => setStatus(defaultLocalAiAssistantStatus));
  }, []);

  const handleInstall = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      state: "installing",
      message: "Downloading assistant model…",
    }));

    try {
      const next = await installLocalAiAssistant();
      setStatus(next);
    } catch {
      setStatus((current) => ({
        ...current,
        state: "error",
        message: "Install failed. Try again later.",
      }));
    }
  }, []);

  const handleUninstall = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      state: "installing",
      message: "Removing assistant…",
    }));

    try {
      const next = await uninstallLocalAiAssistant();
      setStatus(next);
    } catch {
      setStatus((current) => ({
        ...current,
        state: "error",
        message: "Remove failed. Try again later.",
      }));
    }
  }, []);

  const isInstalling = status.state === "installing";
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
        </div>
        <div className="flex shrink-0 gap-2">
          {isInstalled ? (
            <button
              className="inline-flex min-h-9 items-center rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
              type="button"
              onClick={handleUninstall}
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

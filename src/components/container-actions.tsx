import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DockerCommandId } from "../lib/docker-command-registry";
import { isExited, isRunning, normalizeState } from "../lib/container-utils";
import { toErrorMessage } from "../lib/search-utils";
import type { ContainerInfo } from "../types/docker";
import { removeContainer, restartContainer, startContainer, stopContainer } from "../lib/tauri-docker";
import { CommandTooltip } from "./command-tooltip";
import { IconBox, IconPlay, IconRefresh, IconStop, IconTerminal, IconTrash } from "./icons";

type ContainerActionsProps = {
  container: ContainerInfo;
  onActionComplete: () => Promise<void>;
  onActionError?: (message: string | null) => void;
  onInspectTab: () => void;
  onLogsTab: () => void;
  layout?: "grid" | "inline";
};

type ActionConfig = {
  id: DockerCommandId;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  run?: () => Promise<boolean | void>;
};

export function ContainerActions({
  container,
  onActionComplete,
  onActionError,
  onInspectTab,
  onLogsTab,
  layout = "grid",
}: ContainerActionsProps) {
  const [pendingAction, setPendingAction] = useState<DockerCommandId | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const runAction = async (action: ActionConfig) => {
    if (!action.run) {
      return;
    }

    setPendingAction(action.id);
    onActionError?.(null);

    try {
      const shouldRefresh = await action.run();
      if (shouldRefresh !== false) {
        await onActionComplete();
      }
    } catch (error) {
      onActionError?.(toErrorMessage(error, `Could not ${action.label.toLowerCase()} ${container.name}.`));
    } finally {
      setPendingAction(null);
    }
  };

  useEffect(() => {
    setRemoveDialogOpen(false);
  }, [container.id]);

  const state = normalizeState(container.state);
  const canRemove = state !== "removing";
  const forceRemove = !isExited(container);

  const actions: ActionConfig[] = [
    {
      id: "containers.inspect",
      label: "Inspect",
      icon: <IconBox className="size-4" />,
      enabled: true,
      run: async () => {
        onInspectTab();
      },
    },
    {
      id: "containers.logs",
      label: "Logs",
      icon: <IconTerminal className="size-4" />,
      enabled: isRunning(container),
      run: async () => {
        onLogsTab();
      },
    },
    {
      id: "containers.start",
      label: "Start",
      icon: <IconPlay className="size-4" />,
      enabled: isExited(container),
      run: () => startContainer(container.id),
    },
    {
      id: "containers.stop",
      label: "Stop",
      icon: <IconStop className="size-4" />,
      enabled: isRunning(container),
      run: () => stopContainer(container.id),
    },
    {
      id: "containers.restart",
      label: "Restart",
      icon: <IconRefresh className="size-4" />,
      enabled: isRunning(container),
      run: () => restartContainer(container.id),
    },
    {
      id: "containers.remove",
      label: "Remove",
      icon: <IconTrash className="size-4" />,
      enabled: canRemove,
      run: async () => {
        setRemoveDialogOpen(true);
        return false;
      },
    },
  ];

  const gridClass = layout === "grid" ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2";

  return (
    <>
      <div className={gridClass}>
        {actions.map((action) => {
          const isPending = pendingAction === action.id;

          return (
            <CommandTooltip
              commandId={action.id}
              container={container.name}
              key={action.id}
            >
              <button
                aria-label={isPending ? `${action.label} working` : action.label}
                className="grid size-11 place-items-center rounded-lg border border-(--border) bg-(--surface-elevated) text-(--text-secondary) transition enabled:hover:border-(--accent)/40 enabled:hover:bg-(--surface-hover) enabled:hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!action.enabled || isPending}
                onClick={() => void runAction(action)}
                title={action.label}
              >
                <span
                  aria-hidden="true"
                  className={isPending ? "animate-pulse" : undefined}
                >
                  {action.icon}
                </span>
                <span className="sr-only">{isPending ? "Working..." : action.label}</span>
              </button>
            </CommandTooltip>
          );
        })}
      </div>

      <RemoveContainerDialog
        container={container}
        force={forceRemove}
        isRemoving={pendingAction === "containers.remove"}
        open={removeDialogOpen}
        onCancel={() => setRemoveDialogOpen(false)}
        onConfirm={() => {
          setRemoveDialogOpen(false);
          void runAction({
            id: "containers.remove",
            label: "Remove",
            icon: null,
            enabled: canRemove,
            run: () => removeContainer(container.id, forceRemove),
          });
        }}
      />
    </>
  );
}

type RemoveContainerDialogProps = {
  container: ContainerInfo;
  force: boolean;
  isRemoving: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const RemoveContainerDialog = ({
  container,
  force,
  isRemoving,
  open,
  onCancel,
  onConfirm,
}: RemoveContainerDialogProps) => {
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

  return createPortal(
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
            disabled={isRemoving}
            ref={cancelRef}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRemoving}
            type="button"
            onClick={onConfirm}
          >
            {isRemoving ? "Removing..." : "Remove container"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

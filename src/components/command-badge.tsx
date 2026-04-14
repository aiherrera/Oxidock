import { useEffect, useRef, useState } from "react";
import { getDockerCommand, type DockerCommandId } from "../lib/docker-command-registry";

type CommandBadgeProps = {
  commandId: DockerCommandId;
  container?: string;
};

export function CommandBadge({ commandId, container }: CommandBadgeProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const command = getDockerCommand(commandId, { container });

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command.cli);
    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1200);
  };

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-(--border) bg-(--code-bg) px-3 py-1.5 text-xs text-(--code-text)">
      <code className="truncate font-mono">{command.cli}</code>
      <button
        className="shrink-0 rounded-full px-1.5 py-0.5 font-medium text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
        type="button"
        onClick={copyCommand}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

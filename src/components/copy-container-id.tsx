import { useCallback, useEffect, useRef, useState } from "react";
import { IconCopy } from "./icons";

type CopyContainerIdProps = {
  shortId: string;
  className?: string;
};

export const CopyContainerId = ({ shortId, className = "" }: CopyContainerIdProps) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    []
  );

  const copyId = useCallback(async () => {
    await navigator.clipboard.writeText(shortId);
    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1200);
  }, [shortId]);

  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate font-mono text-xs text-(--text-muted)">{shortId}</span>
      <button
        aria-label={copied ? "Copied container ID" : "Copy container ID"}
        className="group relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-(--accent) transition hover:bg-(--surface-elevated)"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void copyId();
        }}
      >
        <IconCopy className="size-3.5" />
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-(--border) bg-(--surface-elevated) px-2 py-1 text-xs text-(--text-primary) opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {copied ? "Copied!" : "Copy"}
        </span>
      </button>
    </span>
  );
};

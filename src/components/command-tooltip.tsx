import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getDockerCommand, type DockerCommandId } from "../lib/docker-command-registry";
import { riskBadgeClasses } from "../lib/theme-classes";

type CommandTooltipProps = {
  commandId: DockerCommandId;
  container?: string;
  children: ReactNode;
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 320;
const VIEWPORT_PADDING = 12;

export function CommandTooltip({ commandId, container, children }: CommandTooltipProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const closeTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const command = getDockerCommand(commandId, { container });

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updateTooltipPosition = () => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const minLeft = TOOLTIP_WIDTH / 2 + VIEWPORT_PADDING;
    const maxLeft = window.innerWidth - TOOLTIP_WIDTH / 2 - VIEWPORT_PADDING;

    setTooltipPosition({
      left: Math.min(Math.max(rect.left + rect.width / 2, minLeft), maxLeft),
      top: rect.bottom + TOOLTIP_GAP,
    });
  };

  const openTooltip = () => {
    clearCloseTimer();
    updateTooltipPosition();
    setIsOpen(true);
  };

  const scheduleCloseTooltip = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [isOpen]);

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
    <span
      className="relative inline-flex"
      ref={triggerRef}
      tabIndex={0}
      onBlur={scheduleCloseTooltip}
      onFocus={openTooltip}
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleCloseTooltip}
    >
      {children}
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <span
              className="fixed z-50 w-80 -translate-x-1/2 rounded-2xl border border-(--border) bg-(--surface-elevated) p-3 text-left shadow-2xl shadow-black/20 backdrop-blur"
              style={tooltipPosition}
              onBlur={scheduleCloseTooltip}
              onFocus={clearCloseTimer}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleCloseTooltip}
            >
              <span className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
                  CLI equivalent
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${riskBadgeClasses[command.risk]}`}
                >
                  {command.risk}
                </span>
              </span>
              <code className="block rounded-xl border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs text-(--code-text)">
                {command.cli}
              </code>
              <span className="mt-2 block text-xs leading-5 text-(--text-muted)">{command.explanation}</span>
              <button
                className="mt-3 rounded-lg border border-(--border) px-2.5 py-1.5 text-xs font-medium text-(--text-secondary) transition hover:border-(--accent) hover:text-(--accent)"
                type="button"
                onClick={copyCommand}
              >
                {copied ? "Copied" : "Copy command"}
              </button>
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

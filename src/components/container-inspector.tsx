import { useEffect, useRef, useState, type ReactNode } from "react";
import { getDockerCommand } from "../lib/docker-command-registry";
import { isRunning, normalizeState } from "../lib/container-utils";
import { fetchContainerLogs, inspectContainer } from "../lib/tauri-docker";
import { alertDanger, statusBadgeDanger, statusBadgeSuccess } from "../lib/theme-classes";
import type { ContainerInfo, ContainerInspectDetail, ContainerStatsInfo } from "../types/docker";
import { ContainerActions } from "./container-actions";
import { ContainerStatsPanel } from "./container-stats-panel";
import { CopyContainerId } from "./copy-container-id";
import { IconBox, IconCopy, IconExternal, IconX } from "./icons";

type InspectorTab = "overview" | "logs" | "inspect" | "stats";

type ContainerInspectorProps = {
  container: ContainerInfo;
  stats: ContainerStatsInfo | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

const tabs: { id: InspectorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "logs", label: "Logs" },
  { id: "inspect", label: "Inspect" },
  { id: "stats", label: "Stats" },
];

export function ContainerInspector({ container, stats, onClose, onRefresh }: ContainerInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [detail, setDetail] = useState<ContainerInspectDetail | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveTab("overview");
    setDetail(null);
    setLogs("");
    setErrorMessage(null);
  }, [container.id]);

  useEffect(() => {
    if (activeTab === "stats") {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoadingDetail(true);
      setErrorMessage(null);

      try {
        if (activeTab === "logs") {
          const result = await fetchContainerLogs(container.id);
          if (!cancelled) {
            setLogs(result.logs || "No logs returned for this container.");
          }
          return;
        }

        if (activeTab === "inspect" || activeTab === "overview") {
          const inspectDetail = await inspectContainer(container.id);
          if (!cancelled) {
            setDetail(inspectDetail);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, container]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    []
  );

  const inspectCommand = getDockerCommand("containers.inspect", {
    container: container.name,
  });
  const running = isRunning(container);
  const overview = detail ?? null;
  const ports = overview?.ports.length ? overview.ports : container.ports;
  const networks = overview?.networks.length ? overview.networks.join(", ") : "bridge";
  const commandText = overview?.command ?? "—";

  const copyInspectCommand = async () => {
    await navigator.clipboard.writeText(inspectCommand.cli);
    setCopied(true);

    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1200);
  };

  return (
    <aside className="pointer-events-auto flex h-full w-[22rem] shrink-0 flex-col border-l border-(--border) bg-(--surface) shadow-2xl shadow-black/40 xl:w-[24rem]">
      <div className="border-b border-(--border) p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-(--border) bg-(--surface-elevated) p-2 text-(--text-muted)">
            <IconBox className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-(--text-primary)">{container.name}</h2>
            <CopyContainerId
              className="mt-0.5"
              shortId={container.shortId}
            />
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                running ? statusBadgeSuccess : statusBadgeDanger
              }`}
            >
              {normalizeState(container.state)}
            </span>
          </div>
          <button
            aria-label="Close container details"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-elevated) hover:text-(--text-primary)"
            type="button"
            onClick={onClose}
          >
            <IconX className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-4 border-b border-(--border)">
          {tabs.map((tab) => (
            <button
              className={`border-b-2 pb-2 text-sm transition ${
                activeTab === tab.id
                  ? "border-(--accent) text-(--accent)"
                  : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
              }`}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {errorMessage ? <div className={`mb-4 rounded-lg p-3 text-sm ${alertDanger}`}>{errorMessage}</div> : null}

        {isLoadingDetail ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="h-10 animate-pulse rounded-md bg-(--surface-elevated)"
                key={index}
              />
            ))}
          </div>
        ) : null}

        {!isLoadingDetail && activeTab === "overview" ? (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <DetailRow
                label="Image"
                value={container.image}
                copyable
              />
              <DetailRow
                label="Status"
                value={
                  <span className="capitalize text-(--status-success-text)">
                    {container.state}
                    <span className="mt-0.5 block text-xs font-normal normal-case text-(--text-muted)">
                      {container.status}
                    </span>
                  </span>
                }
              />
              <DetailRow
                label="Created"
                value={overview?.createdAt ?? container.createdAt}
              />
              <DetailRow
                label="Ports"
                value={
                  ports.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-mono text-(--accent)">
                      {ports[0]}
                      <IconExternal className="size-3.5" />
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Networks"
                value={networks}
              />
              <DetailRow
                label="Command"
                value={commandText}
              />
            </dl>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Actions</p>
              <div className="mt-3">
                <ContainerActions
                  container={container}
                  layout="grid"
                  onActionComplete={onRefresh}
                  onActionError={setErrorMessage}
                  onInspectTab={() => setActiveTab("inspect")}
                  onLogsTab={() => setActiveTab("logs")}
                />
              </div>
            </div>
          </div>
        ) : null}

        {!isLoadingDetail && activeTab === "logs" ? (
          <pre className="overflow-x-auto rounded-lg border border-(--border) bg-(--code-bg) p-3 font-mono text-xs leading-5 text-(--code-text)">
            {logs || "No logs available."}
          </pre>
        ) : null}

        {!isLoadingDetail && activeTab === "inspect" ? (
          <pre className="max-h-[28rem] overflow-auto rounded-lg border border-(--border) bg-(--code-bg) p-3 font-mono text-[0.7rem] leading-5 text-(--code-text)">
            {overview?.rawJson ?? "Inspect data unavailable."}
          </pre>
        ) : null}

        {!isLoadingDetail && activeTab === "stats" ? (
          <ContainerStatsPanel
            container={container}
            stats={stats}
          />
        ) : null}
      </div>

      <div className="border-t border-(--border) p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-muted)">CLI Command</p>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) transition hover:text-(--text-primary)"
            type="button"
            onClick={() => void copyInspectCommand()}
          >
            <IconCopy className="size-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <code className="block rounded-lg border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs text-(--code-text)">
          {inspectCommand.cli}
        </code>
        <p className="mt-2 text-xs leading-5 text-(--text-muted)">What it does: {inspectCommand.explanation}</p>
      </div>
    </aside>
  );
}

type DetailRowProps = {
  label: string;
  value: ReactNode;
  copyable?: boolean;
};

const DetailRow = ({ label, value, copyable }: DetailRowProps) => (
  <div className="flex items-start justify-between gap-3">
    <dt className="text-(--text-muted)">{label}</dt>
    <dd className="min-w-0 text-right text-(--text-primary)">
      <span className="inline-flex items-center gap-1">
        {value}
        {copyable ? <IconCopy className="size-3.5 text-(--text-muted)" /> : null}
      </span>
    </dd>
  </div>
);

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Could not load container details.";
};

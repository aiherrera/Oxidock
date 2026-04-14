import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContainerInspector } from "./container-inspector";
import { ContainersTable } from "./containers-table";
import { ContainersToolbar } from "./containers-toolbar";
import { OverviewFooter } from "./overview-footer";
import { PageLoadingSkeleton } from "./page-shell";
import { aggregateStats, buildTableRows, countRunning, filterContainers, isRunning } from "../lib/container-utils";
import { toErrorMessage } from "../lib/search-utils";
import { alertDanger } from "../lib/theme-classes";
import { useDockerContainersChanged } from "../lib/docker-change-events";
import { fetchContainerStats, fetchContainers } from "../lib/tauri-docker";
import type { ContainerInfo, ContainerStatsInfo, DockerStatus } from "../types/docker";

const STATS_POLL_MS = 2000;

type ContainersPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
};

export function ContainersPage({ dockerStatus, engineRevision, searchQuery }: ContainersPageProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [statsById, setStatsById] = useState<Map<string, ContainerStatsInfo>>(() => new Map());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [showAllContainers, setShowAllContainers] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statsRequestIdRef = useRef(0);

  const loadDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        if (!dockerStatus?.isRunning) {
          setContainers([]);
          setStatsById(new Map());
          setSelectedId(null);
          return;
        }

        const nextContainers = await fetchContainers(true);
        setContainers(nextContainers);
        setExpandedProjects((current) => {
          const projects = new Set(current);
          for (const container of nextContainers) {
            if (container.project) {
              projects.add(container.project);
            }
          }
          return projects;
        });
        setSelectedId((current) => {
          if (current && nextContainers.some((container) => container.id === current)) {
            return current;
          }

          return null;
        });
      } catch (error) {
        setContainers([]);
        setStatsById(new Map());
        setSelectedId(null);
        setErrorMessage(toErrorMessage(error, "Oxidock could not reach Docker. Check that Docker Engine is running."));
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [dockerStatus?.isRunning]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, engineRevision]);

  useDockerContainersChanged(
    useCallback(() => {
      void loadDashboard({ silent: true });
    }, [loadDashboard]),
    Boolean(dockerStatus?.isRunning)
  );

  const filteredContainers = useMemo(
    () =>
      filterContainers(containers, {
        showAll: showAllContainers,
        query: searchQuery,
      }),
    [containers, showAllContainers, searchQuery]
  );

  const runningContainerIds = useMemo(
    () => containers.filter(isRunning).map((container) => container.id),
    [containers]
  );

  const tableRows = useMemo(
    () => buildTableRows(filteredContainers, { statsById, expandedProjects }),
    [filteredContainers, statsById, expandedProjects]
  );

  useEffect(() => {
    if (!dockerStatus?.isRunning || runningContainerIds.length === 0) {
      return;
    }

    let cancelled = false;

    const pollStats = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const requestId = statsRequestIdRef.current + 1;
      statsRequestIdRef.current = requestId;

      try {
        const stats = await fetchContainerStats(runningContainerIds);
        if (cancelled || requestId !== statsRequestIdRef.current) {
          return;
        }

        setStatsById((current) => {
          const next = new Map(current);
          for (const entry of stats) {
            next.set(entry.id, entry);
          }
          return next;
        });
      } catch {
        // Keep the last known stats when polling fails.
      }
    };

    void pollStats();
    const intervalId = window.setInterval(() => {
      void pollStats();
    }, STATS_POLL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollStats();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dockerStatus?.isRunning, runningContainerIds]);

  const selectedContainer = useMemo(
    () => filteredContainers.find((container) => container.id === selectedId) ?? null,
    [filteredContainers, selectedId]
  );

  const toggleSelectedContainer = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const toggleProject = useCallback((project: string) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(project)) {
        next.delete(project);
      } else {
        next.add(project);
      }
      return next;
    });
  }, []);

  const runningCount = useMemo(() => countRunning(containers), [containers]);

  const containerTotals = useMemo(() => {
    const runningFiltered = filteredContainers.filter(isRunning);
    return aggregateStats(runningFiltered, statsById);
  }, [filteredContainers, statsById]);

  const footerStatusLabel = useMemo(
    () => `Showing ${tableRows.length} rows (${filteredContainers.length} containers)`,
    [tableRows.length, filteredContainers.length]
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <ContainersToolbar
          containerTotals={containerTotals}
          runningCount={runningCount}
          showAll={showAllContainers}
          totalCount={containers.length}
          onShowAllChange={setShowAllContainers}
        />

        {errorMessage ? (
          <div className={`mx-6 mt-4 rounded-lg px-4 py-3 text-sm ${alertDanger}`}>{errorMessage}</div>
        ) : null}

        {isLoading ? (
          <PageLoadingSkeleton />
        ) : (
          <ContainersTable
            rows={tableRows}
            selectedId={selectedId}
            onOpenInspector={toggleSelectedContainer}
            onSelect={toggleSelectedContainer}
            onToggleProject={toggleProject}
          />
        )}

        <OverviewFooter statusLabel={footerStatusLabel} />
      </div>

      {selectedContainer ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex">
          <ContainerInspector
            container={selectedContainer}
            stats={statsById.get(selectedContainer.id) ?? null}
            onClose={() => setSelectedId(null)}
            onRefresh={() => loadDashboard()}
          />
        </div>
      ) : null}
    </>
  );
}

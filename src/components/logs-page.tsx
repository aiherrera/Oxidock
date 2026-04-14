import { useCallback, useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { CopyContainerId } from "./copy-container-id";
import { filterByQuery, toErrorMessage } from "../lib/search-utils";
import { fetchContainerLogs, fetchContainers } from "../lib/tauri-docker";
import type { ContainerInfo, DockerStatus } from "../types/docker";

type LogsPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
};

export function LogsPage({ dockerStatus, engineRevision, searchQuery }: LogsPageProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [logs, setLogs] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadContainers = useCallback(async () => {
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      if (!dockerStatus?.isRunning) {
        setContainers([]);
        setSelectedId("");
        setLogs("");
        setErrorMessage("Docker does not appear to be running. Start Docker Engine and refresh.");
        return;
      }

      const nextContainers = await fetchContainers(true);
      setContainers(nextContainers);
      setSelectedId((current) => {
        if (current && nextContainers.some((container) => container.id === current)) {
          return current;
        }

        return nextContainers[0]?.id ?? "";
      });
    } catch (error) {
      setContainers([]);
      setSelectedId("");
      setLogs("");
      setErrorMessage(toErrorMessage(error, "Could not load containers."));
    } finally {
      setIsLoadingList(false);
    }
  }, [dockerStatus?.isRunning]);

  const loadLogs = useCallback(async (containerId: string) => {
    if (!containerId) {
      setLogs("");
      return;
    }

    setIsLoadingLogs(true);
    setErrorMessage(null);

    try {
      const result = await fetchContainerLogs(containerId);
      setLogs(result.logs || "No logs returned for this container.");
    } catch (error) {
      setLogs("");
      setErrorMessage(toErrorMessage(error, "Could not load container logs."));
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadContainers();
  }, [loadContainers, engineRevision]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    void loadLogs(selectedId);
  }, [engineRevision, loadLogs, selectedId]);

  const filteredContainers = useMemo(
    () =>
      filterByQuery(containers, searchQuery, (container) => [
        container.name,
        container.image,
        container.shortId,
        container.id,
      ]),
    [containers, searchQuery]
  );

  const selectedContainer = containers.find((container) => container.id === selectedId);

  return (
    <PageShell
      description="Tail recent stdout and stderr from any container."
      errorMessage={errorMessage}
      isLoading={isLoadingList}
      title="Logs"
    >
      {isLoadingList ? (
        <PageLoadingSkeleton rows={4} />
      ) : filteredContainers.length === 0 ? (
        <PageEmptyState message="No containers available for log inspection." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <label className="flex max-w-xl flex-col gap-2 text-sm">
            <span className="font-medium text-(--text-secondary)">Container</span>
            <Select
              value={selectedId || undefined}
              onValueChange={setSelectedId}
            >
              <SelectTrigger className="min-h-11 w-full rounded-lg bg-(--surface)">
                <SelectValue placeholder="Select a container" />
              </SelectTrigger>
              <SelectContent>
                {filteredContainers.map((container) => (
                  <SelectItem
                    key={container.id}
                    value={container.id}
                  >
                    {container.name} ({container.shortId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {selectedContainer ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--text-muted)">
              <span>
                Showing logs for <span className="font-medium text-(--text-primary)">{selectedContainer.name}</span> ·{" "}
                {selectedContainer.image}
              </span>
              <span aria-hidden>·</span>
              <CopyContainerId shortId={selectedContainer.shortId} />
            </div>
          ) : null}

          {isLoadingLogs ? (
            <PageLoadingSkeleton rows={3} />
          ) : (
            <pre className="min-h-64 flex-1 overflow-auto rounded-lg border border-(--border) bg-(--code-bg) p-4 font-mono text-xs leading-5 text-(--code-text)">
              {logs || "Select a container to view logs."}
            </pre>
          )}
        </div>
      )}
    </PageShell>
  );
}

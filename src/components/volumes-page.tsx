import { useCallback, useMemo } from "react";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { useDockerResourcePage } from "../hooks/use-docker-resource-page";
import { filterByQuery } from "../lib/search-utils";
import { fetchVolumes } from "../lib/tauri-docker";
import type { DockerStatus } from "../types/docker";

type VolumesPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
};

export function VolumesPage({ dockerStatus, engineRevision, searchQuery }: VolumesPageProps) {
  const fetchVolumesList = useCallback(() => fetchVolumes(), []);
  const {
    items: volumes,
    isLoading,
    errorMessage,
  } = useDockerResourcePage({
    dockerStatus,
    engineRevision,
    fetch: fetchVolumesList,
    failureMessage: "Could not load volumes.",
  });

  const filteredVolumes = useMemo(
    () =>
      filterByQuery(volumes, searchQuery, (volume) => [
        volume.name,
        volume.driver,
        volume.mountpoint,
        volume.scope,
        ...Object.values(volume.labels),
      ]),
    [volumes, searchQuery]
  );

  return (
    <PageShell
      description="Inspect named volumes, drivers, and mount points."
      errorMessage={errorMessage}
      isLoading={isLoading}
      footerStatusLabel={`Showing ${filteredVolumes.length} volumes`}
      title="Volumes"
    >
      {isLoading ? (
        <PageLoadingSkeleton />
      ) : filteredVolumes.length === 0 ? (
        <PageEmptyState message="No volumes match the current filters." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-(--surface)">
              <tr className="border-b border-(--border) text-left text-(--text-muted)">
                <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                <th className="px-3 py-3 font-medium">Driver</th>
                <th className="px-3 py-3 font-medium">Scope</th>
                <th className="px-3 py-3 font-medium">Mountpoint</th>
                <th className="px-3 py-3 font-medium">Labels</th>
              </tr>
            </thead>
            <tbody>
              {filteredVolumes.map((volume) => (
                <tr
                  className="border-b border-(--border) transition hover:bg-(--surface-hover)"
                  key={volume.name}
                >
                  <td className="px-4 py-3 font-medium text-(--text-primary) sm:px-6">{volume.name}</td>
                  <td className="px-3 py-3 text-(--text-secondary)">{volume.driver}</td>
                  <td className="px-3 py-3 text-(--text-secondary)">{volume.scope}</td>
                  <td className="max-w-[20rem] truncate px-3 py-3 font-mono text-xs text-(--text-muted)">
                    {volume.mountpoint}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {Object.keys(volume.labels).length === 0
                      ? "—"
                      : Object.entries(volume.labels)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

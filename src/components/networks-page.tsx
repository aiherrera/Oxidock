import { useCallback, useMemo } from "react";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { useDockerResourcePage } from "../hooks/use-docker-resource-page";
import { filterByQuery } from "../lib/search-utils";
import { fetchNetworks } from "../lib/tauri-docker";
import type { DockerStatus } from "../types/docker";

type NetworksPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
};

export function NetworksPage({ dockerStatus, engineRevision, searchQuery }: NetworksPageProps) {
  const fetchNetworksList = useCallback(() => fetchNetworks(), []);
  const {
    items: networks,
    isLoading,
    errorMessage,
  } = useDockerResourcePage({
    dockerStatus,
    engineRevision,
    fetch: fetchNetworksList,
    failureMessage: "Could not load networks.",
  });

  const filteredNetworks = useMemo(
    () => filterByQuery(networks, searchQuery, (network) => [network.name, network.driver, network.scope, network.id]),
    [networks, searchQuery]
  );

  return (
    <PageShell
      description="Inspect bridge, overlay, and custom networks."
      errorMessage={errorMessage}
      isLoading={isLoading}
      footerStatusLabel={`Showing ${filteredNetworks.length} networks`}
      title="Networks"
    >
      {isLoading ? (
        <PageLoadingSkeleton />
      ) : filteredNetworks.length === 0 ? (
        <PageEmptyState message="No networks match the current filters." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-(--surface)">
              <tr className="border-b border-(--border) text-left text-(--text-muted)">
                <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                <th className="px-3 py-3 font-medium">Driver</th>
                <th className="px-3 py-3 font-medium">Scope</th>
                <th className="px-3 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredNetworks.map((network) => (
                <tr
                  className="border-b border-(--border) transition hover:bg-(--surface-hover)"
                  key={network.id}
                >
                  <td className="px-4 py-3 font-medium text-(--text-primary) sm:px-6">{network.name}</td>
                  <td className="px-3 py-3 text-(--text-secondary)">{network.driver}</td>
                  <td className="px-3 py-3 text-(--text-secondary)">{network.scope}</td>
                  <td className="max-w-[14rem] truncate px-3 py-3 font-mono text-xs text-(--text-muted)">
                    {network.id}
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

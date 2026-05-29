import { useCallback, useMemo } from "react";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { ResourceBulkActionsBar } from "./resource-bulk-actions-bar";
import { ResourceSelectionHeaderCheckbox, ResourceSelectionRowCheckbox } from "./resource-selection-checkbox";
import { useBulkResourceDelete } from "../hooks/use-bulk-resource-delete";
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
    reload,
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

  const bulkDelete = useBulkResourceDelete({
    items: filteredNetworks,
    getKey: (network) => network.id,
    toDeleteEntry: (network) => ({ kind: "network", item: network }),
  });

  const combinedError = errorMessage ?? bulkDelete.deleteErrorMessage;

  return (
    <>
      <PageShell
        actions={
          <ResourceBulkActionsBar
            allVisibleSelected={bulkDelete.selection.isAllSelected(bulkDelete.visibleKeys)}
            isDeleting={bulkDelete.isDeleting}
            resourceLabel="network"
            selectedCount={bulkDelete.selectedEntries.length}
            visibleCount={bulkDelete.visibleKeys.length}
            onClearSelection={bulkDelete.selection.clear}
            onDelete={bulkDelete.openDeleteDialog}
            onSelectAllVisible={bulkDelete.toggleSelectAllVisible}
          />
        }
        description="Inspect bridge, overlay, and custom networks."
        errorMessage={combinedError}
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
                  <th className="w-10 px-4 py-3 font-medium sm:px-6">
                    <ResourceSelectionHeaderCheckbox
                      allSelected={bulkDelete.selection.isAllSelected(bulkDelete.visibleKeys)}
                      partiallySelected={bulkDelete.selection.isPartiallySelected(bulkDelete.visibleKeys)}
                      onToggleAll={bulkDelete.toggleSelectAllVisible}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                  <th className="px-3 py-3 font-medium">Driver</th>
                  <th className="px-3 py-3 font-medium">Scope</th>
                  <th className="px-3 py-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredNetworks.map((network) => {
                  const selected = bulkDelete.selection.isSelected(network.id);

                  return (
                    <tr
                      className={`border-b border-(--border) transition ${
                        selected ? "bg-(--accent-soft)" : "hover:bg-(--surface-hover)"
                      }`}
                      key={network.id}
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <ResourceSelectionRowCheckbox
                          checked={selected}
                          label={network.name}
                          onToggle={() => bulkDelete.selection.toggle(network.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-(--text-primary) sm:px-6">{network.name}</td>
                      <td className="px-3 py-3 text-(--text-secondary)">{network.driver}</td>
                      <td className="px-3 py-3 text-(--text-secondary)">{network.scope}</td>
                      <td className="max-w-56 truncate px-3 py-3 font-mono text-xs text-(--text-muted)">
                        {network.id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <BulkDeleteDialog
        description="This permanently removes the selected networks. Default Docker networks and networks with attached containers require explicit force confirmation."
        forceChecked={bulkDelete.forceDelete}
        forceLabel="Force delete protected or in-use networks"
        isDeleting={bulkDelete.isDeleting}
        itemLabels={bulkDelete.selectedLabels}
        open={bulkDelete.dialogOpen}
        showForceOption={bulkDelete.requiresForceConfirmation}
        title="Delete selected networks?"
        onCancel={bulkDelete.closeDeleteDialog}
        onForceCheckedChange={bulkDelete.setForceDelete}
        onConfirm={() => void bulkDelete.confirmDelete({ onComplete: reload })}
      />
    </>
  );
}

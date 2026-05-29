import { useCallback, useMemo } from "react";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { ResourceBulkActionsBar } from "./resource-bulk-actions-bar";
import { ResourceSelectionHeaderCheckbox, ResourceSelectionRowCheckbox } from "./resource-selection-checkbox";
import { useBulkResourceDelete } from "../hooks/use-bulk-resource-delete";
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
    reload,
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

  const bulkDelete = useBulkResourceDelete({
    items: filteredVolumes,
    getKey: (volume) => volume.name,
    toDeleteEntry: (volume) => ({ kind: "volume", item: volume }),
  });

  const combinedError = errorMessage ?? bulkDelete.deleteErrorMessage;

  return (
    <>
      <PageShell
        actions={
          <ResourceBulkActionsBar
            allVisibleSelected={bulkDelete.selection.isAllSelected(bulkDelete.visibleKeys)}
            isDeleting={bulkDelete.isDeleting}
            resourceLabel="volume"
            selectedCount={bulkDelete.selectedEntries.length}
            visibleCount={bulkDelete.visibleKeys.length}
            onClearSelection={bulkDelete.selection.clear}
            onDelete={bulkDelete.openDeleteDialog}
            onSelectAllVisible={bulkDelete.toggleSelectAllVisible}
          />
        }
        description="Inspect named volumes, drivers, and mount points."
        errorMessage={combinedError}
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
                  <th className="px-3 py-3 font-medium">Mountpoint</th>
                  <th className="px-3 py-3 font-medium">Labels</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolumes.map((volume) => {
                  const selected = bulkDelete.selection.isSelected(volume.name);

                  return (
                    <tr
                      className={`border-b border-(--border) transition ${
                        selected ? "bg-(--accent-soft)" : "hover:bg-(--surface-hover)"
                      }`}
                      key={volume.name}
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <ResourceSelectionRowCheckbox
                          checked={selected}
                          label={volume.name}
                          onToggle={() => bulkDelete.selection.toggle(volume.name)}
                        />
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <BulkDeleteDialog
        description="This permanently deletes the selected volumes and their stored data."
        forceChecked={bulkDelete.forceDelete}
        forceLabel="Force delete volumes that are still in use"
        isDeleting={bulkDelete.isDeleting}
        itemLabels={bulkDelete.selectedLabels}
        open={bulkDelete.dialogOpen}
        showForceOption
        title="Delete selected volumes?"
        onCancel={bulkDelete.closeDeleteDialog}
        onForceCheckedChange={bulkDelete.setForceDelete}
        onConfirm={() => void bulkDelete.confirmDelete({ onComplete: reload })}
      />
    </>
  );
}

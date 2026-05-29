import { useCallback, useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { ResourceBulkActionsBar } from "./resource-bulk-actions-bar";
import { ResourceSelectionHeaderCheckbox, ResourceSelectionRowCheckbox } from "./resource-selection-checkbox";
import { useBulkResourceDelete } from "../hooks/use-bulk-resource-delete";
import { filterByQuery, toErrorMessage } from "../lib/search-utils";
import { alertSuccess, alertWarning, statusBadgeSuccess } from "../lib/theme-classes";
import { fetchRegistries, searchRegistryImages } from "../lib/tauri-registry";
import { classifyDockerCommand, fetchImages, runDockerCommand } from "../lib/tauri-docker";
import type { DockerStatus, ImageInfo } from "../types/docker";
import type { RegistryConfigPublic, RegistrySearchResult } from "../types/registry";

type ImagesViewMode = "local" | "registry";

type ImagesPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
  initialViewMode?: ImagesViewMode;
  onOpenPlayground?: (command: string) => void;
  onViewModeApplied?: () => void;
};

export function ImagesPage({
  dockerStatus,
  engineRevision,
  searchQuery,
  initialViewMode = "local",
  onOpenPlayground,
  onViewModeApplied,
}: ImagesPageProps) {
  const [viewMode, setViewMode] = useState<ImagesViewMode>(initialViewMode);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [registries, setRegistries] = useState<RegistryConfigPublic[]>([]);
  const [registryResults, setRegistryResults] = useState<RegistrySearchResult[]>([]);
  const [selectedRegistryId, setSelectedRegistryId] = useState("");
  const [registryMessage, setRegistryMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pullStatusMessage, setPullStatusMessage] = useState<string | null>(null);
  const [lastPulledReference, setLastPulledReference] = useState<string | null>(null);

  useEffect(() => {
    if (initialViewMode === "local") {
      return;
    }

    setViewMode(initialViewMode);
    onViewModeApplied?.();
  }, [initialViewMode, onViewModeApplied]);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!dockerStatus?.isRunning) {
        setImages([]);
        setErrorMessage("Docker does not appear to be running. Start Docker Engine and refresh.");
        return;
      }

      setImages(await fetchImages());
    } catch (error) {
      setImages([]);
      setErrorMessage(toErrorMessage(error, "Could not load images."));
    } finally {
      setIsLoading(false);
    }
  }, [dockerStatus?.isRunning]);

  const loadRegistries = useCallback(async () => {
    try {
      const list = await fetchRegistries();
      setRegistries(list);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not load registry settings."));
    }
  }, []);

  useEffect(() => {
    void loadImages();
    void loadRegistries();
  }, [loadImages, loadRegistries, engineRevision]);

  const runRegistrySearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setRegistryResults([]);
      setRegistryMessage("Enter a search term in the toolbar.");
      return;
    }

    setIsSearchingRegistry(true);
    setErrorMessage(null);
    setRegistryMessage(null);

    try {
      const response = await searchRegistryImages(query, selectedRegistryId || undefined);
      setRegistryResults(response.results);
      setRegistryMessage(response.message);
    } catch (error) {
      setRegistryResults([]);
      setRegistryMessage(toErrorMessage(error, "Registry search failed."));
    } finally {
      setIsSearchingRegistry(false);
    }
  }, [searchQuery, selectedRegistryId]);

  useEffect(() => {
    if (viewMode !== "registry") {
      return;
    }

    const handle = window.setTimeout(() => {
      void runRegistrySearch();
    }, 350);

    return () => window.clearTimeout(handle);
  }, [engineRevision, viewMode, runRegistrySearch]);

  const filteredImages = useMemo(
    () => filterByQuery(images, searchQuery, (image) => [image.repository, image.tag, image.id, image.shortId]),
    [images, searchQuery]
  );

  const bulkDelete = useBulkResourceDelete({
    items: filteredImages,
    getKey: (image) => image.id,
    toDeleteEntry: (image) => ({ kind: "image", item: image }),
  });

  useEffect(() => {
    if (viewMode !== "local") {
      bulkDelete.selection.clear();
    }
  }, [viewMode, bulkDelete.selection.clear]);

  const combinedError = errorMessage ?? bulkDelete.deleteErrorMessage;

  const footerStatusLabel =
    viewMode === "local" ? `Showing ${filteredImages.length} images` : `Showing ${registryResults.length} results`;

  const handlePull = async (pullReference: string) => {
    if (!dockerStatus?.isRunning) {
      setErrorMessage("Docker does not appear to be running. Start Docker Engine before pulling images.");
      return;
    }

    const command = `docker pull ${pullReference}`;
    setIsPulling(pullReference);
    setErrorMessage(null);
    setPullStatusMessage(null);

    try {
      const classification = await classifyDockerCommand(command);
      const result = await runDockerCommand(classification.normalized);

      if (result.exitCode === 0) {
        setLastPulledReference(pullReference);
        setPullStatusMessage(`Pulled ${pullReference}.`);
        await loadImages();
      } else {
        setErrorMessage(result.stderr.trim() || `Pull failed with exit code ${result.exitCode}.`);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to pull image."));
    } finally {
      setIsPulling(null);
    }
  };

  const registryFilter =
    viewMode === "registry" ? (
      <Select
        value={selectedRegistryId || "all"}
        onValueChange={(value) => setSelectedRegistryId(value === "all" ? "" : value)}
      >
        <SelectTrigger
          aria-label="Registry filter"
          className="w-[min(100%,14rem)] rounded-lg bg-(--surface)"
        >
          <SelectValue placeholder="All enabled registries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All enabled registries</SelectItem>
          {registries
            .filter((registry) => registry.enabled)
            .map((registry) => (
              <SelectItem
                key={registry.id}
                value={registry.id}
              >
                {registry.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    ) : null;

  return (
    <>
      <PageShell
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "local" ? (
              <ResourceBulkActionsBar
                allVisibleSelected={bulkDelete.selection.isAllSelected(bulkDelete.visibleKeys)}
                isDeleting={bulkDelete.isDeleting}
                resourceLabel="image"
                selectedCount={bulkDelete.selectedEntries.length}
                visibleCount={bulkDelete.visibleKeys.length}
                onClearSelection={bulkDelete.selection.clear}
                onDelete={bulkDelete.openDeleteDialog}
                onSelectAllVisible={bulkDelete.toggleSelectAllVisible}
              />
            ) : null}
            {registryFilter}
          </div>
        }
        description={
          viewMode === "local"
            ? "Browse local images, tags, and disk usage."
            : "Search Docker Hub and configured registries, then pull images locally."
        }
        errorMessage={combinedError}
        isLoading={viewMode === "local" ? isLoading : isSearchingRegistry}
        footerStatusLabel={footerStatusLabel}
        title="Images"
      >
        {pullStatusMessage ? (
          <div className={`mx-4 mt-4 rounded-lg px-4 py-3 text-sm sm:mx-6 ${alertSuccess}`}>
            {pullStatusMessage}
            {onOpenPlayground && lastPulledReference ? (
              <button
                className="ml-2 underline"
                type="button"
                onClick={() => onOpenPlayground(`docker pull ${lastPulledReference}`)}
              >
                Open in CLI
              </button>
            ) : null}
          </div>
        ) : null}

        {viewMode === "local" ? (
          isLoading ? (
            <PageLoadingSkeleton />
          ) : filteredImages.length === 0 ? (
            <PageEmptyState message="No images match the current filters." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-(--surface)">
                  <tr className="border-b border-(--border) text-left text-(--text-muted)">
                    <th className="w-10 px-4 py-3 font-medium sm:px-6">
                      <ResourceSelectionHeaderCheckbox
                        allSelected={bulkDelete.selection.isAllSelected(bulkDelete.visibleKeys)}
                        partiallySelected={bulkDelete.selection.isPartiallySelected(bulkDelete.visibleKeys)}
                        onToggleAll={bulkDelete.toggleSelectAllVisible}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium sm:px-6">Repository</th>
                    <th className="px-3 py-3 font-medium">Tag</th>
                    <th className="px-3 py-3 font-medium">Image ID</th>
                    <th className="px-3 py-3 font-medium">Size</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                    <th className="px-3 py-3 font-medium">Containers</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImages.map((image) => {
                    const selected = bulkDelete.selection.isSelected(image.id);

                    return (
                      <tr
                        className={`border-b border-(--border) transition ${
                          selected ? "bg-(--accent-soft)" : "hover:bg-(--surface-hover)"
                        }`}
                        key={image.id}
                      >
                        <td className="px-4 py-3 sm:px-6">
                          <ResourceSelectionRowCheckbox
                            checked={selected}
                            label={`${image.repository}:${image.tag}`}
                            onToggle={() => bulkDelete.selection.toggle(image.id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-(--text-primary) sm:px-6">{image.repository}</td>
                        <td className="px-3 py-3 text-(--text-secondary)">{image.tag}</td>
                        <td className="px-3 py-3 font-mono text-xs text-(--text-muted)">{image.shortId}</td>
                        <td className="px-3 py-3 text-(--text-secondary)">{image.size}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-(--text-secondary)">{image.createdAt}</td>
                        <td className="px-3 py-3 text-(--text-secondary)">
                          {image.containers < 0 ? "—" : image.containers}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : isSearchingRegistry && registryResults.length === 0 ? (
          <PageLoadingSkeleton />
        ) : registryResults.length === 0 ? (
          <PageEmptyState
            message={registryMessage ?? "No registry results yet. Use the toolbar search to find images."}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {registryMessage ? <p className={`px-4 py-2 text-xs sm:px-6 ${alertWarning}`}>{registryMessage}</p> : null}
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-(--surface)">
                <tr className="border-b border-(--border) text-left text-(--text-muted)">
                  <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                  <th className="px-3 py-3 font-medium">Registry</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">Stars</th>
                  <th className="px-3 py-3 font-medium">Pull</th>
                </tr>
              </thead>
              <tbody>
                {registryResults.map((result) => (
                  <tr
                    className="border-b border-(--border) transition hover:bg-(--surface-hover)"
                    key={`${result.registryId}-${result.pullReference}`}
                  >
                    <td className="px-4 py-3 font-medium text-(--text-primary) sm:px-6">
                      {result.name}
                      {result.isOfficial ? (
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[0.65rem] ${statusBadgeSuccess}`}>
                          Official
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-(--text-secondary)">{result.registryName}</td>
                    <td className="max-w-md px-3 py-3 text-(--text-muted)">{result.description ?? "—"}</td>
                    <td className="px-3 py-3 text-(--text-secondary)">{result.starCount ?? "—"}</td>
                    <td className="px-3 py-3">
                      <button
                        className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-primary) hover:bg-(--surface-hover) disabled:opacity-60"
                        disabled={isPulling === result.pullReference}
                        type="button"
                        onClick={() => void handlePull(result.pullReference)}
                      >
                        {isPulling === result.pullReference ? "Pulling…" : "Pull"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <BulkDeleteDialog
        description="This permanently deletes the selected local images. Images used by containers are removed with force when needed."
        isDeleting={bulkDelete.isDeleting}
        itemLabels={bulkDelete.selectedLabels}
        open={bulkDelete.dialogOpen}
        title="Delete selected images?"
        onCancel={bulkDelete.closeDeleteDialog}
        onConfirm={() => void bulkDelete.confirmDelete({ onComplete: loadImages })}
      />
    </>
  );
}

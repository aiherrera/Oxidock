import { useCallback, useMemo, useState } from "react";
import { useResourceSelection } from "../hooks/use-resource-selection";
import {
  deleteSelectedResources,
  formatDeleteFailures,
  getResourceLabel,
  isProtectedNetwork,
  type DeleteFailure,
  type DeleteResourceItem,
  type DeleteResourcesOptions,
} from "../lib/resource-delete";

type UseBulkResourceDeleteOptions<T> = {
  items: T[];
  getKey: (item: T) => string;
  toDeleteEntry: (item: T) => DeleteResourceItem;
};

export function useBulkResourceDelete<T>({ items, getKey, toDeleteEntry }: UseBulkResourceDeleteOptions<T>) {
  const selection = useResourceSelection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  const visibleKeys = useMemo(() => items.map(getKey), [getKey, items]);

  const selectedEntries = useMemo(
    () => items.filter((item) => selection.isSelected(getKey(item))).map(toDeleteEntry),
    [getKey, items, selection, toDeleteEntry]
  );

  const selectedLabels = useMemo<string[]>(() => selectedEntries.map(getResourceLabel), [selectedEntries]);

  const requiresForceConfirmation = useMemo(
    () =>
      selectedEntries.some((entry) => {
        if (entry.kind === "network" && isProtectedNetwork(entry.item.name)) {
          return true;
        }

        if (entry.kind === "image" && entry.item.containers > 0) {
          return true;
        }

        if (entry.kind === "network" && entry.item.containerCount > 0) {
          return true;
        }

        return false;
      }),
    [selectedEntries]
  );

  const openDeleteDialog = useCallback(() => {
    setDeleteErrorMessage(null);
    setForceDelete(false);
    setDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setDialogOpen(false);
    }
  }, [isDeleting]);

  const toggleSelectAllVisible = useCallback(() => {
    if (selection.isAllSelected(visibleKeys)) {
      selection.clear();
      return;
    }

    selection.selectAll(visibleKeys);
  }, [selection, visibleKeys]);

  const confirmDelete = useCallback(
    async (options?: DeleteResourcesOptions & { onComplete?: () => Promise<void> }) => {
      if (selectedEntries.length === 0) {
        return;
      }

      setIsDeleting(true);
      setDeleteErrorMessage(null);

      try {
        const result = await deleteSelectedResources(selectedEntries, {
          force: options?.force ?? forceDelete,
        });

        if (result.failures.length > 0) {
          selection.setSelectedKeys(result.failures.map((failure: DeleteFailure) => failure.key));
          setDeleteErrorMessage(formatDeleteFailures(result.failures));
        } else {
          selection.clear();
          setDialogOpen(false);
        }

        await options?.onComplete?.();
      } finally {
        setIsDeleting(false);
      }
    },
    [forceDelete, selectedEntries, selection]
  );

  return {
    selection,
    dialogOpen,
    isDeleting,
    deleteErrorMessage,
    forceDelete,
    setForceDelete,
    selectedEntries,
    selectedLabels,
    visibleKeys,
    requiresForceConfirmation,
    openDeleteDialog,
    closeDeleteDialog,
    toggleSelectAllVisible,
    confirmDelete,
    setDeleteErrorMessage,
  };
}

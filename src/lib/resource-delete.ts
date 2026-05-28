import { getContainerActionAvailability } from "./container-action-availability";
import { removeContainer, removeImage, removeNetwork, removeVolume } from "./tauri-docker";
import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";

export const DELETE_CONCURRENCY = 4;

export type ResourceKind = "container" | "image" | "volume" | "network";

export type DeleteResourceItem =
  | { kind: "container"; item: ContainerInfo }
  | { kind: "image"; item: ImageInfo }
  | { kind: "volume"; item: VolumeInfo }
  | { kind: "network"; item: NetworkInfo };

export type DeleteFailure = {
  key: string;
  label: string;
  message: string;
};

export type DeleteResourcesResult = {
  deletedKeys: string[];
  failures: DeleteFailure[];
};

export type DeleteResourcesOptions = {
  force?: boolean;
};

export const PROTECTED_NETWORK_NAMES = new Set(["bridge", "host", "none"]);

export const isProtectedNetwork = (name: string) => PROTECTED_NETWORK_NAMES.has(name.trim().toLowerCase());

export const getResourceKey = (entry: DeleteResourceItem): string => {
  switch (entry.kind) {
    case "container":
      return entry.item.id;
    case "image":
      return entry.item.id;
    case "volume":
      return entry.item.name;
    case "network":
      return entry.item.id;
  }
};

export const getResourceLabel = (entry: DeleteResourceItem): string => {
  switch (entry.kind) {
    case "container":
      return entry.item.service ?? entry.item.name;
    case "image":
      return `${entry.item.repository}:${entry.item.tag}`;
    case "volume":
      return entry.item.name;
    case "network":
      return entry.item.name;
  }
};

const shouldForceDelete = (entry: DeleteResourceItem, options: DeleteResourcesOptions): boolean => {
  if (options.force) {
    return true;
  }

  switch (entry.kind) {
    case "container":
      return getContainerActionAvailability(entry.item).forceRemove;
    case "image":
      return entry.item.containers > 0;
    case "volume":
      return false;
    case "network":
      return entry.item.containerCount > 0;
  }
};

const validateDelete = (entry: DeleteResourceItem, options: DeleteResourcesOptions): string | null => {
  if (entry.kind === "network" && isProtectedNetwork(entry.item.name) && !options.force) {
    return "Default Docker networks cannot be removed.";
  }

  if (entry.kind === "container" && !getContainerActionAvailability(entry.item).canRemove) {
    return "Container is already being removed.";
  }

  return null;
};

const deleteOne = async (entry: DeleteResourceItem, options: DeleteResourcesOptions): Promise<void> => {
  const validationError = validateDelete(entry, options);
  if (validationError) {
    throw new Error(validationError);
  }

  const force = shouldForceDelete(entry, options);

  switch (entry.kind) {
    case "container":
      await removeContainer(entry.item.id, force);
      return;
    case "image":
      await removeImage(entry.item.id, force);
      return;
    case "volume":
      await removeVolume(entry.item.name, force);
      return;
    case "network":
      await removeNetwork(entry.item.id, force);
      return;
  }
};

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  if (items.length === 0) {
    return;
  }

  let index = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]!);
    }
  });

  await Promise.all(runners);
};

export const deleteSelectedResources = async (
  entries: DeleteResourceItem[],
  options: DeleteResourcesOptions = {}
): Promise<DeleteResourcesResult> => {
  const deletedKeys: string[] = [];
  const failures: DeleteFailure[] = [];

  await runWithConcurrency(entries, DELETE_CONCURRENCY, async (entry) => {
    const key = getResourceKey(entry);
    const label = getResourceLabel(entry);

    try {
      await deleteOne(entry, options);
      deletedKeys.push(key);
    } catch (error) {
      failures.push({
        key,
        label,
        message: error instanceof Error ? error.message : "Delete failed.",
      });
    }
  });

  return { deletedKeys, failures };
};

export const formatDeleteFailures = (failures: DeleteFailure[]): string => {
  if (failures.length === 0) {
    return "";
  }

  const preview = failures.slice(0, 3).map((failure) => `${failure.label}: ${failure.message}`);
  const remainder = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
  return preview.join(" · ") + remainder;
};

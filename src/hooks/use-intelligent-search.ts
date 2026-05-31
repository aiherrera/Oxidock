import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildIntelligentSearchGroups,
  extractRegistryQuery,
  shouldSearchRegistries,
  type LocalDockerSnapshot,
} from "../lib/intelligent-search";
import { useDockerContainersChanged } from "../lib/docker-change-events";
import { toErrorMessage } from "../lib/search-utils";
import { searchRegistryImages } from "../lib/tauri-registry";
import { fetchContainers, fetchImages, fetchNetworks, fetchVolumes } from "../lib/tauri-docker";
import type { AppPage } from "../types/app";
import type { IntelligentSearchGroup } from "../types/intelligent-search";
import type { RegistrySearchResult } from "../types/registry";

const EMPTY_SNAPSHOT: LocalDockerSnapshot = {
  containers: [],
  images: [],
  volumes: [],
  networks: [],
};

const REGISTRY_DEBOUNCE_MS = 350;
const SNAPSHOT_MAX_AGE_MS = 30_000;

type UseIntelligentSearchOptions = {
  query: string;
  currentPage?: AppPage;
  enabled: boolean;
  dockerRunning: boolean;
  engineRevision?: number;
};

export const useIntelligentSearch = ({
  query,
  currentPage,
  enabled,
  dockerRunning,
  engineRevision = 0,
}: UseIntelligentSearchOptions) => {
  const [snapshot, setSnapshot] = useState<LocalDockerSnapshot>(EMPTY_SNAPSHOT);
  const [registryResults, setRegistryResults] = useState<RegistrySearchResult[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const [registryMessage, setRegistryMessage] = useState<string | null>(null);
  const registryRequestIdRef = useRef(0);
  const snapshotFetchedAtRef = useRef(0);
  const snapshotRevisionRef = useRef(engineRevision);

  const refreshLocalSnapshot = useCallback(async () => {
    if (!dockerRunning) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    setIsLoadingLocal(true);
    try {
      const [containers, images, volumes, networks] = await Promise.all([
        fetchContainers(true),
        fetchImages(),
        fetchVolumes(),
        fetchNetworks(),
      ]);

      setSnapshot({ containers, images, volumes, networks });
      snapshotFetchedAtRef.current = Date.now();
    } catch {
      setSnapshot(EMPTY_SNAPSHOT);
      snapshotFetchedAtRef.current = 0;
    } finally {
      setIsLoadingLocal(false);
    }
  }, [dockerRunning]);

  useDockerContainersChanged(
    useCallback(() => {
      if (enabled) {
        void refreshLocalSnapshot();
      }
    }, [enabled, refreshLocalSnapshot]),
    enabled && dockerRunning
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (snapshotRevisionRef.current !== engineRevision) {
      snapshotRevisionRef.current = engineRevision;
      snapshotFetchedAtRef.current = 0;
    }

    const age = Date.now() - snapshotFetchedAtRef.current;
    if (snapshotFetchedAtRef.current > 0 && age < SNAPSHOT_MAX_AGE_MS) {
      return;
    }

    void refreshLocalSnapshot();
  }, [enabled, engineRevision, refreshLocalSnapshot]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || !trimmed || !shouldSearchRegistries(trimmed, currentPage)) {
      setRegistryResults([]);
      setRegistryMessage(null);
      setIsSearchingRegistry(false);
      return;
    }

    const requestId = registryRequestIdRef.current + 1;
    registryRequestIdRef.current = requestId;
    setIsSearchingRegistry(true);

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchRegistryImages(extractRegistryQuery(trimmed));
          if (registryRequestIdRef.current !== requestId) {
            return;
          }

          setRegistryResults(response.results);
          setRegistryMessage(response.message);
        } catch (error) {
          if (registryRequestIdRef.current !== requestId) {
            return;
          }

          setRegistryResults([]);
          setRegistryMessage(toErrorMessage(error, "Registry search failed."));
        } finally {
          if (registryRequestIdRef.current === requestId) {
            setIsSearchingRegistry(false);
          }
        }
      })();
    }, REGISTRY_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [currentPage, enabled, query]);

  const groups = useMemo<IntelligentSearchGroup[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    return buildIntelligentSearchGroups({
      query: trimmed,
      snapshot,
      currentPage,
      registryResults,
      includeRegistry: true,
    });
  }, [currentPage, query, registryResults, snapshot]);

  return {
    groups,
    isLoadingLocal,
    isSearchingRegistry,
    registryMessage,
    refreshLocalSnapshot,
  };
};

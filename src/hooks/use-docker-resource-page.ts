import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "../lib/search-utils";
import type { DockerStatus } from "../types/docker";

type UseDockerResourcePageOptions<T> = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  fetch: () => Promise<T[]>;
  stoppedMessage?: string;
  failureMessage?: string;
};

type UseDockerResourcePageResult<T> = {
  items: T[];
  isLoading: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
};

export function useDockerResourcePage<T>({
  dockerStatus,
  engineRevision,
  fetch,
  stoppedMessage = "Docker does not appear to be running. Start Docker Engine and refresh.",
  failureMessage = "Could not load data.",
}: UseDockerResourcePageOptions<T>): UseDockerResourcePageResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!dockerStatus?.isRunning) {
        setItems([]);
        setErrorMessage(stoppedMessage);
        return;
      }

      setItems(await fetch());
    } catch (error) {
      setItems([]);
      setErrorMessage(toErrorMessage(error, failureMessage));
    } finally {
      setIsLoading(false);
    }
  }, [dockerStatus?.isRunning, fetch, stoppedMessage, failureMessage]);

  useEffect(() => {
    void reload();
  }, [reload, engineRevision]);

  return { items, isLoading, errorMessage, reload };
}

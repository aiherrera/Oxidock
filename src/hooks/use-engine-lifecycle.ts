import { useCallback, useState } from "react";
import { runEngineLifecycleAction } from "../lib/tauri-engine";
import { toErrorMessage } from "../lib/search-utils";
import type { EngineLifecycleAction, EngineLifecycleCapability, EngineLifecycleActionResult } from "../types/engine";

type UseEngineLifecycleOptions = {
  providerId: string | null | undefined;
  onEngineChanged?: (revision: number) => void;
  beforeRun?: (capability: EngineLifecycleCapability) => boolean;
  onSuccess?: (result: EngineLifecycleActionResult) => void | Promise<void>;
};

export function useEngineLifecycle({ providerId, onEngineChanged, beforeRun, onSuccess }: UseEngineLifecycleOptions) {
  const [runningLifecycleAction, setRunningLifecycleAction] = useState<EngineLifecycleAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runLifecycleAction = useCallback(
    async (capability: EngineLifecycleCapability) => {
      if (!capability.supported) {
        return;
      }

      if (!providerId) {
        setActionError("No active engine is selected.");
        return;
      }

      if (beforeRun && !beforeRun(capability)) {
        return;
      }

      setRunningLifecycleAction(capability.action);
      setActionError(null);

      try {
        const result = await runEngineLifecycleAction(capability.action, { id: providerId });
        await onSuccess?.(result);
        onEngineChanged?.(result.engineRevision);
      } catch (error) {
        setActionError(toErrorMessage(error, `Could not ${capability.action} engine.`));
      } finally {
        setRunningLifecycleAction(null);
      }
    },
    [beforeRun, onEngineChanged, onSuccess, providerId]
  );

  return {
    runningLifecycleAction,
    actionError,
    runLifecycleAction,
    setActionError,
  };
}

import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export const DOCKER_CHANGED_EVENT = "docker-changed";
export const DOCKER_SCOPE_CONTAINERS = "containers";
export const DOCKER_SCOPE_STATUS = "status";

export type DockerChangedPayload = {
  scope: string;
};

const DEBOUNCE_MS = 300;

export function useDockerChanged(scope: string, onChange: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let debounceId: number | undefined;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<DockerChangedPayload>(DOCKER_CHANGED_EVENT, (event) => {
        if (event.payload.scope !== scope) {
          return;
        }

        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
          if (!disposed) {
            onChange();
          }
        }, DEBOUNCE_MS);
      });

      if (disposed) {
        unlisten();
      }
    };

    void setup();

    return () => {
      disposed = true;
      window.clearTimeout(debounceId);
      unlisten?.();
    };
  }, [enabled, onChange, scope]);
}

export function useDockerContainersChanged(onChange: () => void, enabled: boolean) {
  useDockerChanged(DOCKER_SCOPE_CONTAINERS, onChange, enabled);
}

export function useDockerStatusChanged(onChange: () => void) {
  useDockerChanged(DOCKER_SCOPE_STATUS, onChange, true);
}

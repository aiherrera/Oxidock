import type { ContainerInfo } from "../types/docker";
import { isExited, isRunning, normalizeState } from "./container-utils";

export type ContainerActionAvailability = {
  canInspect: boolean;
  canViewLogs: boolean;
  canStart: boolean;
  canStop: boolean;
  canRestart: boolean;
  canRemove: boolean;
  forceRemove: boolean;
};

export const getContainerActionAvailability = (container: ContainerInfo): ContainerActionAvailability => {
  const state = normalizeState(container.state);
  const running = isRunning(container);
  const exited = isExited(container);

  const canRemove = state !== "removing";
  const forceRemove = !exited;

  return {
    canInspect: true,
    canViewLogs: running,
    canStart: exited,
    canStop: running,
    canRestart: running,
    canRemove,
    forceRemove,
  };
};

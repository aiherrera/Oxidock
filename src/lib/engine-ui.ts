import type { DockerStatus } from "../types/docker";
import type { EngineLifecycleAction, EngineLifecycleCapability } from "../types/engine";

export function getEngineStateLabel(
  state: DockerStatus["engineState"] | "checking",
  action: EngineLifecycleAction | null
) {
  if (action) {
    return getLifecycleProgressLabel(action);
  }

  switch (state) {
    case "checking":
      return "Checking...";
    case "running":
      return "Engine running";
    case "paused":
      return "Engine paused";
    case "stopped":
      return "Engine stopped";
    case "unavailable":
    default:
      return "Engine unavailable";
  }
}

export function getLifecycleProgressLabel(action: EngineLifecycleAction) {
  switch (action) {
    case "start":
      return "Engine starting...";
    case "pause":
      return "Engine pausing...";
    case "stop":
      return "Engine stopping...";
  }
}

export function getEngineStateColorClass(
  state: DockerStatus["engineState"] | "checking",
  action: EngineLifecycleAction | null
) {
  if (action === "start" || action === "stop") {
    return "bg-amber-400";
  }

  switch (state) {
    case "running":
      return "bg-emerald-400";
    case "paused":
      return "bg-sky-400";
    case "stopped":
      return "bg-red-400";
    case "checking":
      return "bg-slate-500";
    case "unavailable":
    default:
      return "bg-red-400";
  }
}

export function getSidebarLifecycleActions(
  state: DockerStatus["engineState"] | undefined,
  capabilities: EngineLifecycleCapability[]
) {
  const capabilityByAction = new Map(
    capabilities.filter((capability) => capability.supported).map((capability) => [capability.action, capability])
  );

  if (state === "running") {
    return [capabilityByAction.get("pause"), capabilityByAction.get("stop")].filter(
      Boolean
    ) as EngineLifecycleCapability[];
  }

  if (state === "stopped") {
    return [capabilityByAction.get("start")].filter(Boolean) as EngineLifecycleCapability[];
  }

  if (state === "paused") {
    return [capabilityByAction.get("stop")].filter(Boolean) as EngineLifecycleCapability[];
  }

  return [];
}

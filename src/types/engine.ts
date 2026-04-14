export type EngineProviderKind =
  | "dockerDesktop"
  | "colima"
  | "orbstack"
  | "rancherDesktop"
  | "remote"
  | "local"
  | "unknown";

export type EngineLifecycleAction = "start" | "pause" | "stop";

export type EngineLifecycleCapability = {
  action: EngineLifecycleAction;
  supported: boolean;
  label: string;
  reason: string | null;
};

export type EngineProviderPublic = {
  id: string;
  name: string;
  kind: EngineProviderKind;
  contextName: string | null;
  endpoint: string;
  description: string;
  isDefault: boolean;
  isCurrent: boolean;
  reachable: boolean;
  lifecycleCapabilities: EngineLifecycleCapability[];
};

export type ActiveEnginePublic = {
  id: string;
  name: string;
  kind: EngineProviderKind;
  contextName: string | null;
  endpoint: string;
  userSelected: boolean;
  revision: number;
  lifecycleCapabilities: EngineLifecycleCapability[];
};

export type EngineSelectionInput = {
  id: string;
};

export type EngineConnectionTestResult = {
  success: boolean;
  message: string;
  serverVersion: string | null;
};

export type EngineLifecycleCapabilitiesResult = {
  capabilities: EngineLifecycleCapability[];
};

export type EngineLifecycleActionResult = {
  success: boolean;
  message: string;
  action: EngineLifecycleAction;
  engineRevision: number;
};

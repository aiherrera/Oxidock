import { invoke } from "@tauri-apps/api/core";
import type {
  ActiveEnginePublic,
  EngineConnectionTestResult,
  EngineLifecycleAction,
  EngineLifecycleActionResult,
  EngineLifecycleCapabilitiesResult,
  EngineProviderPublic,
  EngineSelectionInput,
} from "../types/engine";

export const listEngineProviders = () => invoke<EngineProviderPublic[]>("list_engine_providers");

export const getActiveEngine = () => invoke<ActiveEnginePublic>("get_active_engine");

export const setActiveEngine = (selection: EngineSelectionInput) =>
  invoke<ActiveEnginePublic>("set_active_engine", { selection });

export const testEngineConnection = (selection?: EngineSelectionInput) =>
  invoke<EngineConnectionTestResult>("test_engine_connection", { selection });

export const getEngineLifecycleCapabilities = (selection?: EngineSelectionInput) =>
  invoke<EngineLifecycleCapabilitiesResult>("get_engine_lifecycle_capabilities", {
    selection: selection ?? null,
  });

export const runEngineLifecycleAction = (action: EngineLifecycleAction, selection?: EngineSelectionInput) =>
  invoke<EngineLifecycleActionResult>("run_engine_lifecycle_action", {
    action,
    selection: selection ?? null,
  });

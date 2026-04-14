import { useCallback, useEffect, useMemo, useState } from "react";
import { useEngineLifecycle } from "../hooks/use-engine-lifecycle";
import { toErrorMessage } from "../lib/search-utils";
import { alertDanger, alertSuccess, statusBadgeDanger } from "../lib/theme-classes";
import {
  getActiveEngine,
  listEngineProviders,
  setActiveEngine as applyActiveEngine,
  testEngineConnection,
} from "../lib/tauri-engine";
import type {
  ActiveEnginePublic,
  EngineLifecycleAction,
  EngineLifecycleCapability,
  EngineProviderPublic,
} from "../types/engine";

const kindLabels: Record<EngineProviderPublic["kind"], string> = {
  dockerDesktop: "Docker Desktop",
  colima: "Colima",
  orbstack: "OrbStack",
  rancherDesktop: "Rancher Desktop",
  remote: "Remote",
  local: "Local",
  unknown: "Unknown",
};

const lifecycleOrder: EngineLifecycleAction[] = ["start", "pause", "stop"];

type EngineSettingsPanelProps = {
  onEngineChanged?: (revision: number) => void;
};

export function EngineSettingsPanel({ onEngineChanged }: EngineSettingsPanelProps) {
  const [providers, setProviders] = useState<EngineProviderPublic[]>([]);
  const [activeEngine, setActiveEngine] = useState<ActiveEnginePublic | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? null,
    [providers, selectedId]
  );

  const lifecycleCapabilities = useMemo(() => {
    const capabilities = selectedProvider?.lifecycleCapabilities ?? [];
    return lifecycleOrder.map((action) => {
      const capability = capabilities.find((entry) => entry.action === action);
      return (
        capability ?? {
          action,
          supported: false,
          label: action.charAt(0).toUpperCase() + action.slice(1),
          reason: "Lifecycle controls are unavailable for this provider.",
        }
      );
    });
  }, [selectedProvider]);

  const loadEngines = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [listed, active] = await Promise.all([listEngineProviders(), getActiveEngine()]);
      setProviders(listed);
      setActiveEngine(active);
      setSelectedId(active.id);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not load engine providers."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEngines();
  }, [loadEngines]);

  const handleApply = async () => {
    if (!selectedId || selectedId === activeEngine?.id) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const active = await applyActiveEngine({ id: selectedId });
      setActiveEngine(active);
      setSelectedId(active.id);
      setStatusMessage(`Active engine set to ${active.name}.`);
      onEngineChanged?.(active.revision);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not switch engine."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await testEngineConnection(selectedId ? { id: selectedId } : undefined);
      if (result.success) {
        setStatusMessage(result.serverVersion ? `Connection OK (API ${result.serverVersion}).` : result.message);
      } else {
        setErrorMessage(result.message);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Connection test failed."));
    } finally {
      setIsTesting(false);
    }
  };

  const confirmLifecycleAction = (capability: EngineLifecycleCapability) => {
    if (capability.action === "start") {
      return true;
    }

    const providerName = selectedProvider?.name ?? "this engine";
    const message =
      capability.action === "pause"
        ? `Pause will suspend ${providerName}. This can interrupt running containers and detach active sessions. Continue?`
        : `Stop will shut down ${providerName}. This can interrupt running containers and detach active sessions. Continue?`;
    return window.confirm(message);
  };

  const { runningLifecycleAction, actionError, runLifecycleAction } = useEngineLifecycle({
    providerId: selectedId,
    beforeRun: confirmLifecycleAction,
    onEngineChanged,
    onSuccess: async (result) => {
      await loadEngines();
      setStatusMessage(result.message);
    },
  });

  const handleLifecycleAction = async (capability: EngineLifecycleCapability) => {
    if (!capability.supported || !selectedId) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    await runLifecycleAction(capability);
  };

  return (
    <section className="rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-(--text-primary)">Container engine</h2>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Choose which Docker-compatible engine Oxidock uses for API calls and the CLI playground.
          </p>
        </div>
        <button
          className="rounded-md border border-(--border) px-3 py-1.5 text-sm text-(--text-primary) hover:bg-(--surface-hover)"
          disabled={isLoading}
          type="button"
          onClick={() => void loadEngines()}
        >
          Refresh
        </button>
      </div>

      {errorMessage || actionError ? (
        <p className={`mt-4 rounded-md px-3 py-2 text-sm ${alertDanger}`}>{errorMessage ?? actionError}</p>
      ) : null}
      {statusMessage ? <p className={`mt-4 rounded-md px-3 py-2 text-sm ${alertSuccess}`}>{statusMessage}</p> : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-(--text-muted)">Detecting engines…</p>
      ) : providers.length === 0 ? (
        <p className={`mt-4 rounded-md px-3 py-2 text-sm ${statusBadgeDanger}`}>
          No Docker contexts were detected. Install Docker Desktop, Colima, OrbStack, or Rancher Desktop, then refresh.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {providers.map((provider) => {
            const isSelected = selectedId === provider.id;
            const isActive = provider.isCurrent;

            return (
              <label
                key={provider.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                  isSelected ? "border-(--accent) bg-(--surface-hover)" : "border-(--border) hover:bg-(--surface-hover)"
                }`}
              >
                <input
                  checked={isSelected}
                  className="mt-1"
                  name="engine-provider"
                  type="radio"
                  value={provider.id}
                  onChange={() => setSelectedId(provider.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-(--text-primary)">{provider.name}</span>
                    <span className="rounded-full border border-(--border) px-2 py-0.5 text-xs text-(--text-muted)">
                      {kindLabels[provider.kind]}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        Active
                      </span>
                    ) : null}
                    {provider.reachable ? (
                      <span className="text-xs text-(--text-muted)">Reachable</span>
                    ) : (
                      <span className="text-xs text-red-400">Unreachable</span>
                    )}
                  </div>
                  {provider.contextName ? (
                    <p className="mt-1 text-xs text-(--text-muted)">Context: {provider.contextName}</p>
                  ) : null}
                  <p
                    className="mt-1 truncate text-xs text-(--text-muted)"
                    title={provider.endpoint}
                  >
                    {provider.endpoint}
                  </p>
                  {provider.description ? (
                    <p className="mt-1 text-xs text-(--text-secondary)">{provider.description}</p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-(--accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSaving || isLoading || !selectedId || selectedId === activeEngine?.id}
          type="button"
          onClick={() => void handleApply()}
        >
          {isSaving ? "Applying…" : "Use selected engine"}
        </button>
        <button
          className="rounded-md border border-(--border) px-3 py-1.5 text-sm text-(--text-primary) hover:bg-(--surface-hover) disabled:opacity-50"
          disabled={isTesting || isLoading || !selectedId}
          type="button"
          onClick={() => void handleTest()}
        >
          {isTesting ? "Testing…" : "Test connection"}
        </button>
      </div>

      {selectedProvider ? (
        <div className="mt-4 rounded-lg border border-(--border) p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-(--text-primary)">Engine lifecycle</h3>
              <p className="mt-1 text-xs text-(--text-secondary)">
                Start or stop the selected local engine. Pause is only shown when the provider supports it.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {lifecycleCapabilities.map((capability) => {
              const isRunning = runningLifecycleAction === capability.action;
              const disabled = !capability.supported || isLoading || !selectedId || runningLifecycleAction !== null;

              return (
                <button
                  key={capability.action}
                  className="rounded-md border border-(--border) px-3 py-1.5 text-sm text-(--text-primary) hover:bg-(--surface-hover) disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  title={capability.supported ? undefined : (capability.reason ?? undefined)}
                  type="button"
                  onClick={() => void handleLifecycleAction(capability)}
                >
                  {isRunning ? `${capability.label}…` : capability.label}
                </button>
              );
            })}
          </div>
          {lifecycleCapabilities.some((capability) => !capability.supported) ? (
            <ul className="mt-3 space-y-1 text-xs text-(--text-muted)">
              {lifecycleCapabilities
                .filter((capability) => !capability.supported && capability.reason)
                .map((capability) => (
                  <li key={`${capability.action}-reason`}>
                    {capability.label}: {capability.reason}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {activeEngine ? (
        <p className="mt-3 text-xs text-(--text-muted)">
          Current: {activeEngine.name}
          {activeEngine.contextName ? ` (${activeEngine.contextName})` : ""}
          {activeEngine.userSelected ? " · user selected" : " · auto-detected"}
        </p>
      ) : null}
    </section>
  );
}

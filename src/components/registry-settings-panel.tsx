import { useCallback, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toErrorMessage } from "../lib/search-utils";
import { alertDanger, alertSuccess, statusBadgeDanger } from "../lib/theme-classes";
import {
  deleteRegistryCredentials,
  fetchRegistries,
  removeRegistry,
  saveRegistryCredentials,
  testRegistryConnection,
  upsertRegistry,
} from "../lib/tauri-registry";
import type { RegistryConfigPublic, RegistryKind } from "../types/registry";

const capabilityLabels: Record<RegistryConfigPublic["searchCapability"], string> = {
  fullTextSearch: "Full-text search",
  catalogFilter: "Catalog name filter",
  unsupported: "Search not supported",
};

type RegistryFormState = {
  id?: string;
  name: string;
  kind: RegistryKind;
  url: string;
  enabled: boolean;
};

const emptyForm = (): RegistryFormState => ({
  name: "",
  kind: "ociDistribution",
  url: "",
  enabled: true,
});

export function RegistrySettingsPanel() {
  const [registries, setRegistries] = useState<RegistryConfigPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [form, setForm] = useState<RegistryFormState>(emptyForm);
  const [credentialRegistryId, setCredentialRegistryId] = useState("");
  const [credentialUsername, setCredentialUsername] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadRegistries = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setRegistries(await fetchRegistries());
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not load registries."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistries();
  }, [loadRegistries]);

  const handleSaveRegistry = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const updated = await upsertRegistry({
        id: form.id,
        name: form.name,
        kind: form.kind,
        url: form.kind === "ociDistribution" ? form.url : "",
        enabled: form.enabled,
      });
      setRegistries(updated);
      setForm(emptyForm());
      setStatusMessage("Registry saved.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not save registry."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (registry: RegistryConfigPublic) => {
    setForm({
      id: registry.id,
      name: registry.name,
      kind: registry.kind,
      url: registry.url,
      enabled: registry.enabled,
    });
    setCredentialRegistryId(registry.id);
  };

  const handleRemove = async (registryId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      setRegistries(await removeRegistry(registryId));
      if (form.id === registryId) {
        setForm(emptyForm());
      }
      if (credentialRegistryId === registryId) {
        setCredentialRegistryId("");
      }
      setStatusMessage("Registry removed.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not remove registry."));
    }
  };

  const handleSaveCredentials = async () => {
    if (!credentialRegistryId) {
      setErrorMessage("Select a registry for credentials.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await saveRegistryCredentials({
        registryId: credentialRegistryId,
        username: credentialUsername,
        password: credentialPassword,
      });
      setCredentialPassword("");
      await loadRegistries();
      setStatusMessage("Credentials saved.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not save credentials."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCredentials = async (registryId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await deleteRegistryCredentials(registryId);
      await loadRegistries();
      setStatusMessage("Credentials removed.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Could not remove credentials."));
    }
  };

  const handleTestConnection = async (registryId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const message = await testRegistryConnection(registryId);
      setStatusMessage(message);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Connection test failed."));
    }
  };

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div>
        <h2 className="text-sm font-medium text-(--text-secondary)">Container registries</h2>
        <p className="mt-1 text-xs leading-5 text-(--text-muted)">
          Search Docker Hub and custom OCI registries from the Images page. Credentials are stored in your system
          keychain.
        </p>
      </div>

      {errorMessage ? <p className={`mt-3 rounded-md px-3 py-2 text-xs ${alertDanger}`}>{errorMessage}</p> : null}

      {statusMessage ? <p className={`mt-3 rounded-md px-3 py-2 text-xs ${alertSuccess}`}>{statusMessage}</p> : null}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-xs text-(--text-muted)">Loading registries…</p>
        ) : registries.length === 0 ? (
          <p className="text-xs text-(--text-muted)">No registries configured.</p>
        ) : (
          registries.map((registry) => (
            <div
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-(--border) bg-(--surface-elevated) px-3 py-2"
              key={registry.id}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-(--text-primary)">
                  {registry.name}
                  {registry.isBuiltin ? (
                    <span className="ml-2 text-[0.65rem] font-normal text-(--text-muted)">Built-in</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-(--text-muted)">
                  {capabilityLabels[registry.searchCapability]}
                  {registry.url ? ` · ${registry.url}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-(--text-muted)">
                  {registry.enabled ? "Enabled" : "Disabled"}
                  {" · "}
                  {registry.authenticated ? "Authenticated" : "Anonymous"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover)"
                  type="button"
                  onClick={() => handleEdit(registry)}
                >
                  Edit
                </button>
                <button
                  className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover)"
                  type="button"
                  onClick={() => void handleTestConnection(registry.id)}
                >
                  Test
                </button>
                {registry.authenticated ? (
                  <button
                    className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover)"
                    type="button"
                    onClick={() => void handleClearCredentials(registry.id)}
                  >
                    Clear auth
                  </button>
                ) : null}
                {!registry.isBuiltin ? (
                  <button
                    className={`rounded-md px-2 py-1 text-xs transition hover:opacity-90 ${statusBadgeDanger}`}
                    type="button"
                    onClick={() => void handleRemove(registry.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-(--text-muted)">
          Name
          <input
            className="rounded-md border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary)"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="My registry"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-(--text-muted)">
          Type
          <Select
            value={form.kind}
            disabled={Boolean(form.id && form.id === "docker-hub")}
            onValueChange={(kind) =>
              setForm((current) => ({
                ...current,
                kind: kind as RegistryKind,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Registry type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dockerHub">Docker Hub</SelectItem>
              <SelectItem value="ociDistribution">OCI distribution</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {form.kind === "ociDistribution" ? (
          <label className="flex flex-col gap-1 text-xs text-(--text-muted) sm:col-span-2">
            Registry URL
            <input
              className="rounded-md border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary)"
              value={form.url}
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              placeholder="https://registry.example.com"
            />
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-(--text-secondary) sm:col-span-2">
          <input
            checked={form.enabled}
            className="size-4 rounded border-(--border) accent-(--accent)"
            type="checkbox"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
          />
          Enabled for search
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm text-(--text-primary) hover:bg-(--surface-hover) disabled:opacity-60"
          disabled={isSaving || !form.name.trim()}
          type="button"
          onClick={() => void handleSaveRegistry()}
        >
          {form.id ? "Update registry" : "Add registry"}
        </button>
        {form.id ? (
          <button
            className="rounded-md border border-(--border) px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-hover)"
            type="button"
            onClick={() => setForm(emptyForm())}
          >
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="mt-6 border-t border-(--border) pt-4">
        <h3 className="text-sm font-medium text-(--text-secondary)">Registry credentials</h3>
        <p className="mt-1 text-xs text-(--text-muted)">
          Required for private registries. Use a personal access token when supported.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-(--text-muted) sm:col-span-2">
            Registry
            <Select
              value={credentialRegistryId || undefined}
              onValueChange={setCredentialRegistryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select registry…" />
              </SelectTrigger>
              <SelectContent>
                {registries.map((registry) => (
                  <SelectItem
                    key={registry.id}
                    value={registry.id}
                  >
                    {registry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-(--text-muted)">
            Username
            <input
              autoComplete="username"
              className="rounded-md border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary)"
              value={credentialUsername}
              onChange={(event) => setCredentialUsername(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-(--text-muted)">
            Password / token
            <input
              autoComplete="current-password"
              className="rounded-md border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary)"
              type="password"
              value={credentialPassword}
              onChange={(event) => setCredentialPassword(event.target.value)}
            />
          </label>
        </div>

        <button
          className="mt-3 rounded-md border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm text-(--text-primary) hover:bg-(--surface-hover) disabled:opacity-60"
          disabled={isSaving}
          type="button"
          onClick={() => void handleSaveCredentials()}
        >
          Save credentials
        </button>
      </div>
    </section>
  );
}

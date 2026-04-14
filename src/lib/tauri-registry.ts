import { invoke } from "@tauri-apps/api/core";
import type {
  RegistryConfigPublic,
  RegistryCredentialInput,
  RegistryKind,
  RegistrySearchResponse,
} from "../types/registry";

export const fetchRegistries = () => invoke<RegistryConfigPublic[]>("list_registries");

export const upsertRegistry = (options: {
  id?: string;
  name: string;
  kind: RegistryKind;
  url: string;
  enabled: boolean;
}) =>
  invoke<RegistryConfigPublic[]>("upsert_registry", {
    id: options.id ?? null,
    name: options.name,
    kind: options.kind,
    url: options.url,
    enabled: options.enabled,
  });

export const removeRegistry = (registryId: string) => invoke<RegistryConfigPublic[]>("remove_registry", { registryId });

export const saveRegistryCredentials = (input: RegistryCredentialInput) =>
  invoke<void>("save_registry_credentials", { input });

export const deleteRegistryCredentials = (registryId: string) =>
  invoke<void>("delete_registry_credentials", { registryId });

export const searchRegistryImages = (query: string, registryId?: string) =>
  invoke<RegistrySearchResponse>("search_registry_images", {
    query,
    registryId: registryId ?? null,
  });

export const testRegistryConnection = (registryId: string) =>
  invoke<string>("test_registry_connection", { registryId });

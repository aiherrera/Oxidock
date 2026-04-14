export type RegistryKind = "dockerHub" | "ociDistribution";

export type RegistrySearchCapability = "fullTextSearch" | "catalogFilter" | "unsupported";

export type RegistryConfigPublic = {
  id: string;
  name: string;
  kind: RegistryKind;
  url: string;
  enabled: boolean;
  isBuiltin: boolean;
  authenticated: boolean;
  searchCapability: RegistrySearchCapability;
};

export type RegistryCredentialInput = {
  registryId: string;
  username: string;
  password: string;
};

export type RegistrySearchResult = {
  registryId: string;
  registryName: string;
  name: string;
  pullReference: string;
  description: string | null;
  starCount: number | null;
  isOfficial: boolean;
};

export type RegistrySearchResponse = {
  results: RegistrySearchResult[];
  message: string | null;
};

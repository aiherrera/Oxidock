use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const REGISTRY_CONFIG_FILE: &str = "registries.json";
const KEYRING_SERVICE: &str = "com.aiherrera.oxidock.registries";
const DOCKER_HUB_REGISTRY_ID: &str = "docker-hub";
const DOCKER_HUB_SEARCH_URL: &str = "https://hub.docker.com/v2/search/repositories/";
const HTTP_TIMEOUT_SECS: u64 = 20;
const MAX_SEARCH_RESULTS: usize = 50;
const MAX_CATALOG_REPOS: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RegistryKind {
    DockerHub,
    OciDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RegistrySearchCapability {
    FullTextSearch,
    CatalogFilter,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryConfig {
    pub id: String,
    pub name: String,
    pub kind: RegistryKind,
    /// Registry API base URL (OCI). Empty for built-in Docker Hub.
    pub url: String,
    pub enabled: bool,
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryConfigPublic {
    pub id: String,
    pub name: String,
    pub kind: RegistryKind,
    pub url: String,
    pub enabled: bool,
    pub is_builtin: bool,
    pub authenticated: bool,
    pub search_capability: RegistrySearchCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryCredentialInput {
    pub registry_id: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySearchResult {
    pub registry_id: String,
    pub registry_name: String,
    pub name: String,
    pub pull_reference: String,
    pub description: Option<String>,
    pub star_count: Option<u64>,
    pub is_official: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySearchResponse {
    pub results: Vec<RegistrySearchResult>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryConfigFile {
    registries: Vec<RegistryConfig>,
}

fn default_docker_hub() -> RegistryConfig {
    RegistryConfig {
        id: DOCKER_HUB_REGISTRY_ID.to_string(),
        name: "Docker Hub".to_string(),
        kind: RegistryKind::DockerHub,
        url: String::new(),
        enabled: true,
        is_builtin: true,
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join(REGISTRY_CONFIG_FILE))
}

pub fn load_registry_configs(app: &AppHandle) -> Result<Vec<RegistryConfig>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(vec![default_docker_hub()]);
    }

    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let file: RegistryConfigFile =
        serde_json::from_str(&raw).map_err(|error| format!("Invalid registry config: {error}"))?;

    let mut registries = file.registries;
    if !registries
        .iter()
        .any(|registry| registry.id == DOCKER_HUB_REGISTRY_ID)
    {
        registries.insert(0, default_docker_hub());
    }

    Ok(registries)
}

fn save_registry_configs(app: &AppHandle, registries: &[RegistryConfig]) -> Result<(), String> {
    let path = config_path(app)?;
    let file = RegistryConfigFile {
        registries: registries.to_vec(),
    };
    let raw = serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

fn search_capability(kind: &RegistryKind) -> RegistrySearchCapability {
    match kind {
        RegistryKind::DockerHub => RegistrySearchCapability::FullTextSearch,
        RegistryKind::OciDistribution => RegistrySearchCapability::CatalogFilter,
    }
}

fn has_credentials(registry_id: &str) -> bool {
    keyring::Entry::new(KEYRING_SERVICE, registry_id)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .map(|password| !password.is_empty())
        .unwrap_or(false)
}

pub fn list_registries_public(app: AppHandle) -> Result<Vec<RegistryConfigPublic>, String> {
    let configs = load_registry_configs(&app)?;
    Ok(configs
        .into_iter()
        .map(|config| RegistryConfigPublic {
            authenticated: has_credentials(&config.id),
            search_capability: search_capability(&config.kind),
            id: config.id.clone(),
            name: config.name.clone(),
            kind: config.kind.clone(),
            url: config.url.clone(),
            enabled: config.enabled,
            is_builtin: config.is_builtin,
        })
        .collect())
}

pub fn upsert_registry(
    app: AppHandle,
    id: Option<String>,
    name: String,
    kind: RegistryKind,
    url: String,
    enabled: bool,
) -> Result<Vec<RegistryConfigPublic>, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Registry name is required.".to_string());
    }

    if matches!(kind, RegistryKind::OciDistribution) {
        validate_oci_url(&url)?;
    }

    let mut registries = load_registry_configs(&app)?;
    let registry_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    if let Some(existing) = registries.iter_mut().find(|r| r.id == registry_id) {
        if existing.is_builtin {
            existing.enabled = enabled;
            existing.name = name.to_string();
        } else {
            existing.name = name.to_string();
            existing.kind = kind;
            existing.url = normalize_oci_url(&url);
            existing.enabled = enabled;
        }
    } else {
        registries.push(RegistryConfig {
            id: registry_id,
            name: name.to_string(),
            kind,
            url: normalize_oci_url(&url),
            enabled,
            is_builtin: false,
        });
    }

    save_registry_configs(&app, &registries)?;
    list_registries_public(app)
}

pub fn remove_registry(
    app: AppHandle,
    registry_id: String,
) -> Result<Vec<RegistryConfigPublic>, String> {
    if registry_id == DOCKER_HUB_REGISTRY_ID {
        return Err("Docker Hub cannot be removed.".to_string());
    }

    let mut registries = load_registry_configs(&app)?;
    registries.retain(|registry| registry.id != registry_id);
    let _ = delete_registry_credentials(&registry_id);
    save_registry_configs(&app, &registries)?;
    list_registries_public(app)
}

pub fn save_registry_credentials(
    app: AppHandle,
    input: RegistryCredentialInput,
) -> Result<(), String> {
    let registry_id = input.registry_id.trim();
    if registry_id.is_empty() {
        return Err("Registry id is required.".to_string());
    }
    if !registry_exists(&app, registry_id)? {
        return Err("Unknown registry. Save the registry before adding credentials.".to_string());
    }

    let username = input.username.trim();
    if username.is_empty() {
        return Err("Username is required.".to_string());
    }
    if input.password.is_empty() {
        return Err("Password or token is required.".to_string());
    }

    keyring::Entry::new(KEYRING_SERVICE, registry_id)
        .map_err(|error| format!("Keyring unavailable: {error}"))?
        .set_password(&format!("{username}\n{}", input.password))
        .map_err(|error| format!("Failed to store credentials: {error}"))
}

pub fn delete_registry_credentials(registry_id: &str) -> Result<(), String> {
    keyring::Entry::new(KEYRING_SERVICE, registry_id)
        .map_err(|error| format!("Keyring unavailable: {error}"))?
        .delete_credential()
        .map_err(|error| format!("Failed to remove credentials: {error}"))
}

fn read_credential_pair(registry_id: &str) -> Option<(String, String)> {
    let raw = keyring::Entry::new(KEYRING_SERVICE, registry_id)
        .ok()?
        .get_password()
        .ok()?;
    let (username, password) = raw.split_once('\n')?;
    if username.is_empty() || password.is_empty() {
        return None;
    }
    Some((username.to_string(), password.to_string()))
}

fn oci_url_host(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .ok_or_else(|| "Registry URL must start with http:// or https://.".to_string())?;
    let authority = without_scheme
        .split('/')
        .next()
        .unwrap_or_default()
        .split('@')
        .next_back()
        .unwrap_or_default()
        .trim();

    let host = if let Some(start) = authority.find('[') {
        let end = authority
            .find(']')
            .ok_or_else(|| "Registry URL has an invalid IPv6 host.".to_string())?;
        authority[start + 1..end].trim()
    } else {
        match authority.rsplit_once(':') {
            Some((host, port)) if port.chars().all(|character| character.is_ascii_digit()) => host,
            _ => authority,
        }
    }
    .to_ascii_lowercase();

    if host.is_empty() {
        return Err("Registry URL is missing a host.".to_string());
    }
    Ok(host)
}

fn is_private_or_restricted_host(host: &str) -> bool {
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }
    if host == "metadata.google.internal" {
        return true;
    }

    if let Ok(addr) = host.parse::<std::net::IpAddr>() {
        return match addr {
            std::net::IpAddr::V4(v4) => {
                v4.is_loopback()
                    || v4.is_private()
                    || v4.is_link_local()
                    || v4.octets()[0] == 169 && v4.octets()[1] == 254
            }
            std::net::IpAddr::V6(v6) => {
                v6.is_loopback() || v6.is_unique_local() || v6.is_unicast_link_local()
            }
        };
    }

    false
}

fn validate_oci_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Registry URL is required for OCI registries.".to_string());
    }
    if !trimmed.starts_with("https://") {
        return Err("OCI registry URLs must use https://.".to_string());
    }

    let host = oci_url_host(trimmed)?;
    if is_private_or_restricted_host(&host) {
        return Err(
            "Registry host cannot be a private, loopback, or link-local address.".to_string(),
        );
    }

    Ok(())
}

fn registry_exists(app: &AppHandle, registry_id: &str) -> Result<bool, String> {
    Ok(load_registry_configs(app)?
        .iter()
        .any(|registry| registry.id == registry_id))
}

fn normalize_oci_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|error| error.to_string())
}

async fn search_docker_hub(query: &str) -> Result<Vec<RegistrySearchResult>, String> {
    #[derive(Deserialize)]
    struct HubSearchResponse {
        results: Vec<HubRepository>,
    }

    #[derive(Deserialize)]
    struct HubRepository {
        #[serde(rename = "repo_name")]
        repo_name: String,
        #[serde(default)]
        short_description: Option<String>,
        #[serde(default)]
        star_count: Option<u64>,
        #[serde(default)]
        is_official: Option<bool>,
    }

    let client = http_client()?;
    let response = client
        .get(DOCKER_HUB_SEARCH_URL)
        .query(&[("query", query), ("page_size", "25")])
        .send()
        .await
        .map_err(|error| format!("Docker Hub search failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Docker Hub search failed with status {}",
            response.status()
        ));
    }

    let payload: HubSearchResponse = response
        .json()
        .await
        .map_err(|error| format!("Invalid Docker Hub response: {error}"))?;

    Ok(payload
        .results
        .into_iter()
        .take(MAX_SEARCH_RESULTS)
        .map(|repo| {
            let is_official = repo.is_official.unwrap_or(false);
            RegistrySearchResult {
                registry_id: DOCKER_HUB_REGISTRY_ID.to_string(),
                registry_name: "Docker Hub".to_string(),
                name: repo.repo_name.clone(),
                pull_reference: repo.repo_name,
                description: repo.short_description,
                star_count: repo.star_count,
                is_official,
            }
        })
        .collect())
}

async fn search_oci_catalog(
    registry: &RegistryConfig,
    query: &str,
) -> Result<Vec<RegistrySearchResult>, String> {
    #[derive(Deserialize)]
    struct CatalogResponse {
        repositories: Vec<String>,
    }

    let base = normalize_oci_url(&registry.url);
    let catalog_url = format!("{base}/v2/_catalog?n={MAX_CATALOG_REPOS}");
    let client = http_client()?;
    let mut request = client.get(&catalog_url);

    if let Some((username, password)) = read_credential_pair(&registry.id) {
        request = request.basic_auth(username, Some(password));
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("Registry request failed: {error}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Registry requires authentication. Add credentials in Settings.".to_string());
    }

    if !response.status().is_success() {
        return Err(format!(
            "Registry catalog request failed with status {}",
            response.status()
        ));
    }

    let payload: CatalogResponse = response
        .json()
        .await
        .map_err(|error| format!("Invalid registry catalog response: {error}"))?;

    let needle = query.trim().to_lowercase();
    let host = base
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    Ok(payload
        .repositories
        .into_iter()
        .filter(|name| {
            if needle.is_empty() {
                return true;
            }
            name.to_lowercase().contains(&needle)
        })
        .take(MAX_SEARCH_RESULTS)
        .map(|name| {
            let pull_reference = format!("{host}/{name}");
            RegistrySearchResult {
                registry_id: registry.id.clone(),
                registry_name: registry.name.clone(),
                name: name.clone(),
                pull_reference,
                description: None,
                star_count: None,
                is_official: false,
            }
        })
        .collect())
}

pub async fn search_registries(
    app: AppHandle,
    query: String,
    registry_id: Option<String>,
) -> Result<RegistrySearchResponse, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(RegistrySearchResponse {
            results: Vec::new(),
            message: Some("Enter a search term.".to_string()),
        });
    }

    let configs = load_registry_configs(&app)?;
    let targets: Vec<RegistryConfig> = configs
        .into_iter()
        .filter(|registry| registry.enabled)
        .filter(|registry| {
            registry_id
                .as_ref()
                .map(|id| id == &registry.id)
                .unwrap_or(true)
        })
        .collect();

    if targets.is_empty() {
        return Ok(RegistrySearchResponse {
            results: Vec::new(),
            message: Some("No enabled registries match the selected filter.".to_string()),
        });
    }

    let mut results = Vec::new();
    let mut messages = Vec::new();

    for registry in targets {
        let outcome = match registry.kind {
            RegistryKind::DockerHub => search_docker_hub(trimmed).await,
            RegistryKind::OciDistribution => search_oci_catalog(&registry, trimmed).await,
        };

        match outcome {
            Ok(mut found) => results.append(&mut found),
            Err(error) => messages.push(format!("{}: {error}", registry.name)),
        }
    }

    results.truncate(MAX_SEARCH_RESULTS);

    let message = if messages.is_empty() {
        None
    } else {
        Some(messages.join(" "))
    };

    Ok(RegistrySearchResponse { results, message })
}

pub async fn test_registry_connection(
    app: AppHandle,
    registry_id: String,
) -> Result<String, String> {
    let configs = load_registry_configs(&app)?;
    let registry = configs
        .into_iter()
        .find(|item| item.id == registry_id)
        .ok_or_else(|| "Registry not found.".to_string())?;

    match registry.kind {
        RegistryKind::DockerHub => search_docker_hub("hello-world")
            .await
            .map(|_| "Docker Hub is reachable.".to_string()),
        RegistryKind::OciDistribution => {
            let mut results = search_oci_catalog(&registry, "").await?;
            if results.is_empty() {
                Ok("Connected, but catalog returned no repositories.".to_string())
            } else {
                results.truncate(1);
                Ok(format!(
                    "Connected. Example repository: {}",
                    results[0].name
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_oci_url_trims_trailing_slash() {
        assert_eq!(
            normalize_oci_url("https://registry.example.com/"),
            "https://registry.example.com"
        );
    }

    #[test]
    fn validate_oci_url_requires_https() {
        assert!(validate_oci_url("registry.example.com").is_err());
        assert!(validate_oci_url("http://registry.example.com").is_err());
        assert!(validate_oci_url("https://registry.example.com").is_ok());
    }

    #[test]
    fn validate_oci_url_blocks_private_hosts() {
        assert!(validate_oci_url("https://127.0.0.1").is_err());
        assert!(validate_oci_url("https://192.168.1.1").is_err());
        assert!(validate_oci_url("https://localhost").is_err());
        assert!(validate_oci_url("https://[::1]").is_err());
        assert!(validate_oci_url("https://[fe80::1]").is_err());
        assert!(validate_oci_url("https://[fc00::1]").is_err());
        assert!(validate_oci_url("https://169.254.169.254").is_err());
    }

    #[test]
    fn oci_url_host_parses_ipv6_brackets_and_ports() {
        assert_eq!(
            oci_url_host("https://[2001:db8::1]:5000/v2").unwrap(),
            "2001:db8::1"
        );
        assert_eq!(
            oci_url_host("https://registry.example.com:443").unwrap(),
            "registry.example.com"
        );
    }

    #[test]
    fn validate_oci_url_rejects_malformed_hosts() {
        assert!(validate_oci_url("https://").is_err());
        assert!(validate_oci_url("not-a-url").is_err());
    }

    #[test]
    fn docker_hub_is_default_builtin() {
        let hub = default_docker_hub();
        assert!(hub.is_builtin);
        assert_eq!(hub.id, DOCKER_HUB_REGISTRY_ID);
    }
}

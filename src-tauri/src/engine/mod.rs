use bollard::Docker;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Manager;

mod lifecycle;

const ENGINE_CONFIG_FILE: &str = "engine-config.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EngineProviderKind {
    DockerDesktop,
    Colima,
    OrbStack,
    RancherDesktop,
    Remote,
    Local,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EngineLifecycleAction {
    Start,
    Pause,
    Stop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineLifecycleCapability {
    pub action: EngineLifecycleAction,
    pub supported: bool,
    pub label: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineLifecycleCapabilitiesResult {
    pub capabilities: Vec<EngineLifecycleCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineLifecycleActionResult {
    pub success: bool,
    pub message: String,
    pub action: EngineLifecycleAction,
    pub engine_revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineProviderPublic {
    pub id: String,
    pub name: String,
    pub kind: EngineProviderKind,
    pub context_name: Option<String>,
    pub endpoint: String,
    pub description: String,
    pub is_default: bool,
    pub is_current: bool,
    pub reachable: bool,
    pub lifecycle_capabilities: Vec<EngineLifecycleCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveEnginePublic {
    pub id: String,
    pub name: String,
    pub kind: EngineProviderKind,
    pub context_name: Option<String>,
    pub endpoint: String,
    pub user_selected: bool,
    pub revision: u64,
    pub lifecycle_capabilities: Vec<EngineLifecycleCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSelectionInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedEngineSelection {
    pub id: String,
    pub context_name: Option<String>,
    pub endpoint: String,
    pub user_selected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EngineConfigFile {
    active: Option<SavedEngineSelection>,
}

#[derive(Debug, Clone)]
struct DiscoveredEngine {
    id: String,
    name: String,
    kind: EngineProviderKind,
    context_name: Option<String>,
    endpoint: String,
    description: String,
    is_default: bool,
    is_current: bool,
}

pub struct EngineManager {
    revision: Mutex<u64>,
}

impl Default for EngineManager {
    fn default() -> Self {
        Self {
            revision: Mutex::new(0),
        }
    }
}

impl EngineManager {
    pub fn revision(&self) -> u64 {
        self.revision.lock().map(|value| *value).unwrap_or(0)
    }

    fn bump_revision(&self) {
        if let Ok(mut revision) = self.revision.lock() {
            *revision = revision.saturating_add(1);
        }
    }

    pub fn list_providers(&self, app: &AppHandle) -> Result<Vec<EngineProviderPublic>, String> {
        let discovered = discover_engines(app)?;
        let active = self.resolve_active(app, &discovered)?;

        Ok(discovered
            .into_iter()
            .map(|engine| {
                let reachable = test_endpoint_reachable(&engine.endpoint);
                EngineProviderPublic {
                    id: engine.id.clone(),
                    name: engine.name.clone(),
                    kind: engine.kind,
                    context_name: engine.context_name.clone(),
                    endpoint: engine.endpoint.clone(),
                    description: engine.description.clone(),
                    is_default: engine.is_default,
                    is_current: engine.id == active.id,
                    reachable,
                    lifecycle_capabilities: lifecycle::lifecycle_capabilities_for_kind(engine.kind),
                }
            })
            .collect())
    }

    pub fn get_active(&self, app: &AppHandle) -> Result<ActiveEnginePublic, String> {
        let discovered = discover_engines(app)?;
        let saved = load_active_selection(app)?;
        let active = self.resolve_active(app, &discovered)?;
        let user_selected = saved
            .as_ref()
            .map(|selection| selection.user_selected)
            .unwrap_or(false);
        Ok(active_engine_public(
            &active,
            user_selected,
            self.revision(),
            lifecycle::lifecycle_capabilities_for_kind(active.kind),
        ))
    }

    pub fn set_active(
        &self,
        app: &AppHandle,
        selection: EngineSelectionInput,
    ) -> Result<ActiveEnginePublic, String> {
        let discovered = discover_engines(app)?;
        let selected = discovered
            .into_iter()
            .find(|engine| engine.id == selection.id)
            .ok_or_else(|| format!("Engine provider '{}' was not found.", selection.id))?;

        let saved = SavedEngineSelection {
            id: selected.id.clone(),
            context_name: selected.context_name.clone(),
            endpoint: selected.endpoint.clone(),
            user_selected: true,
        };
        save_active_selection(app, &saved)?;
        self.bump_revision();
        Ok(active_engine_public(
            &selected,
            true,
            self.revision(),
            lifecycle::lifecycle_capabilities_for_kind(selected.kind),
        ))
    }

    pub fn get_lifecycle_capabilities(
        &self,
        app: &AppHandle,
        selection: Option<EngineSelectionInput>,
    ) -> Result<EngineLifecycleCapabilitiesResult, String> {
        let engine = self.resolve_lifecycle_engine(app, selection)?;
        Ok(EngineLifecycleCapabilitiesResult {
            capabilities: lifecycle::lifecycle_capabilities_for_kind(engine.kind),
        })
    }

    pub async fn run_lifecycle_action(
        &self,
        app: &AppHandle,
        selection: Option<EngineSelectionInput>,
        action: EngineLifecycleAction,
    ) -> Result<EngineLifecycleActionResult, String> {
        let engine = self.resolve_lifecycle_engine(app, selection)?;
        let capabilities = lifecycle::lifecycle_capabilities_for_kind(engine.kind);
        let supported = capabilities
            .iter()
            .any(|capability| capability.action == action && capability.supported);

        if !supported {
            let reason = capabilities
                .iter()
                .find(|capability| capability.action == action)
                .and_then(|capability| capability.reason.clone())
                .unwrap_or_else(|| {
                    format!(
                        "{} is not supported for {}.",
                        lifecycle::action_label(action),
                        engine.name
                    )
                });
            return Err(reason);
        }

        let command = lifecycle::build_lifecycle_command(engine.kind, action)?;
        let command_message = lifecycle::execute_lifecycle_command(&command).await?;
        let message = match action {
            EngineLifecycleAction::Start => {
                match wait_for_engine_started(&engine, Duration::from_secs(90)).await {
                    EngineStartWaitResult::Started => {
                        format!("{} is running.", engine.name)
                    }
                    EngineStartWaitResult::Paused(message) => {
                        return Err(message);
                    }
                    EngineStartWaitResult::TimedOut => {
                        format!(
                        "{command_message} {} is still starting; status will update when it becomes reachable.",
                        engine.name
                    )
                    }
                }
            }
            EngineLifecycleAction::Stop | EngineLifecycleAction::Pause => {
                if wait_for_engine_unreachable(&engine, Duration::from_secs(30)).await {
                    format!("{} is no longer reachable.", engine.name)
                } else {
                    command_message
                }
            }
        };
        self.bump_revision();

        Ok(EngineLifecycleActionResult {
            success: true,
            message,
            action,
            engine_revision: self.revision(),
        })
    }

    fn resolve_lifecycle_engine(
        &self,
        app: &AppHandle,
        selection: Option<EngineSelectionInput>,
    ) -> Result<DiscoveredEngine, String> {
        let discovered = discover_engines(app)?;
        if let Some(selection) = selection {
            return discovered
                .into_iter()
                .find(|engine| engine.id == selection.id)
                .ok_or_else(|| format!("Engine provider '{}' was not found.", selection.id));
        }
        self.resolve_active(app, &discovered)
    }

    pub async fn test_connection(
        &self,
        app: &AppHandle,
        selection: Option<EngineSelectionInput>,
    ) -> Result<EngineConnectionTestResult, String> {
        let discovered = discover_engines(app)?;
        let engine = if let Some(selection) = selection {
            discovered
                .into_iter()
                .find(|engine| engine.id == selection.id)
                .ok_or_else(|| format!("Engine provider '{}' was not found.", selection.id))?
        } else {
            self.resolve_active(app, &discovered)?
        };

        match connect_from_engine(&engine) {
            Ok(client) => match client.version().await {
                Ok(version) => Ok(EngineConnectionTestResult {
                    success: true,
                    message: "Connection successful.".to_string(),
                    server_version: version.version,
                }),
                Err(error) => Ok(EngineConnectionTestResult {
                    success: false,
                    message: format!("Docker API version check failed: {error}"),
                    server_version: None,
                }),
            },
            Err(error) => Ok(EngineConnectionTestResult {
                success: false,
                message: error,
                server_version: None,
            }),
        }
    }

    pub fn connect(&self, app: &AppHandle) -> Result<Docker, String> {
        let discovered = discover_engines(app)?;
        let active = self.resolve_active(app, &discovered)?;
        connect_from_engine(&active)
    }

    pub fn apply_cli_env(
        &self,
        app: &AppHandle,
        command: &mut tokio::process::Command,
    ) -> Result<(), String> {
        let discovered = discover_engines(app)?;
        let active = self.resolve_active(app, &discovered)?;

        if let Some(context_name) = &active.context_name {
            command.arg("--context").arg(context_name);
            return Ok(());
        }

        if !active.endpoint.is_empty() {
            command.env("DOCKER_HOST", &active.endpoint);
        }

        Ok(())
    }

    fn resolve_active(
        &self,
        app: &AppHandle,
        discovered: &[DiscoveredEngine],
    ) -> Result<DiscoveredEngine, String> {
        if discovered.is_empty() {
            return Ok(fallback_local_engine());
        }

        if let Some(saved) = load_active_selection(app)? {
            if let Some(engine) = discovered.iter().find(|engine| engine.id == saved.id) {
                return Ok(engine.clone());
            }
        }

        discovered
            .iter()
            .find(|engine| engine.is_current)
            .or_else(|| discovered.iter().find(|engine| engine.is_default))
            .or_else(|| discovered.first())
            .cloned()
            .ok_or_else(|| "No Docker engine providers were discovered.".to_string())
    }
}

fn active_engine_public(
    engine: &DiscoveredEngine,
    user_selected: bool,
    revision: u64,
    lifecycle_capabilities: Vec<EngineLifecycleCapability>,
) -> ActiveEnginePublic {
    ActiveEnginePublic {
        id: engine.id.clone(),
        name: engine.name.clone(),
        kind: engine.kind,
        context_name: engine.context_name.clone(),
        endpoint: engine.endpoint.clone(),
        user_selected,
        revision,
        lifecycle_capabilities,
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join(ENGINE_CONFIG_FILE))
}

fn load_active_selection(app: &AppHandle) -> Result<Option<SavedEngineSelection>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let file: EngineConfigFile =
        serde_json::from_str(&raw).map_err(|error| format!("Invalid engine config: {error}"))?;
    Ok(file.active)
}

fn save_active_selection(app: &AppHandle, selection: &SavedEngineSelection) -> Result<(), String> {
    let path = config_path(app)?;
    let file = EngineConfigFile {
        active: Some(selection.clone()),
    };
    let raw = serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

fn discover_engines(app: &AppHandle) -> Result<Vec<DiscoveredEngine>, String> {
    let mut engines = discover_from_docker_contexts()?;
    append_known_socket_providers(app, &mut engines);
    dedupe_engines(&mut engines);
    Ok(engines)
}

fn discover_from_docker_contexts() -> Result<Vec<DiscoveredEngine>, String> {
    let output = std::process::Command::new("docker")
        .args([
            "context",
            "ls",
            "--format",
            "{{.Name}}\t{{.Current}}\t{{.Description}}\t{{.DockerEndpoint}}",
        ])
        .output();

    let output = match output {
        Ok(output) if output.status.success() => output,
        _ => {
            return Ok(vec![]);
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut engines = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 4 {
            continue;
        }

        let mut name = parts[0].trim().to_string();
        let is_current = parts[1].trim() == "true" || name.ends_with('*');
        if name.ends_with('*') {
            name = name.trim_end_matches('*').trim().to_string();
        }

        let description = parts[2].trim().to_string();
        let endpoint = parts[3].trim().to_string();
        if endpoint.is_empty() {
            continue;
        }

        let kind = infer_kind(&name, &description, &endpoint);
        let display_name = provider_display_name(kind, &name, &description);

        engines.push(DiscoveredEngine {
            id: engine_id(&name, &endpoint),
            name: display_name,
            kind,
            context_name: Some(name.clone()),
            endpoint,
            description,
            is_default: name == "default",
            is_current,
        });
    }

    Ok(engines)
}

fn append_known_socket_providers(app: &AppHandle, engines: &mut Vec<DiscoveredEngine>) {
    let home = app.path().home_dir().ok();

    let Some(home) = home else {
        return;
    };

    let candidates = [
        (
            "colima-default",
            "Colima",
            EngineProviderKind::Colima,
            home.join(".colima/default/docker.sock"),
            Some("colima"),
            "Colima default VM",
        ),
        (
            "orbstack-socket",
            "OrbStack",
            EngineProviderKind::OrbStack,
            home.join(".orbstack/run/docker.sock"),
            Some("orbstack"),
            "OrbStack socket",
        ),
        (
            "docker-desktop-socket",
            "Docker Desktop",
            EngineProviderKind::DockerDesktop,
            home.join(".docker/run/docker.sock"),
            Some("desktop-linux"),
            "Docker Desktop socket",
        ),
        (
            "rancher-desktop-socket",
            "Rancher Desktop",
            EngineProviderKind::RancherDesktop,
            home.join(".rd/docker.sock"),
            Some("rancher-desktop"),
            "Rancher Desktop socket",
        ),
    ];

    for (id_suffix, name, kind, socket_path, context_name, description) in candidates {
        if !socket_path.exists() {
            continue;
        }

        let endpoint = format!("unix://{}", socket_path.display());
        let context = context_name.map(str::to_string);
        let id = engine_id(context.as_deref().unwrap_or(id_suffix), &endpoint);

        engines.push(DiscoveredEngine {
            id,
            name: name.to_string(),
            kind,
            context_name: context,
            endpoint,
            description: description.to_string(),
            is_default: false,
            is_current: false,
        });
    }
}

fn dedupe_engines(engines: &mut Vec<DiscoveredEngine>) {
    let mut seen = HashMap::new();
    engines.retain(|engine| {
        let key = if let Some(context) = &engine.context_name {
            format!("ctx:{context}")
        } else {
            format!("ep:{}", engine.endpoint)
        };

        match seen.entry(key) {
            Entry::Vacant(entry) => {
                entry.insert(());
                true
            }
            Entry::Occupied(_) => false,
        }
    });

    engines.sort_by(|left, right| {
        right
            .is_current
            .cmp(&left.is_current)
            .then_with(|| left.name.cmp(&right.name))
    });
}

fn infer_kind(name: &str, description: &str, endpoint: &str) -> EngineProviderKind {
    let haystack = format!("{name} {description} {endpoint}").to_lowercase();

    if haystack.contains("colima") {
        return EngineProviderKind::Colima;
    }
    if haystack.contains("orbstack") || haystack.contains("orb stack") {
        return EngineProviderKind::OrbStack;
    }
    if haystack.contains("rancher") {
        return EngineProviderKind::RancherDesktop;
    }
    if haystack.contains("docker desktop") || haystack.contains("desktop-linux") {
        return EngineProviderKind::DockerDesktop;
    }

    if endpoint.starts_with("unix://") {
        if haystack.contains(".docker/run/docker.sock") {
            return EngineProviderKind::DockerDesktop;
        }
        if haystack.contains(".colima/") {
            return EngineProviderKind::Colima;
        }
        if haystack.contains(".orbstack/") {
            return EngineProviderKind::OrbStack;
        }
        if haystack.contains(".rd/") {
            return EngineProviderKind::RancherDesktop;
        }
        return EngineProviderKind::Local;
    }

    if endpoint.starts_with("tcp://")
        || endpoint.starts_with("http://")
        || endpoint.starts_with("https://")
        || endpoint.starts_with("ssh://")
    {
        return EngineProviderKind::Remote;
    }

    EngineProviderKind::Unknown
}

fn provider_display_name(
    kind: EngineProviderKind,
    context_name: &str,
    description: &str,
) -> String {
    match kind {
        EngineProviderKind::DockerDesktop => "Docker Desktop".to_string(),
        EngineProviderKind::Colima => "Colima".to_string(),
        EngineProviderKind::OrbStack => "OrbStack".to_string(),
        EngineProviderKind::RancherDesktop => "Rancher Desktop".to_string(),
        EngineProviderKind::Remote => format!("Remote ({context_name})"),
        EngineProviderKind::Local => {
            if description.is_empty() {
                format!("Local ({context_name})")
            } else {
                description.to_string()
            }
        }
        EngineProviderKind::Unknown => {
            if description.is_empty() {
                context_name.to_string()
            } else {
                description.to_string()
            }
        }
    }
}

fn engine_id(context_or_key: &str, endpoint: &str) -> String {
    format!("{context_or_key}::{endpoint}")
}

fn fallback_local_engine() -> DiscoveredEngine {
    DiscoveredEngine {
        id: "default::local".to_string(),
        name: "Local Docker".to_string(),
        kind: EngineProviderKind::Local,
        context_name: Some("default".to_string()),
        endpoint: "unix:///var/run/docker.sock".to_string(),
        description: "Default local Docker socket".to_string(),
        is_default: true,
        is_current: true,
    }
}

fn connect_from_engine(engine: &DiscoveredEngine) -> Result<Docker, String> {
    connect_from_endpoint(&engine.endpoint)
}

async fn wait_for_engine_started(
    engine: &DiscoveredEngine,
    timeout: Duration,
) -> EngineStartWaitResult {
    let deadline = tokio::time::Instant::now() + timeout;

    loop {
        match engine_version_state(engine).await {
            EngineVersionState::Reachable => return EngineStartWaitResult::Started,
            EngineVersionState::Paused(message) => return EngineStartWaitResult::Paused(message),
            EngineVersionState::Unavailable => {}
        }

        if tokio::time::Instant::now() >= deadline {
            return EngineStartWaitResult::TimedOut;
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn wait_for_engine_unreachable(engine: &DiscoveredEngine, timeout: Duration) -> bool {
    let deadline = tokio::time::Instant::now() + timeout;

    loop {
        if !engine_version_reachable(engine).await {
            return true;
        }

        if tokio::time::Instant::now() >= deadline {
            return false;
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn engine_version_reachable(engine: &DiscoveredEngine) -> bool {
    matches!(
        engine_version_state(engine).await,
        EngineVersionState::Reachable
    )
}

async fn engine_version_state(engine: &DiscoveredEngine) -> EngineVersionState {
    match connect_from_engine(engine) {
        Ok(client) => match client.version().await {
            Ok(_) => EngineVersionState::Reachable,
            Err(error) => {
                let message = error.to_string();
                if message.to_lowercase().contains("paused") {
                    EngineVersionState::Paused(
                        "Docker Desktop is paused. Unpause it from Docker Desktop, then Oxidock will reconnect.".to_string(),
                    )
                } else {
                    EngineVersionState::Unavailable
                }
            }
        },
        Err(_) => EngineVersionState::Unavailable,
    }
}

enum EngineStartWaitResult {
    Started,
    Paused(String),
    TimedOut,
}

enum EngineVersionState {
    Reachable,
    Paused(String),
    Unavailable,
}

fn connect_from_endpoint(endpoint: &str) -> Result<Docker, String> {
    if let Some(path) = endpoint.strip_prefix("unix://") {
        return Docker::connect_with_socket(path, 120, bollard::API_DEFAULT_VERSION)
            .map_err(|error| format!("Failed to connect to {endpoint}: {error}"));
    }

    if endpoint.starts_with("tcp://")
        || endpoint.starts_with("http://")
        || endpoint.starts_with("https://")
    {
        return Docker::connect_with_http(endpoint, 120, bollard::API_DEFAULT_VERSION)
            .map_err(|error| format!("Failed to connect to {endpoint}: {error}"));
    }

    Docker::connect_with_local_defaults().map_err(|error| error.to_string())
}

fn test_endpoint_reachable(endpoint: &str) -> bool {
    if let Some(path) = endpoint.strip_prefix("unix://") {
        return Path::new(path).exists();
    }

    connect_from_endpoint(endpoint).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infers_colima_from_context_name() {
        assert_eq!(
            infer_kind(
                "colima",
                "colima",
                "unix:///Users/me/.colima/default/docker.sock"
            ),
            EngineProviderKind::Colima
        );
    }

    #[test]
    fn infers_remote_from_tcp_endpoint() {
        assert_eq!(
            infer_kind("prod", "production cluster", "tcp://127.0.0.1:2375"),
            EngineProviderKind::Remote
        );
    }

    #[test]
    fn parses_context_ls_line() {
        let line =
            "desktop-linux *\ttrue\tDocker Desktop\tunix:///Users/me/.docker/run/docker.sock";
        let parts: Vec<&str> = line.split('\t').collect();
        assert_eq!(parts.len(), 4);
        let mut name = parts[0].to_string();
        let is_current = name.ends_with('*');
        if is_current {
            name = name.trim_end_matches('*').trim().to_string();
        }
        assert_eq!(name, "desktop-linux");
        assert!(is_current);
    }
}

use bollard::container::LogOutput;
use bollard::models::ContainerStatsResponse;
use bollard::query_parameters::{
    EventsOptionsBuilder, InspectContainerOptions, ListContainersOptions, ListImagesOptions,
    ListNetworksOptions, ListVolumesOptions, LogsOptions, RemoveContainerOptions,
    RestartContainerOptions, StartContainerOptions, StatsOptions, StopContainerOptions,
};
use bollard::Docker;
use chrono::{TimeZone, Utc};
use futures_util::stream::{self, StreamExt};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;
use tokio::time::timeout;

use crate::command_safety::assert_command_execution_allowed;
use crate::engine::{EngineLifecycleAction, EngineLifecycleCapability, EngineManager};

const SHORT_ID_LEN: usize = 12;
const MAX_TEXT_LEN: usize = 240;
const MAX_LOG_BYTES: usize = 64 * 1024;
const MAX_CLI_OUTPUT_BYTES: usize = 256 * 1024;
const MAX_EVENTS: usize = 100;
const EVENTS_COLLECT_TIMEOUT_MS: u64 = 2000;
const EVENTS_SINCE_SECONDS: i64 = 86_400;
const COMPOSE_PROJECT_LABEL: &str = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL: &str = "com.docker.compose.service";
const STATS_FETCH_CONCURRENCY: usize = 8;

mod format;

use format::{
    clean_container_name, clean_text, format_bytes, format_created_timestamp, format_inspect_ports,
    format_last_started, format_port_summaries, format_stats_with_previous, label_value, short_id,
    short_id_from_full,
};

#[derive(Default)]
pub struct DockerState {
    previous_stats: Mutex<HashMap<String, ContainerStatsResponse>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerStatus {
    pub is_running: bool,
    pub engine_state: EngineState,
    pub message: String,
    pub server_version: Option<String>,
    pub api_version: Option<String>,
    pub provider_id: Option<String>,
    pub provider_name: String,
    pub context_name: Option<String>,
    pub endpoint_label: String,
    pub lifecycle_capabilities: Vec<EngineLifecycleCapability>,
}

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum EngineState {
    Running,
    Paused,
    Stopped,
    Unavailable,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    pub id: String,
    pub short_id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<String>,
    pub created_at: String,
    pub project: Option<String>,
    pub service: Option<String>,
    pub command: String,
    pub last_started_at: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ContainerStatsInfo {
    pub id: String,
    pub cpu_percent: String,
    pub memory_usage: String,
    pub memory_percent: String,
    pub disk_read_write: String,
    pub network_io: String,
    pub pids: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInspectDetail {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub created_at: String,
    pub ports: Vec<String>,
    pub networks: Vec<String>,
    pub mounts: Vec<String>,
    pub command: String,
    pub raw_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerLogsResult {
    pub logs: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    pub id: String,
    pub short_id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created_at: String,
    pub containers: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub scope: String,
    pub labels: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub id: String,
    pub short_id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub attachable: bool,
    pub internal: bool,
    pub container_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerEventInfo {
    pub time: String,
    pub typ: String,
    pub action: String,
    pub actor_id: String,
    pub actor_name: String,
    pub attributes: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerCommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl DockerState {
    pub fn clear_stats_cache(&self) {
        if let Ok(mut cache) = self.previous_stats.lock() {
            cache.clear();
        }
    }

    pub async fn status(&self, app: &AppHandle, engine: &EngineManager) -> DockerStatus {
        let active = engine.get_active(app).ok();
        let provider_name = active
            .as_ref()
            .map(|engine| engine.name.clone())
            .unwrap_or_else(|| "Docker".to_string());
        let provider_id = active.as_ref().map(|engine| engine.id.clone());
        let context_name = active
            .as_ref()
            .and_then(|engine| engine.context_name.clone());
        let endpoint_label = endpoint_label_from_active(active.as_ref());
        let lifecycle_capabilities = active
            .as_ref()
            .map(|engine| engine.lifecycle_capabilities.clone())
            .unwrap_or_default();

        let docker = match self.client(app, engine) {
            Ok(docker) => docker,
            Err(message) => {
                let engine_state =
                    infer_unreachable_engine_state(&message, &lifecycle_capabilities);
                return DockerStatus {
                    is_running: false,
                    engine_state,
                    message,
                    server_version: None,
                    api_version: None,
                    provider_id,
                    provider_name,
                    context_name,
                    endpoint_label,
                    lifecycle_capabilities,
                };
            }
        };

        match docker.version().await {
            Ok(version) => DockerStatus {
                is_running: true,
                engine_state: EngineState::Running,
                message: format!("{provider_name} is reachable."),
                server_version: version.version.map(clean_text),
                api_version: version.api_version.map(clean_text),
                provider_id,
                provider_name,
                context_name,
                endpoint_label,
                lifecycle_capabilities,
            },
            Err(error) => {
                let message = clean_error(error);
                let engine_state =
                    infer_unreachable_engine_state(&message, &lifecycle_capabilities);
                DockerStatus {
                    is_running: false,
                    engine_state,
                    message,
                    server_version: None,
                    api_version: None,
                    provider_id,
                    provider_name,
                    context_name,
                    endpoint_label,
                    lifecycle_capabilities,
                }
            }
        }
    }

    pub async fn containers(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        all: bool,
    ) -> Result<Vec<ContainerInfo>, String> {
        let docker = self.client(app, engine)?;
        let options = ListContainersOptions {
            all,
            ..Default::default()
        };

        docker
            .list_containers(Some(options))
            .await
            .map_err(clean_error)
            .map(|containers| {
                containers
                    .into_iter()
                    .map(|container| {
                        let id = clean_text(container.id.unwrap_or_default());
                        let labels = container.labels.unwrap_or_default();
                        let status = clean_text(container.status.unwrap_or_default());
                        ContainerInfo {
                            short_id: short_id(&id),
                            id,
                            name: clean_container_name(container.names),
                            image: clean_text(
                                container.image.unwrap_or_else(|| "unknown".to_string()),
                            ),
                            state: container
                                .state
                                .map(|state| clean_text(state.to_string()))
                                .filter(|state| !state.is_empty())
                                .unwrap_or_else(|| "unknown".to_string()),
                            status: status.clone(),
                            ports: format_port_summaries(container.ports),
                            created_at: format_created_timestamp(container.created),
                            project: label_value(&labels, COMPOSE_PROJECT_LABEL),
                            service: label_value(&labels, COMPOSE_SERVICE_LABEL),
                            command: clean_text(
                                container.command.unwrap_or_else(|| "—".to_string()),
                            ),
                            last_started_at: format_last_started(&status),
                        }
                    })
                    .collect()
            })
    }

    pub async fn inspect_container(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
    ) -> Result<ContainerInspectDetail, String> {
        let docker = self.client(app, engine)?;
        let options = InspectContainerOptions { size: false };

        let inspect = docker
            .inspect_container(id, Some(options))
            .await
            .map_err(clean_error)?;

        let raw_json = serde_json::to_string_pretty(&inspect).map_err(|error| error.to_string())?;

        let id = inspect
            .id
            .as_deref()
            .map(short_id_from_full)
            .unwrap_or_else(|| short_id(id));

        let name = inspect
            .name
            .as_deref()
            .map(|name| clean_text(name.trim_start_matches('/').to_string()))
            .unwrap_or_else(|| "unnamed".to_string());

        let image = inspect
            .config
            .as_ref()
            .and_then(|config| config.image.clone())
            .map(clean_text)
            .unwrap_or_else(|| "unknown".to_string());

        let state = inspect
            .state
            .as_ref()
            .and_then(|state| state.status.as_ref())
            .map(|status| clean_text(format!("{status:?}").to_lowercase()))
            .unwrap_or_else(|| "unknown".to_string());

        let status = inspect
            .state
            .as_ref()
            .and_then(|state| state.status.as_ref())
            .map(|status| format!("{status:?}"))
            .unwrap_or_else(|| "unknown".to_string());

        let created_at = inspect
            .created
            .as_deref()
            .map(|value| clean_text(value.to_string()))
            .unwrap_or_else(|| "—".to_string());

        let ports = inspect
            .network_settings
            .as_ref()
            .and_then(|settings| settings.ports.clone())
            .map(|ports| format_inspect_ports(&ports))
            .unwrap_or_default();

        let networks = inspect
            .network_settings
            .as_ref()
            .and_then(|settings| settings.networks.clone())
            .map(|networks| {
                networks
                    .keys()
                    .map(|name| clean_text(name.clone()))
                    .collect()
            })
            .unwrap_or_default();

        let mounts = inspect
            .mounts
            .clone()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|mount| {
                mount.source.map(|source| {
                    let destination = mount
                        .destination
                        .clone()
                        .unwrap_or_else(|| "unknown".to_string());
                    clean_text(format!("{source} → {destination}"))
                })
            })
            .collect();

        let command = inspect
            .config
            .as_ref()
            .and_then(|config| config.cmd.clone())
            .map(|cmd| cmd.join(" "))
            .filter(|cmd| !cmd.is_empty())
            .or_else(|| {
                inspect
                    .config
                    .as_ref()
                    .and_then(|config| config.entrypoint.clone())
                    .map(|entry| entry.join(" "))
            })
            .map(clean_text)
            .unwrap_or_else(|| "—".to_string());

        Ok(ContainerInspectDetail {
            id,
            name,
            image,
            state: state.clone(),
            status,
            created_at,
            ports,
            networks,
            mounts,
            command,
            raw_json,
        })
    }

    pub async fn container_logs(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
    ) -> Result<ContainerLogsResult, String> {
        let docker = self.client(app, engine)?;
        let options = LogsOptions {
            stdout: true,
            stderr: true,
            tail: "200".to_string(),
            ..Default::default()
        };

        let mut stream = docker.logs(id, Some(options));
        let mut logs = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(clean_error)?;
            let line = log_output_to_string(chunk);
            logs.push_str(&line);
            if logs.len() >= MAX_LOG_BYTES {
                logs.truncate(MAX_LOG_BYTES);
                break;
            }
        }

        Ok(ContainerLogsResult { logs })
    }

    pub async fn start_container(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
    ) -> Result<(), String> {
        let docker = self.client(app, engine)?;
        docker
            .start_container(id, None::<StartContainerOptions>)
            .await
            .map_err(clean_error)
    }

    pub async fn stop_container(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
    ) -> Result<(), String> {
        let docker = self.client(app, engine)?;
        docker
            .stop_container(id, None::<StopContainerOptions>)
            .await
            .map_err(clean_error)
    }

    pub async fn restart_container(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
    ) -> Result<(), String> {
        let docker = self.client(app, engine)?;
        docker
            .restart_container(id, None::<RestartContainerOptions>)
            .await
            .map_err(clean_error)
    }

    pub async fn remove_container(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        id: &str,
        force: bool,
    ) -> Result<(), String> {
        let docker = self.client(app, engine)?;
        docker
            .remove_container(
                id,
                Some(RemoveContainerOptions {
                    force,
                    ..Default::default()
                }),
            )
            .await
            .map_err(clean_error)
    }

    pub async fn container_stats(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        ids: Vec<String>,
    ) -> Result<Vec<ContainerStatsInfo>, String> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let docker = self.client(app, engine)?;
        let options = StatsOptions {
            stream: false,
            one_shot: true,
        };

        let previous_snapshot = self
            .previous_stats
            .lock()
            .map_err(|_| "Failed to lock stats cache.".to_string())?
            .clone();

        let fetched = stream::iter(ids)
            .map(|id| {
                let docker = docker.clone();
                let options = options.clone();
                let previous = previous_snapshot.get(&id).cloned();
                async move {
                    let mut stats_stream = docker.stats(&id, Some(options));
                    let stats = match stats_stream.next().await {
                        Some(Ok(stats)) => Some(stats),
                        _ => None,
                    };
                    (id, stats, previous)
                }
            })
            .buffer_unordered(STATS_FETCH_CONCURRENCY)
            .collect::<Vec<_>>()
            .await;

        let mut results = Vec::with_capacity(fetched.len());
        let mut previous_stats = self
            .previous_stats
            .lock()
            .map_err(|_| "Failed to lock stats cache.".to_string())?;

        for (id, stats, previous) in fetched {
            if let Some(stats) = stats {
                results.push(format_stats_with_previous(
                    &id,
                    stats.clone(),
                    previous.as_ref(),
                ));
                previous_stats.insert(id, stats);
            } else {
                results.push(ContainerStatsInfo {
                    id: id.clone(),
                    ..Default::default()
                });
            }
        }

        Ok(results)
    }

    pub async fn images(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
    ) -> Result<Vec<ImageInfo>, String> {
        let docker = self.client(app, engine)?;
        let options = ListImagesOptions {
            all: true,
            ..Default::default()
        };

        docker
            .list_images(Some(options))
            .await
            .map_err(clean_error)
            .map(|images| images.into_iter().map(map_image).collect())
    }

    pub async fn volumes(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
    ) -> Result<Vec<VolumeInfo>, String> {
        let docker = self.client(app, engine)?;
        let response = docker
            .list_volumes(None::<ListVolumesOptions>)
            .await
            .map_err(clean_error)?;

        Ok(response
            .volumes
            .unwrap_or_default()
            .into_iter()
            .map(map_volume)
            .collect())
    }

    pub async fn networks(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
    ) -> Result<Vec<NetworkInfo>, String> {
        let docker = self.client(app, engine)?;
        let networks = docker
            .list_networks(None::<ListNetworksOptions>)
            .await
            .map_err(clean_error)?;

        Ok(networks.into_iter().map(map_network).collect())
    }

    pub async fn events(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
    ) -> Result<Vec<DockerEventInfo>, String> {
        let docker = self.client(app, engine)?;
        let since = (Utc::now().timestamp() - EVENTS_SINCE_SECONDS).to_string();
        let options = EventsOptionsBuilder::default().since(&since).build();

        let mut stream = docker.events(Some(options));
        let mut collected = Vec::new();

        let collect = async {
            while let Some(item) = stream.next().await {
                match item {
                    Ok(event) => {
                        collected.push(map_event(event));
                        if collected.len() >= MAX_EVENTS {
                            break;
                        }
                    }
                    Err(error) => return Err(clean_error(error)),
                }
            }
            Ok(())
        };

        let _ = timeout(Duration::from_millis(EVENTS_COLLECT_TIMEOUT_MS), collect).await;

        collected.sort_by(|left, right| right.time.cmp(&left.time));
        collected.truncate(MAX_EVENTS);
        Ok(collected)
    }

    pub async fn run_docker_command(
        &self,
        app: &AppHandle,
        engine: &EngineManager,
        command: String,
        confirm_destructive: bool,
    ) -> Result<DockerCommandResult, String> {
        let normalized = assert_command_execution_allowed(&command, confirm_destructive)?;

        let mut args =
            shell_words::split(&normalized).map_err(|error| format!("Invalid command: {error}"))?;

        if args.is_empty() {
            return Err("Command cannot be empty.".to_string());
        }

        if args
            .first()
            .is_some_and(|token| token.eq_ignore_ascii_case("docker"))
        {
            args.remove(0);
        }

        if args.is_empty() {
            return Err("Provide a docker subcommand.".to_string());
        }

        let mut command_builder = tokio::process::Command::new("docker");
        engine.apply_cli_env(app, &mut command_builder)?;
        let output = command_builder
            .args(&args)
            .output()
            .await
            .map_err(|error| format!("Failed to run docker: {error}"))?;

        Ok(DockerCommandResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: truncate_output(String::from_utf8_lossy(&output.stdout).into_owned()),
            stderr: truncate_output(String::from_utf8_lossy(&output.stderr).into_owned()),
        })
    }

    fn client(&self, app: &AppHandle, engine: &EngineManager) -> Result<Docker, String> {
        engine.connect(app)
    }
}

fn endpoint_label_from_active(active: Option<&crate::engine::ActiveEnginePublic>) -> String {
    let Some(active) = active else {
        return "Default".to_string();
    };

    if let Some(context_name) = &active.context_name {
        return context_name.clone();
    }

    if let Some(path) = active.endpoint.strip_prefix("unix://") {
        return path.to_string();
    }

    active.endpoint.clone()
}

fn infer_unreachable_engine_state(
    message: &str,
    capabilities: &[EngineLifecycleCapability],
) -> EngineState {
    let message = message.to_lowercase();
    if message.contains("paused")
        || message.contains("pause")
        || message.contains("suspended")
        || message.contains("suspend")
    {
        return EngineState::Paused;
    }

    if capabilities
        .iter()
        .any(|capability| capability.action == EngineLifecycleAction::Start && capability.supported)
    {
        return EngineState::Stopped;
    }

    EngineState::Unavailable
}

fn map_image(image: bollard::models::ImageSummary) -> ImageInfo {
    let id = clean_text(image.id);
    let (repository, tag) = parse_repo_tag(image.repo_tags.first());

    ImageInfo {
        short_id: short_id(&id),
        id,
        repository,
        tag,
        size: format_bytes(image.size.max(0) as u64),
        created_at: format_created_timestamp(Some(image.created)),
        containers: image.containers,
    }
}

fn map_volume(volume: bollard::models::Volume) -> VolumeInfo {
    VolumeInfo {
        name: clean_text(volume.name),
        driver: clean_text(volume.driver),
        mountpoint: clean_text(volume.mountpoint),
        scope: volume
            .scope
            .map(|value| clean_text(format!("{value:?}").to_lowercase()))
            .unwrap_or_else(|| "local".to_string()),
        labels: volume.labels,
    }
}

fn map_network(network: bollard::models::Network) -> NetworkInfo {
    let id = network.id.clone().unwrap_or_default();
    let name = network
        .name
        .clone()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unnamed".to_string());

    NetworkInfo {
        short_id: short_id(&id),
        id: id.clone(),
        name: clean_text(name),
        driver: network
            .driver
            .clone()
            .map(clean_text)
            .unwrap_or_else(|| "—".to_string()),
        scope: network
            .scope
            .clone()
            .map(clean_text)
            .unwrap_or_else(|| "local".to_string()),
        attachable: network.attachable.unwrap_or(false),
        internal: network.internal.unwrap_or(false),
        container_count: 0,
    }
}

fn map_event(event: bollard::models::EventMessage) -> DockerEventInfo {
    let typ = event
        .typ
        .map(|value| clean_text(format!("{value:?}").to_lowercase()))
        .unwrap_or_else(|| "unknown".to_string());

    let action = event
        .action
        .map(clean_text)
        .unwrap_or_else(|| "—".to_string());

    let actor = event.actor.unwrap_or_default();
    let attributes = actor.attributes.unwrap_or_default();
    let actor_name = attributes
        .get("name")
        .cloned()
        .or_else(|| attributes.get("image").cloned())
        .map(clean_text)
        .unwrap_or_else(|| "—".to_string());

    let actor_id = actor
        .id
        .map(|value| short_id(&clean_text(value)))
        .unwrap_or_else(|| "—".to_string());

    let time = event
        .time
        .and_then(|timestamp| Utc.timestamp_opt(timestamp, 0).single())
        .map(|datetime| datetime.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| "—".to_string());

    DockerEventInfo {
        time,
        typ,
        action,
        actor_id,
        actor_name,
        attributes,
    }
}

fn parse_repo_tag(repo_tag: Option<&String>) -> (String, String) {
    let value = repo_tag.map(String::as_str).unwrap_or("<none>");
    if value == "<none>:<none>" || value == "<none>" {
        return ("<none>".to_string(), "latest".to_string());
    }

    if let Some((repository, tag)) = value.rsplit_once(':') {
        return (
            clean_text(repository.to_string()),
            clean_text(tag.to_string()),
        );
    }

    (clean_text(value.to_string()), "latest".to_string())
}

fn truncate_output(value: String) -> String {
    if value.len() <= MAX_CLI_OUTPUT_BYTES {
        return value;
    }

    let mut truncated = value;
    truncated.truncate(MAX_CLI_OUTPUT_BYTES);
    truncated.push_str("\n… output truncated …");
    truncated
}

fn log_output_to_string(output: LogOutput) -> String {
    format!("{output}")
}

fn clean_error(error: bollard::errors::Error) -> String {
    let message = clean_text(error.to_string());

    if message.is_empty() {
        "Docker is unavailable.".to_string()
    } else {
        message
    }
}

#[cfg(test)]
mod tests {
    use super::{
        clean_container_name, clean_text, format_bytes, format_created_timestamp,
        format_last_started, format_port_summaries, short_id,
    };
    use bollard::models::PortSummary;

    #[test]
    fn strips_leading_slash_from_container_name() {
        let name = clean_container_name(Some(vec!["/oxidock-demo".to_string()]));

        assert_eq!(name, "oxidock-demo");
    }

    #[test]
    fn falls_back_for_missing_container_name() {
        let name = clean_container_name(None);

        assert_eq!(name, "unnamed");
    }

    #[test]
    fn shortens_container_id_to_twelve_characters() {
        let id = short_id("1234567890abcdef");

        assert_eq!(id, "1234567890ab");
    }

    #[test]
    fn removes_control_characters_from_docker_text() {
        let value = clean_text("safe\ntext\u{0000}".to_string());

        assert_eq!(value, "safetext");
    }

    #[test]
    fn formats_port_mappings() {
        let ports = format_port_summaries(Some(vec![PortSummary {
            ip: Some("0.0.0.0".to_string()),
            private_port: 3000,
            public_port: Some(3000),
            typ: None,
        }]));

        assert_eq!(ports, vec!["3000:3000"]);
    }

    #[test]
    fn formats_created_timestamp() {
        let created = format_created_timestamp(Some(1_715_500_000));

        assert!(!created.is_empty());
        assert_ne!(created, "—");
    }

    #[test]
    fn formats_last_started_from_up_status() {
        let value = format_last_started("Up 18 minutes (healthy)");

        assert_eq!(value, "18 minutes ago");
    }

    #[test]
    fn formats_last_started_from_exited_status() {
        let value = format_last_started("Exited (0) 2 weeks ago");

        assert_eq!(value, "2 weeks ago");
    }

    #[test]
    fn formats_bytes_for_display() {
        assert_eq!(format_bytes(0), "0B");
        assert_eq!(format_bytes(1536), "1.50KB");
    }
}

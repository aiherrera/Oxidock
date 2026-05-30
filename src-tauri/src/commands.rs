use tauri::{AppHandle, State};

use crate::ai::{
    ask_app_insights_assistant as ask_app_insights_assistant_impl,
    get_ai_assistant_status as get_ai_assistant_status_impl,
    install_ai_assistant as install_ai_assistant_impl,
    remove_ai_assistant as remove_ai_assistant_impl,
    suggest_docker_commands as suggest_docker_commands_impl, AiAssistantStatus,
    AppInsightsResponse, AskAppInsightsParams, SuggestDockerCommandsResponse,
};
use crate::app_metrics::{
    get_app_resource_usage as get_app_resource_usage_impl, AppMetricsState, AppResourceUsage,
};
use crate::command_safety::{
    classify_docker_command as classify_docker_command_impl, CommandClassification,
};
use crate::docker::{
    ContainerInfo, ContainerInspectDetail, ContainerLogsResult, ContainerStatsInfo,
    DockerCommandResult, DockerEventInfo, DockerState, DockerStatus, ImageInfo, NetworkInfo,
    VolumeInfo,
};
use crate::docker_watch::DockerWatchState;
use crate::engine::{
    ActiveEnginePublic, EngineConnectionTestResult, EngineLifecycleAction,
    EngineLifecycleActionResult, EngineLifecycleCapabilitiesResult, EngineManager,
    EngineProviderPublic, EngineSelectionInput,
};
use crate::registry::{
    delete_registry_credentials as delete_registry_credentials_impl, list_registries_public,
    remove_registry as remove_registry_impl,
    save_registry_credentials as save_registry_credentials_impl, search_registries,
    test_registry_connection as test_registry_connection_impl,
    upsert_registry as upsert_registry_impl, RegistryConfigPublic, RegistryCredentialInput,
    RegistryKind, RegistrySearchResponse,
};
use std::sync::Arc;

#[tauri::command]
pub fn get_app_resource_usage(
    app: AppHandle,
    state: State<'_, AppMetricsState>,
) -> Result<AppResourceUsage, String> {
    get_app_resource_usage_impl(&app, &state)
}

#[tauri::command]
pub async fn get_docker_status(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
) -> Result<DockerStatus, String> {
    Ok(state.status(&app, &engine).await)
}

#[tauri::command]
pub async fn get_containers(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    all: bool,
) -> Result<Vec<ContainerInfo>, String> {
    state.containers(&app, &engine, all).await
}

#[tauri::command]
pub async fn inspect_container(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
) -> Result<ContainerInspectDetail, String> {
    state.inspect_container(&app, &engine, &id).await
}

#[tauri::command]
pub async fn get_container_logs(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
) -> Result<ContainerLogsResult, String> {
    state.container_logs(&app, &engine, &id).await
}

#[tauri::command]
pub async fn start_container(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
) -> Result<(), String> {
    state.start_container(&app, &engine, &id).await
}

#[tauri::command]
pub async fn stop_container(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
) -> Result<(), String> {
    state.stop_container(&app, &engine, &id).await
}

#[tauri::command]
pub async fn restart_container(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
) -> Result<(), String> {
    state.restart_container(&app, &engine, &id).await
}

#[tauri::command]
pub async fn remove_container(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
    force: Option<bool>,
) -> Result<(), String> {
    state
        .remove_container(&app, &engine, &id, force.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn remove_image(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
    force: Option<bool>,
) -> Result<(), String> {
    state
        .remove_image(&app, &engine, &id, force.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn remove_volume(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    name: String,
    force: Option<bool>,
) -> Result<(), String> {
    state
        .remove_volume(&app, &engine, &name, force.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn remove_network(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    id: String,
    force: Option<bool>,
) -> Result<(), String> {
    state
        .remove_network(&app, &engine, &id, force.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn get_container_stats(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    ids: Vec<String>,
) -> Result<Vec<ContainerStatsInfo>, String> {
    state.container_stats(&app, &engine, ids).await
}

#[tauri::command]
pub async fn get_images(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
) -> Result<Vec<ImageInfo>, String> {
    state.images(&app, &engine).await
}

#[tauri::command]
pub async fn get_volumes(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
) -> Result<Vec<VolumeInfo>, String> {
    state.volumes(&app, &engine).await
}

#[tauri::command]
pub async fn get_networks(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
) -> Result<Vec<NetworkInfo>, String> {
    state.networks(&app, &engine).await
}

#[tauri::command]
pub async fn get_docker_events(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
) -> Result<Vec<DockerEventInfo>, String> {
    state.events(&app, &engine).await
}

#[tauri::command]
pub async fn run_docker_command(
    app: AppHandle,
    state: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    command: String,
    confirm_destructive: Option<bool>,
) -> Result<DockerCommandResult, String> {
    state
        .run_docker_command(&app, &engine, command, confirm_destructive.unwrap_or(false))
        .await
}

#[tauri::command]
pub fn classify_docker_command(command: String) -> Result<CommandClassification, String> {
    classify_docker_command_impl(&command)
}

#[tauri::command]
pub fn list_engine_providers(
    app: AppHandle,
    engine: State<'_, EngineManager>,
) -> Result<Vec<EngineProviderPublic>, String> {
    engine.list_providers(&app)
}

#[tauri::command]
pub fn get_active_engine(
    app: AppHandle,
    engine: State<'_, EngineManager>,
) -> Result<ActiveEnginePublic, String> {
    engine.get_active(&app)
}

#[tauri::command]
pub fn set_active_engine(
    app: AppHandle,
    docker: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    watch: State<'_, Arc<DockerWatchState>>,
    selection: EngineSelectionInput,
) -> Result<ActiveEnginePublic, String> {
    let active = engine.set_active(&app, selection)?;
    docker.clear_stats_cache();
    watch.restart();
    Ok(active)
}

#[tauri::command]
pub async fn test_engine_connection(
    app: AppHandle,
    engine: State<'_, EngineManager>,
    selection: Option<EngineSelectionInput>,
) -> Result<EngineConnectionTestResult, String> {
    engine.test_connection(&app, selection).await
}

#[tauri::command]
pub fn get_engine_lifecycle_capabilities(
    app: AppHandle,
    engine: State<'_, EngineManager>,
    selection: Option<EngineSelectionInput>,
) -> Result<EngineLifecycleCapabilitiesResult, String> {
    engine.get_lifecycle_capabilities(&app, selection)
}

#[tauri::command]
pub async fn run_engine_lifecycle_action(
    app: AppHandle,
    docker: State<'_, DockerState>,
    engine: State<'_, EngineManager>,
    watch: State<'_, Arc<DockerWatchState>>,
    selection: Option<EngineSelectionInput>,
    action: EngineLifecycleAction,
) -> Result<EngineLifecycleActionResult, String> {
    let result = engine.run_lifecycle_action(&app, selection, action).await?;
    docker.clear_stats_cache();
    watch.restart();
    Ok(result)
}

#[tauri::command]
pub async fn get_ai_assistant_status(app: AppHandle) -> Result<AiAssistantStatus, String> {
    get_ai_assistant_status_impl(app)
}

#[tauri::command]
pub async fn install_ai_assistant(app: AppHandle) -> Result<AiAssistantStatus, String> {
    install_ai_assistant_impl(app).await
}

#[tauri::command]
pub async fn remove_ai_assistant(app: AppHandle) -> Result<AiAssistantStatus, String> {
    remove_ai_assistant_impl(app).await
}

#[tauri::command]
pub async fn suggest_docker_commands(
    app: AppHandle,
    input: String,
) -> Result<SuggestDockerCommandsResponse, String> {
    suggest_docker_commands_impl(app, input).await
}

#[tauri::command]
pub async fn ask_app_insights_assistant(
    app: AppHandle,
    params: AskAppInsightsParams,
) -> Result<AppInsightsResponse, String> {
    ask_app_insights_assistant_impl(app, params).await
}

#[tauri::command]
pub fn list_registries(app: AppHandle) -> Result<Vec<RegistryConfigPublic>, String> {
    list_registries_public(app)
}

#[tauri::command]
pub fn upsert_registry(
    app: AppHandle,
    id: Option<String>,
    name: String,
    kind: RegistryKind,
    url: String,
    enabled: bool,
) -> Result<Vec<RegistryConfigPublic>, String> {
    upsert_registry_impl(app, id, name, kind, url, enabled)
}

#[tauri::command]
pub fn remove_registry(
    app: AppHandle,
    registry_id: String,
) -> Result<Vec<RegistryConfigPublic>, String> {
    remove_registry_impl(app, registry_id)
}

#[tauri::command]
pub fn save_registry_credentials(
    app: AppHandle,
    input: RegistryCredentialInput,
) -> Result<(), String> {
    save_registry_credentials_impl(app, input)
}

#[tauri::command]
pub fn delete_registry_credentials(registry_id: String) -> Result<(), String> {
    delete_registry_credentials_impl(&registry_id)
}

#[tauri::command]
pub async fn search_registry_images(
    app: AppHandle,
    query: String,
    registry_id: Option<String>,
) -> Result<RegistrySearchResponse, String> {
    search_registries(app, query, registry_id).await
}

#[tauri::command]
pub async fn test_registry_connection(
    app: AppHandle,
    registry_id: String,
) -> Result<String, String> {
    test_registry_connection_impl(app, registry_id).await
}

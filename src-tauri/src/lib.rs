mod ai;
mod app_metrics;
mod command_safety;
mod commands;
mod docker;
mod docker_watch;
mod engine;
mod menu;
mod registry;

use ai::AiAssistantInstallRuntime;
use app_metrics::AppMetricsState;
use commands::{
    ask_app_insights_assistant, classify_docker_command, delete_registry_credentials,
    get_active_engine, get_ai_assistant_status, get_app_resource_usage, get_container_logs,
    get_container_stats, get_containers, get_docker_events, get_docker_status,
    get_engine_lifecycle_capabilities, get_images, get_networks, get_volumes, inspect_container,
    install_ai_assistant, list_engine_providers, list_registries, remove_ai_assistant,
    remove_container, remove_image, remove_network, remove_registry, remove_volume,
    restart_container, run_docker_command, run_engine_lifecycle_action, save_registry_credentials,
    search_registry_images, set_active_engine, start_container, stop_container,
    suggest_docker_commands, test_engine_connection, test_registry_connection, upsert_registry,
};
use docker::DockerState;
use docker_watch::DockerWatchState;
use engine::EngineManager;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppMetricsState::default())
        .manage(Arc::new(AiAssistantInstallRuntime::default()))
        .manage(DockerState::default())
        .manage(EngineManager::default())
        .manage(Arc::new(DockerWatchState::default()))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            menu::setup_menu(app)?;
            app.state::<Arc<DockerWatchState>>()
                .start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_resource_usage,
            get_docker_status,
            get_containers,
            get_container_stats,
            inspect_container,
            get_container_logs,
            start_container,
            stop_container,
            restart_container,
            remove_container,
            remove_image,
            remove_volume,
            remove_network,
            get_images,
            get_volumes,
            get_networks,
            get_docker_events,
            run_docker_command,
            classify_docker_command,
            get_ai_assistant_status,
            install_ai_assistant,
            remove_ai_assistant,
            suggest_docker_commands,
            ask_app_insights_assistant,
            list_registries,
            upsert_registry,
            remove_registry,
            save_registry_credentials,
            delete_registry_credentials,
            search_registry_images,
            test_registry_connection,
            list_engine_providers,
            get_active_engine,
            set_active_engine,
            test_engine_connection,
            get_engine_lifecycle_capabilities,
            run_engine_lifecycle_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

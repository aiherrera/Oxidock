use bollard::query_parameters::EventsOptionsBuilder;
use bollard::Docker;
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::engine::EngineManager;

pub const DOCKER_CHANGED_EVENT: &str = "docker-changed";
pub const SCOPE_CONTAINERS: &str = "containers";
pub const SCOPE_STATUS: &str = "status";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerChangedPayload {
    pub scope: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EngineAvailability {
    Unknown,
    Available,
    Unavailable,
}

pub struct DockerWatchState {
    generation: AtomicU64,
    availability: Mutex<EngineAvailability>,
}

impl Default for DockerWatchState {
    fn default() -> Self {
        Self {
            generation: AtomicU64::new(0),
            availability: Mutex::new(EngineAvailability::Unknown),
        }
    }
}

impl DockerWatchState {
    pub fn restart(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut availability) = self.availability.lock() {
            *availability = EngineAvailability::Unknown;
        }
    }

    fn generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    pub fn start(self: &Arc<Self>, app: AppHandle) {
        let state = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            watch_loop(app, state).await;
        });
    }

    fn emit_status_if_changed(&self, app: &AppHandle, next: EngineAvailability) {
        let should_emit = {
            let mut current = self
                .availability
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());

            match availability_transition(*current, next) {
                Some(updated) => {
                    *current = updated;
                    true
                }
                None => false,
            }
        };

        if should_emit {
            let _ = app.emit(
                DOCKER_CHANGED_EVENT,
                DockerChangedPayload {
                    scope: SCOPE_STATUS.to_string(),
                },
            );
        }
    }
}

fn availability_transition(
    current: EngineAvailability,
    next: EngineAvailability,
) -> Option<EngineAvailability> {
    if current == next || next == EngineAvailability::Unknown {
        return None;
    }

    Some(next)
}

async fn watch_loop(app: AppHandle, state: Arc<DockerWatchState>) {
    loop {
        let generation = state.generation();
        let engine = app.state::<EngineManager>();
        let docker = match engine.connect(&app) {
            Ok(client) => client,
            Err(_) => {
                state.emit_status_if_changed(&app, EngineAvailability::Unavailable);
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }
        };

        state.emit_status_if_changed(&app, EngineAvailability::Available);

        if !stream_container_events(&app, &state, generation, docker).await {
            state.emit_status_if_changed(&app, EngineAvailability::Unavailable);
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
}

async fn stream_container_events(
    app: &AppHandle,
    state: &DockerWatchState,
    generation: u64,
    docker: Docker,
) -> bool {
    let mut filters = HashMap::new();
    filters.insert("type", vec!["container"]);

    let options = EventsOptionsBuilder::default().filters(&filters).build();

    let mut stream = docker.events(Some(options));

    while let Some(item) = stream.next().await {
        if state.generation() != generation {
            return false;
        }

        match item {
            Ok(event) => {
                if is_container_change_event(&event) {
                    let _ = app.emit(
                        DOCKER_CHANGED_EVENT,
                        DockerChangedPayload {
                            scope: SCOPE_CONTAINERS.to_string(),
                        },
                    );
                }
            }
            Err(_) => return false,
        }
    }

    false
}

fn is_container_change_event(event: &bollard::models::EventMessage) -> bool {
    let is_container = event
        .typ
        .as_ref()
        .map(|typ| format!("{typ:?}").to_lowercase().contains("container"))
        .unwrap_or(false);

    if !is_container {
        return false;
    }

    let action = event.action.as_deref().unwrap_or_default().to_lowercase();

    matches!(
        action.as_str(),
        "create"
            | "destroy"
            | "start"
            | "stop"
            | "die"
            | "kill"
            | "pause"
            | "unpause"
            | "rename"
            | "update"
            | "attach"
            | "detach"
            | "restart"
            | "remove"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_container_start_events() {
        let event = bollard::models::EventMessage {
            typ: Some(bollard::models::EventMessageTypeEnum::CONTAINER),
            action: Some("start".to_string()),
            ..Default::default()
        };

        assert!(is_container_change_event(&event));
    }

    #[test]
    fn ignores_non_container_events() {
        let event = bollard::models::EventMessage {
            typ: Some(bollard::models::EventMessageTypeEnum::IMAGE),
            action: Some("pull".to_string()),
            ..Default::default()
        };

        assert!(!is_container_change_event(&event));
    }

    #[test]
    fn emits_on_first_unavailable_transition() {
        assert_eq!(
            availability_transition(EngineAvailability::Unknown, EngineAvailability::Unavailable),
            Some(EngineAvailability::Unavailable)
        );
        assert_eq!(
            availability_transition(
                EngineAvailability::Available,
                EngineAvailability::Unavailable
            ),
            Some(EngineAvailability::Unavailable)
        );
    }

    #[test]
    fn suppresses_repeated_unavailable_transitions() {
        assert_eq!(
            availability_transition(
                EngineAvailability::Unavailable,
                EngineAvailability::Unavailable
            ),
            None
        );
    }

    #[test]
    fn emits_on_recovery_transition() {
        assert_eq!(
            availability_transition(
                EngineAvailability::Unavailable,
                EngineAvailability::Available
            ),
            Some(EngineAvailability::Available)
        );
    }

    #[test]
    fn suppresses_repeated_available_transitions() {
        assert_eq!(
            availability_transition(EngineAvailability::Available, EngineAvailability::Available),
            None
        );
    }
}

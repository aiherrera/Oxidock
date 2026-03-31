use super::{EngineLifecycleAction, EngineLifecycleCapability, EngineProviderKind};
use std::process::Stdio;
use std::time::Duration;
use tokio::time::timeout;

const LIFECYCLE_TIMEOUT_SECS: u64 = 120;

pub fn lifecycle_capabilities_for_kind(kind: EngineProviderKind) -> Vec<EngineLifecycleCapability> {
    match kind {
        EngineProviderKind::DockerDesktop => vec![
            capability(EngineLifecycleAction::Start, true, "Start", None),
            capability(
                EngineLifecycleAction::Pause,
                false,
                "Pause",
                Some("Docker Desktop does not expose a reliable engine pause command."),
            ),
            capability(EngineLifecycleAction::Stop, true, "Stop", None),
        ],
        EngineProviderKind::Colima => vec![
            capability(EngineLifecycleAction::Start, true, "Start", None),
            capability(
                EngineLifecycleAction::Pause,
                false,
                "Pause",
                Some("Colima does not expose a supported engine pause command in Oxidock."),
            ),
            capability(EngineLifecycleAction::Stop, true, "Stop", None),
        ],
        EngineProviderKind::OrbStack => vec![
            capability(
                EngineLifecycleAction::Start,
                command_exists("orb"),
                "Start",
                unsupported_reason("orb", "OrbStack CLI (orb) was not found on PATH."),
            ),
            capability(
                EngineLifecycleAction::Pause,
                false,
                "Pause",
                Some("OrbStack does not expose a supported engine pause command in Oxidock."),
            ),
            capability(
                EngineLifecycleAction::Stop,
                command_exists("orb"),
                "Stop",
                unsupported_reason("orb", "OrbStack CLI (orb) was not found on PATH."),
            ),
        ],
        EngineProviderKind::RancherDesktop => vec![
            capability(EngineLifecycleAction::Start, true, "Start", None),
            capability(
                EngineLifecycleAction::Pause,
                false,
                "Pause",
                Some("Rancher Desktop does not expose a reliable engine pause command."),
            ),
            capability(EngineLifecycleAction::Stop, true, "Stop", None),
        ],
        EngineProviderKind::Remote | EngineProviderKind::Local | EngineProviderKind::Unknown => {
            unsupported_all("Lifecycle controls are only available for local engine providers.")
        }
    }
}

fn capability(
    action: EngineLifecycleAction,
    supported: bool,
    label: &str,
    reason: Option<&str>,
) -> EngineLifecycleCapability {
    EngineLifecycleCapability {
        action,
        supported,
        label: label.to_string(),
        reason: reason.map(str::to_string),
    }
}

fn unsupported_all(reason: &str) -> Vec<EngineLifecycleCapability> {
    vec![
        capability(EngineLifecycleAction::Start, false, "Start", Some(reason)),
        capability(EngineLifecycleAction::Pause, false, "Pause", Some(reason)),
        capability(EngineLifecycleAction::Stop, false, "Stop", Some(reason)),
    ]
}

fn unsupported_reason(binary: &str, message: &'static str) -> Option<&'static str> {
    if command_exists(binary) {
        None
    } else {
        Some(message)
    }
}

fn command_exists(binary: &str) -> bool {
    std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {binary}"))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub(crate) struct LifecycleCommand {
    pub program: &'static str,
    pub args: Vec<String>,
}

pub fn build_lifecycle_command(
    kind: EngineProviderKind,
    action: EngineLifecycleAction,
) -> Result<LifecycleCommand, String> {
    match (kind, action) {
        (EngineProviderKind::DockerDesktop, EngineLifecycleAction::Start) => Ok(LifecycleCommand {
            program: "docker",
            args: vec![
                "desktop".to_string(),
                "start".to_string(),
                "--timeout".to_string(),
                "90".to_string(),
            ],
        }),
        (EngineProviderKind::DockerDesktop, EngineLifecycleAction::Stop) => Ok(LifecycleCommand {
            program: "docker",
            args: vec![
                "desktop".to_string(),
                "stop".to_string(),
                "--timeout".to_string(),
                "60".to_string(),
            ],
        }),
        (EngineProviderKind::Colima, EngineLifecycleAction::Start) => Ok(LifecycleCommand {
            program: "colima",
            args: vec!["start".to_string()],
        }),
        (EngineProviderKind::Colima, EngineLifecycleAction::Stop) => Ok(LifecycleCommand {
            program: "colima",
            args: vec!["stop".to_string()],
        }),
        (EngineProviderKind::OrbStack, EngineLifecycleAction::Start) => Ok(LifecycleCommand {
            program: "orb",
            args: vec!["start".to_string()],
        }),
        (EngineProviderKind::OrbStack, EngineLifecycleAction::Stop) => Ok(LifecycleCommand {
            program: "orb",
            args: vec!["stop".to_string()],
        }),
        (EngineProviderKind::RancherDesktop, EngineLifecycleAction::Start) => {
            #[cfg(target_os = "macos")]
            {
                Ok(LifecycleCommand {
                    program: "open",
                    args: vec!["-a".to_string(), "Rancher Desktop".to_string()],
                })
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err("Starting Rancher Desktop is only supported on macOS.".to_string())
            }
        }
        (EngineProviderKind::RancherDesktop, EngineLifecycleAction::Stop) => {
            #[cfg(target_os = "macos")]
            {
                Ok(LifecycleCommand {
                    program: "osascript",
                    args: vec!["-e".to_string(), "quit app \"Rancher Desktop\"".to_string()],
                })
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err("Stopping Rancher Desktop is only supported on macOS.".to_string())
            }
        }
        (_, EngineLifecycleAction::Pause) => {
            Err("Pause is not supported for this engine provider.".to_string())
        }
        _ => Err(format!(
            "Lifecycle action {action:?} is not supported for this provider."
        )),
    }
}

pub async fn execute_lifecycle_command(command: &LifecycleCommand) -> Result<String, String> {
    let args: Vec<&str> = command.args.iter().map(String::as_str).collect();
    let future = tokio::process::Command::new(command.program)
        .args(&args)
        .output();

    let output = timeout(Duration::from_secs(LIFECYCLE_TIMEOUT_SECS), future)
        .await
        .map_err(|_| format!("Timed out running {}.", command.program))?
        .map_err(|error| format!("Failed to run {}: {error}", command.program))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return Ok(format!("{} completed successfully.", command.program));
        }
        return Ok(stdout);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("exit code {}", output.status.code().unwrap_or(-1))
    };

    Err(format!("{} failed: {detail}", command.program))
}

pub fn action_label(action: EngineLifecycleAction) -> &'static str {
    match action {
        EngineLifecycleAction::Start => "Start",
        EngineLifecycleAction::Pause => "Pause",
        EngineLifecycleAction::Stop => "Stop",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_providers_have_no_lifecycle_support() {
        let caps = lifecycle_capabilities_for_kind(EngineProviderKind::Remote);
        assert!(caps.iter().all(|cap| !cap.supported));
    }

    #[test]
    fn docker_desktop_supports_start_and_stop() {
        let caps = lifecycle_capabilities_for_kind(EngineProviderKind::DockerDesktop);
        assert!(is_supported(&caps, EngineLifecycleAction::Start));
        assert!(is_supported(&caps, EngineLifecycleAction::Stop));
        assert!(!is_supported(&caps, EngineLifecycleAction::Pause));
    }

    #[test]
    fn colima_builds_start_command() {
        let command =
            build_lifecycle_command(EngineProviderKind::Colima, EngineLifecycleAction::Start)
                .expect("colima start command");
        assert_eq!(command.program, "colima");
        assert_eq!(command.args, vec!["start"]);
    }

    #[test]
    fn orbstack_builds_stop_command_when_available() {
        if !command_exists("orb") {
            return;
        }

        let command =
            build_lifecycle_command(EngineProviderKind::OrbStack, EngineLifecycleAction::Stop)
                .expect("orb stop command");
        assert_eq!(command.program, "orb");
        assert_eq!(command.args, vec!["stop"]);
    }

    fn is_supported(caps: &[EngineLifecycleCapability], action: EngineLifecycleAction) -> bool {
        caps.iter().any(|cap| cap.action == action && cap.supported)
    }
}

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AiAssistantInstallState {
    #[serde(rename = "notInstalled")]
    NotInstalled,
    #[serde(rename = "installing")]
    Installing,
    #[serde(rename = "installed")]
    Installed,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiInstallProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAssistantStatus {
    pub state: AiAssistantInstallState,
    pub model_name: String,
    pub model_size_label: String,
    pub message: Option<String>,
    pub progress: Option<AiInstallProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AiCommandRisk {
    #[serde(rename = "safe")]
    Safe,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "destructive")]
    Destructive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AiSuggestionSource {
    #[serde(rename = "ai")]
    Ai,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommandSuggestion {
    pub id: String,
    pub label: String,
    pub completion: String,
    pub explanation: String,
    pub risk: AiCommandRisk,
    pub confidence: f32,
    pub source: AiSuggestionSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestDockerCommandsResponse {
    pub suggestions: Vec<AiCommandSuggestion>,
}

const AI_MODELS_DIR_RELATIVE: &str = "ai/models";
const MODEL_METADATA_FILE_NAME: &str = "assistant-model.json";
const MODEL_TEMP_FILE_NAME: &str = "assistant.gguf.part";

pub const AI_ASSISTANT_INSTALL_STATUS_EVENT: &str = "ai-assistant-install-status";

struct AiModelManifest {
    display_name: &'static str,
    size_label: &'static str,
    file_name: &'static str,
    download_url: &'static str,
    expected_sha256: Option<&'static str>,
}

/// Small instruct/coder GGUF for local desktop inference (swap by updating this manifest).
const ASSISTANT_MODEL: AiModelManifest = AiModelManifest {
    display_name: "oxidock-assist",
    size_label: "~200 MB",
    file_name: "assistant.gguf",
    download_url: "https://huggingface.co/bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-0.5B-Instruct-Q4_K_M.gguf",
    // SHA256 of bartowski/Qwen2.5-Coder-0.5B-Instruct-Q4_K_M.gguf (see Hugging Face model card).
    expected_sha256: Some("d618e5e4976bf4ccd36a2523678784d9fc18fcce6b3eaff589767f9b01a3142b"),
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelMetadata {
    pub model_sha256: String,
    pub file_size_bytes: u64,
}

struct AiModelPaths {
    model_file: PathBuf,
    metadata_file: PathBuf,
}

fn resolve_ai_model_paths(app: &AppHandle) -> Result<AiModelPaths, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    let model_dir = app_data.join(AI_MODELS_DIR_RELATIVE);
    let model_file = model_dir.join(ASSISTANT_MODEL.file_name);
    let metadata_file = model_dir.join(MODEL_METADATA_FILE_NAME);

    Ok(AiModelPaths {
        model_file,
        metadata_file,
    })
}

fn read_model_metadata(paths: &AiModelPaths) -> Option<AiModelMetadata> {
    let raw = fs::read_to_string(&paths.metadata_file).ok()?;
    serde_json::from_str::<AiModelMetadata>(&raw).ok()
}

pub fn get_ai_assistant_status(app: AppHandle) -> Result<AiAssistantStatus, String> {
    let paths = resolve_ai_model_paths(&app)?;
    let metadata = read_model_metadata(&paths);

    if let Some(metadata) = metadata {
        if let Ok(file_metadata) = fs::metadata(&paths.model_file) {
            if file_metadata.len() == metadata.file_size_bytes {
                if let Some(expected) = ASSISTANT_MODEL.expected_sha256 {
                    if expected != metadata.model_sha256 {
                        return Ok(AiAssistantStatus {
                            state: AiAssistantInstallState::NotInstalled,
                            model_name: ASSISTANT_MODEL.display_name.to_string(),
                            model_size_label: ASSISTANT_MODEL.size_label.to_string(),
                            message: Some("Installed model checksum does not match.".to_string()),
                            progress: None,
                        });
                    }
                }

                return Ok(AiAssistantStatus {
                    state: AiAssistantInstallState::Installed,
                    model_name: ASSISTANT_MODEL.display_name.to_string(),
                    model_size_label: ASSISTANT_MODEL.size_label.to_string(),
                    message: Some("Local assistant model is installed.".to_string()),
                    progress: None,
                });
            }
        }
    }

    Ok(AiAssistantStatus {
        state: AiAssistantInstallState::NotInstalled,
        model_name: ASSISTANT_MODEL.display_name.to_string(),
        model_size_label: ASSISTANT_MODEL.size_label.to_string(),
        message: None,
        progress: None,
    })
}

fn get_progress_defaults(_paths: &AiModelPaths, total_bytes: Option<u64>) -> AiInstallProgress {
    AiInstallProgress {
        downloaded_bytes: 0,
        total_bytes,
        percent: None,
    }
}

fn compute_percent(downloaded_bytes: u64, total_bytes: Option<u64>) -> Option<f32> {
    let total = total_bytes?;
    if total == 0 {
        return None;
    }
    Some(((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0) as f32)
}

fn installing_status(message: &str, progress: Option<AiInstallProgress>) -> AiAssistantStatus {
    AiAssistantStatus {
        state: AiAssistantInstallState::Installing,
        model_name: ASSISTANT_MODEL.display_name.to_string(),
        model_size_label: ASSISTANT_MODEL.size_label.to_string(),
        message: Some(message.to_string()),
        progress,
    }
}

fn error_status(message: &str, progress: Option<AiInstallProgress>) -> AiAssistantStatus {
    AiAssistantStatus {
        state: AiAssistantInstallState::Error,
        model_name: ASSISTANT_MODEL.display_name.to_string(),
        model_size_label: ASSISTANT_MODEL.size_label.to_string(),
        message: Some(message.to_string()),
        progress,
    }
}

fn emit_install_status(app: &AppHandle, status: &AiAssistantStatus) {
    let _ = app.emit(AI_ASSISTANT_INSTALL_STATUS_EVENT, status.clone());
}

async fn download_model_to_disk(app: &AppHandle) -> Result<AiModelMetadata, String> {
    let paths = resolve_ai_model_paths(app)?;
    let model_dir = paths
        .model_file
        .parent()
        .ok_or_else(|| "Model file has no parent directory.".to_string())?;
    fs::create_dir_all(model_dir).map_err(|error| error.to_string())?;

    let temp_path = model_dir.join(MODEL_TEMP_FILE_NAME);

    // Remove any leftover partial file before we start.
    let _ = fs::remove_file(&temp_path);

    emit_install_status(app, &installing_status("Starting download…", None));

    let client = reqwest::Client::new();
    let response = match client.get(ASSISTANT_MODEL.download_url).send().await {
        Ok(value) => value,
        Err(error) => {
            let message = format!("Failed to download model: {error}");
            emit_install_status(app, &error_status(&message, None));
            return Err(message);
        }
    };

    if !response.status().is_success() {
        let message = format!("Model download failed with status: {}", response.status());
        emit_install_status(app, &error_status(&message, None));
        return Err(message);
    }

    let total_bytes = response.content_length();
    let mut progress = get_progress_defaults(&paths, total_bytes);
    let mut downloaded_bytes = progress.downloaded_bytes;

    emit_install_status(
        app,
        &installing_status(
            "Downloading assistant model…",
            Some(AiInstallProgress {
                downloaded_bytes,
                total_bytes,
                percent: compute_percent(downloaded_bytes, total_bytes),
            }),
        ),
    );

    let mut file = match tokio::fs::File::create(&temp_path).await {
        Ok(value) => value,
        Err(error) => {
            let message = format!("Failed to create temp model file: {error}");
            emit_install_status(app, &error_status(&message, Some(progress.clone())));
            return Err(message);
        }
    };

    let mut hasher = Sha256::new();
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let mut last_emit = Instant::now();
    let mut last_emit_bytes = downloaded_bytes;
    const PROGRESS_EMIT_MIN_INTERVAL: Duration = Duration::from_millis(200);
    const PROGRESS_EMIT_MIN_DELTA_BYTES: u64 = 512 * 1024;

    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(value) => value,
            Err(error) => {
                let message = format!("Download stream error: {error}");
                emit_install_status(app, &error_status(&message, Some(progress.clone())));
                return Err(message);
            }
        };
        file.write_all(&chunk).await.map_err(|error| {
            let message = format!("Failed writing temp model file: {error}");
            emit_install_status(app, &error_status(&message, Some(progress.clone())));
            message
        })?;
        hasher.update(&chunk);
        downloaded_bytes = downloaded_bytes.saturating_add(chunk.len() as u64);

        progress.downloaded_bytes = downloaded_bytes;
        progress.percent = compute_percent(downloaded_bytes, total_bytes);

        let delta = downloaded_bytes.saturating_sub(last_emit_bytes);
        if delta >= PROGRESS_EMIT_MIN_DELTA_BYTES
            || last_emit.elapsed() >= PROGRESS_EMIT_MIN_INTERVAL
        {
            emit_install_status(
                app,
                &installing_status("Downloading assistant model…", Some(progress.clone())),
            );
            last_emit = Instant::now();
            last_emit_bytes = downloaded_bytes;
        }
    }

    file.flush().await.map_err(|error| {
        let message = format!("Failed flushing temp model file: {error}");
        emit_install_status(app, &error_status(&message, Some(progress.clone())));
        message
    })?;

    emit_install_status(
        app,
        &installing_status("Verifying checksum…", Some(progress.clone())),
    );

    let sha_hex = format!("{:x}", hasher.finalize());
    let metadata = AiModelMetadata {
        model_sha256: sha_hex,
        file_size_bytes: downloaded_bytes,
    };

    // Optional hard check if we have an expected SHA value configured.
    if let Some(expected) = ASSISTANT_MODEL.expected_sha256 {
        if expected != metadata.model_sha256 {
            let _ = tokio::fs::remove_file(&temp_path).await;
            let message = "Downloaded model checksum mismatch.".to_string();
            emit_install_status(app, &error_status(&message, Some(progress.clone())));
            return Err(message);
        }
    }

    emit_install_status(
        app,
        &installing_status("Finalizing installation…", Some(progress.clone())),
    );

    // Atomically move the temp file into place.
    let _ = tokio::fs::remove_file(&paths.model_file).await;
    tokio::fs::rename(&temp_path, &paths.model_file)
        .await
        .map_err(|error| {
            let message = format!("Failed moving model into place: {error}");
            emit_install_status(app, &error_status(&message, Some(progress.clone())));
            message
        })?;

    // Write metadata after the model is in place.
    tokio::fs::write(
        &paths.metadata_file,
        serde_json::to_vec(&metadata).map_err(|error| error.to_string())?,
    )
    .await
    .map_err(|error| {
        let message = format!("Failed writing model metadata: {error}");
        emit_install_status(app, &error_status(&message, Some(progress.clone())));
        message
    })?;

    Ok(metadata)
}

pub async fn install_ai_assistant(app: AppHandle) -> Result<AiAssistantStatus, String> {
    // Download + validate integrity, then return installed status.
    if let Err(error) = download_model_to_disk(&app).await {
        emit_install_status(&app, &error_status(&error, None));
        return Err(error);
    }

    let final_status = get_ai_assistant_status(app.clone()).map_err(|error| error.to_string())?;
    emit_install_status(&app, &final_status);
    Ok(final_status)
}

pub async fn remove_ai_assistant(app: AppHandle) -> Result<AiAssistantStatus, String> {
    let paths = resolve_ai_model_paths(&app)?;

    let _ = tokio::fs::remove_file(&paths.model_file).await;
    let _ = tokio::fs::remove_file(&paths.metadata_file).await;

    // Best-effort cleanup of the directory if it's now empty.
    if let Some(model_dir) = paths.model_file.parent() {
        let _ = fs::remove_dir(model_dir);
    }

    Ok(AiAssistantStatus {
        state: AiAssistantInstallState::NotInstalled,
        model_name: ASSISTANT_MODEL.display_name.to_string(),
        model_size_label: ASSISTANT_MODEL.size_label.to_string(),
        message: None,
        progress: None,
    })
}

const GGUF_SIDE_CAR_BIN_NAME: &str = "llama-cli";
const INFERENCE_TIMEOUT: Duration = Duration::from_secs(45);
const INFERENCE_N_PREDICT: &str = "256";

fn resolve_gguf_sidecar_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;

    // Note: we rely on the bundled binary being placed into Tauri's resource dir.
    // If it isn't, we return a clear error instead of crashing.
    Ok(resource_dir.join(GGUF_SIDE_CAR_BIN_NAME))
}

/// Runs the bundled GGUF sidecar (llama.cpp-compatible CLI) and returns its stdout.
///
/// We keep this as a helper for `suggest_docker_commands` so the sidecar command
/// can evolve without changing the API contract.
pub async fn run_gguf_inference(app: &AppHandle, prompt: &str) -> Result<String, String> {
    let paths = resolve_ai_model_paths(app)?;
    if !paths.model_file.exists() {
        return Err("Local assistant model is not installed.".to_string());
    }

    let bin_path = resolve_gguf_sidecar_binary(app)?;
    if !bin_path.exists() {
        return Err(format!(
            "GGUF sidecar binary not found at: {}",
            bin_path.display()
        ));
    }

    let model_arg = paths
        .model_file
        .to_str()
        .ok_or_else(|| "Model path must be valid UTF-8.".to_string())?;

    let prompt_arg = prompt;

    let child = Command::new(bin_path)
        .arg("--model")
        .arg(model_arg)
        // Prompt is passed as a single argument to avoid shell parsing.
        .arg("--prompt")
        .arg(prompt_arg)
        // Basic generation settings; can be tuned in the next steps.
        .arg("--n-predict")
        .arg(INFERENCE_N_PREDICT)
        // Attempt to request a structured JSON output if the CLI supports it.
        .arg("--json")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("Failed to spawn GGUF sidecar: {error}"))?;

    let output = timeout(INFERENCE_TIMEOUT, child.wait_with_output()).await;

    match output {
        Ok(Ok(result)) => {
            let status = result.status.code().unwrap_or(-1);

            let stdout = String::from_utf8_lossy(&result.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&result.stderr).trim().to_string();

            if status == 0 {
                Ok(stdout)
            } else {
                Err(format!(
                    "GGUF sidecar failed (exit code {status}): {stderr}"
                ))
            }
        }
        Ok(Err(error)) => Err(format!("Failed waiting for GGUF sidecar: {error}")),
        Err(_) => Err("GGUF inference timed out.".to_string()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAiSuggestion {
    #[serde(default)]
    registry_id: Option<String>,
    completion: String,
    label: String,
    explanation: String,
    confidence: Option<f32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAiSuggestionsResponse {
    suggestions: Vec<RawAiSuggestion>,
}

fn extract_json_fragment(output: &str) -> Option<&str> {
    let start = output.find('{')?;
    let end = output.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(&output[start..=end])
}

pub async fn suggest_docker_commands(
    app: AppHandle,
    input: String,
) -> Result<SuggestDockerCommandsResponse, String> {
    let paths = resolve_ai_model_paths(&app)?;
    if !paths.model_file.exists() {
        return Ok(SuggestDockerCommandsResponse {
            suggestions: Vec::new(),
        });
    }

    // Prompt strongly instructs strict JSON.
    let prompt = format!(
        r#"
You are Oxidock, a Docker CLI autocomplete assistant.

The user has typed the following partial text:
{input}

Return up to 5 suggestions.

Rules:
- Output ONLY valid JSON (no markdown, no code fences, no extra text).
- The JSON must match this shape:
{{
  "suggestions": [
    {{
      "registryId": "system.df",
      "completion": "docker <subcommand ...>",
      "label": "<short title>",
      "explanation": "<what the command does>",
      "confidence": 0.0
    }}
  ]
}}
- `completion` must be a single docker command starting with "docker".
- If you can map the intent to a curated command, include `registryId` from this set:\n  containers.listRunning, containers.listAll, containers.run, containers.inspect, containers.logs, containers.stop, containers.start, containers.restart, containers.remove, containers.exec, containers.stats, containers.top, containers.pause, containers.unpause, containers.cp,\n  images.list, images.pull, images.prune, images.build, images.tag, images.push,\n  volumes.list, volumes.create, volumes.prune,\n  networks.list, networks.create, networks.inspect,\n  events.stream,\n  system.prune, system.df, system.version, system.info,\n  compose.up, compose.down, compose.ps,\n  cli.run.\n+  If unsure, omit `registryId` rather than guessing.
- Prefer read-only/safe commands when the intent is ambiguous.
If you are unsure, still return plausible read-only commands.
"#
    );

    let sidecar_output = match run_gguf_inference(&app, &prompt).await {
        Ok(value) => value,
        Err(_) => {
            // Silent fallback to registry suggestions.
            return Ok(SuggestDockerCommandsResponse {
                suggestions: vec![],
            });
        }
    };

    let json_fragment = extract_json_fragment(&sidecar_output)
        .ok_or_else(|| "GGUF sidecar did not output valid JSON.".to_string())?;

    let parsed: RawAiSuggestionsResponse = serde_json::from_str(json_fragment)
        .map_err(|error| format!("Failed to parse AI suggestions JSON: {error}"))?;

    let mut suggestions = Vec::new();
    for (idx, raw) in parsed.suggestions.into_iter().enumerate() {
        let normalized_completion =
            match crate::command_safety::validate_and_normalize_docker_command_completion(
                &raw.completion,
            ) {
                Ok(value) => value,
                Err(_) => continue,
            };

        let risk = match crate::command_safety::classify_docker_command_risk(&normalized_completion)
        {
            Ok(value) => value,
            Err(_) => continue,
        };

        let label = raw.label.trim();
        let explanation = raw.explanation.trim();
        if label.is_empty() || explanation.is_empty() {
            continue;
        }

        let confidence = raw.confidence.unwrap_or(0.5).clamp(0.0, 1.0);

        // We don't currently have a Rust-side registry to canonicalize explanation/risk by ID.
        // We accept the optional registry_id for future use but still validate completion + risk here.
        let _ = raw.registry_id;

        suggestions.push(AiCommandSuggestion {
            id: format!("ai-{idx}"),
            label: label.to_string(),
            completion: normalized_completion,
            explanation: explanation.to_string(),
            risk,
            confidence,
            source: AiSuggestionSource::Ai,
        });
    }

    // Truncate to something the UI can handle.
    if suggestions.len() > 8 {
        suggestions.truncate(8);
    }

    Ok(SuggestDockerCommandsResponse { suggestions })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_json_fragment_finds_first_object() {
        let output = "some logs...\n{\"suggestions\":[{\"completion\":\"docker ps\",\"label\":\"List\",\"explanation\":\"\",\"confidence\":0.7}]}\nmore logs";
        let fragment = extract_json_fragment(output).expect("should find json fragment");
        assert!(fragment.contains("\"suggestions\""));
    }

    #[test]
    fn extract_json_fragment_returns_none_when_no_braces() {
        let output = "no json here";
        assert!(extract_json_fragment(output).is_none());
    }

    #[test]
    fn compute_percent_returns_none_without_total() {
        assert_eq!(compute_percent(50, None), None);
        assert_eq!(compute_percent(50, Some(0)), None);
    }

    #[test]
    fn compute_percent_clamps_to_one_hundred() {
        assert_eq!(compute_percent(50, Some(100)), Some(50.0));
        assert_eq!(compute_percent(200, Some(100)), Some(100.0));
    }

    #[test]
    fn installing_status_sets_message_and_progress() {
        let status = installing_status(
            "Downloading assistant model…",
            Some(AiInstallProgress {
                downloaded_bytes: 1024,
                total_bytes: Some(2048),
                percent: Some(50.0),
            }),
        );

        assert!(matches!(status.state, AiAssistantInstallState::Installing));
        assert_eq!(
            status.message.as_deref(),
            Some("Downloading assistant model…")
        );
        assert_eq!(status.progress.as_ref().and_then(|p| p.percent), Some(50.0));
    }
}

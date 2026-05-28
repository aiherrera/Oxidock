use crate::ai::AiCommandRisk;
use serde::Serialize;

const MAX_COMPLETION_LEN: usize = 2000;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CommandRiskLevel {
    Safe,
    Medium,
    Destructive,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandClassification {
    pub normalized: String,
    pub risk: CommandRiskLevel,
    pub reasons: Vec<String>,
}

impl From<AiCommandRisk> for CommandRiskLevel {
    fn from(value: AiCommandRisk) -> Self {
        match value {
            AiCommandRisk::Safe => CommandRiskLevel::Safe,
            AiCommandRisk::Medium => CommandRiskLevel::Medium,
            AiCommandRisk::Destructive => CommandRiskLevel::Destructive,
        }
    }
}

fn contains_shell_metacharacters(completion: &str) -> bool {
    // We do not run through a shell (we invoke docker directly), but rejecting obvious
    // multi-command patterns prevents confusing/unsafe suggestions.
    let lowered = completion.to_lowercase();
    lowered.contains("&&")
        || lowered.contains("||")
        || lowered.contains(";")
        || lowered.contains("|")
        || completion.contains('`')
        || lowered.contains("$(")
        || completion.contains('\n')
        || completion.contains('\r')
}

pub fn validate_and_normalize_docker_command_completion(
    completion: &str,
) -> Result<String, String> {
    let trimmed = completion.trim();
    if trimmed.is_empty() {
        return Err("Completion cannot be empty.".to_string());
    }

    if trimmed.len() > MAX_COMPLETION_LEN {
        return Err("Completion is unexpectedly long.".to_string());
    }

    if contains_shell_metacharacters(trimmed) {
        return Err("Completion contains shell metacharacters.".to_string());
    }

    // Require `docker` command as the first token.
    let mut tokens = trimmed.split_whitespace();
    let first = tokens.next().unwrap_or_default();
    if !first.eq_ignore_ascii_case("docker") {
        return Err("Suggestion is not a docker command.".to_string());
    }

    // Normalize whitespace to keep equality checks stable.
    let normalized = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
    Ok(normalized)
}

pub fn classify_docker_command_risk(completion: &str) -> Result<AiCommandRisk, String> {
    let normalized = validate_and_normalize_docker_command_completion(completion)?;
    let tokens: Vec<String> = normalized
        .split_whitespace()
        .map(|t| t.to_lowercase())
        .collect();

    if tokens.len() < 2 {
        return Err("Docker suggestion is missing a subcommand.".to_string());
    }

    // Token-based classification. This is intentionally conservative.
    let joined = normalized.to_lowercase();

    // Compose down is destructive, especially with volumes.
    if tokens.get(1).is_some_and(|t| t == "compose") {
        if tokens.len() >= 3 && tokens[2] == "down" {
            return Ok(AiCommandRisk::Destructive);
        }
        if tokens.len() >= 3 && tokens[2] == "up" {
            return Ok(AiCommandRisk::Medium);
        }
    }

    // Explicit prunes and remove operations.
    if tokens.iter().any(|t| t == "prune") {
        return Ok(AiCommandRisk::Destructive);
    }

    if tokens.iter().any(|t| t == "rm" || t == "rmi") {
        return Ok(AiCommandRisk::Destructive);
    }

    if tokens.iter().any(|t| t == "volume") {
        // `docker volume` alone can be safe, but we err on the side of safety unless
        // it's clearly a list/ls/inspect operation.
        if joined.contains("volume ls")
            || joined.contains("volume inspect")
            || joined.contains("volume list")
            || joined.contains("network ls")
        {
            return Ok(AiCommandRisk::Safe);
        }

        if joined.contains("volume prune") || joined.contains("volume rm") {
            return Ok(AiCommandRisk::Destructive);
        }
    }

    if joined.contains("system prune") || joined.contains("image prune") {
        return Ok(AiCommandRisk::Destructive);
    }

    // Stop/start/restart are potentially disruptive but not destructive by default.
    if tokens
        .iter()
        .any(|t| t == "stop" || t == "start" || t == "restart")
    {
        return Ok(AiCommandRisk::Medium);
    }

    if joined.contains("docker run") {
        return Ok(AiCommandRisk::Medium);
    }

    // Default: if it looks like a read-only command, treat it as safe.
    let safe_markers = [
        "ps",
        "images",
        "image",
        "volume ls",
        "network ls",
        "inspect",
        "logs",
        "events",
        "stats",
        "version",
        "info",
        "df",
    ];
    if safe_markers.iter().any(|m| joined.contains(m)) {
        return Ok(AiCommandRisk::Safe);
    }

    // Fallback: unknown subcommands are medium to force explicit user attention.
    Ok(AiCommandRisk::Medium)
}

pub fn destructive_reasons_for_command(completion: &str) -> Vec<String> {
    let normalized = match validate_and_normalize_docker_command_completion(completion) {
        Ok(value) => value,
        Err(_) => return vec![],
    };

    let joined = normalized.to_lowercase();
    let mut reasons = Vec::new();

    if joined.contains("prune") {
        reasons.push("This command includes prune and may delete unused Docker data.".to_string());
    }

    if joined.contains("compose down") {
        reasons.push("Compose down stops and removes project containers.".to_string());
        if joined.contains("-v") || joined.contains("--volumes") {
            reasons.push("Volume flags may delete named volumes and their data.".to_string());
        }
    }

    if joined.contains(" volume rm") || joined.contains(" volume prune") {
        reasons.push("Volume removal deletes persistent data.".to_string());
    }

    if joined.contains(" rm ") || joined.ends_with(" rm") {
        reasons.push("Container removal deletes the container filesystem.".to_string());
    }

    if joined.contains(" rmi ") || joined.ends_with(" rmi") {
        reasons.push("Image removal deletes local image layers.".to_string());
    }

    if joined.contains("system prune") {
        reasons.push(
            "System prune removes stopped containers, unused networks, and dangling images."
                .to_string(),
        );
    }

    if reasons.is_empty() {
        reasons.push("This command is classified as destructive and may delete data.".to_string());
    }

    reasons
}

pub fn classify_docker_command(command: &str) -> Result<CommandClassification, String> {
    let normalized = validate_and_normalize_docker_command_completion(command)?;
    let risk = classify_docker_command_risk(&normalized)?;

    let (risk_level, reasons) = match risk {
        AiCommandRisk::Destructive => (
            CommandRiskLevel::Destructive,
            destructive_reasons_for_command(&normalized),
        ),
        AiCommandRisk::Medium => (
            CommandRiskLevel::Medium,
            vec!["This command may change running containers or create new resources.".to_string()],
        ),
        AiCommandRisk::Safe => (CommandRiskLevel::Safe, vec![]),
    };

    Ok(CommandClassification {
        normalized,
        risk: risk_level,
        reasons,
    })
}

/// Validates and normalizes a command, then enforces execution policy.
/// Destructive commands require `confirm_destructive` to be true.
pub fn assert_command_execution_allowed(
    command: &str,
    confirm_destructive: bool,
) -> Result<String, String> {
    let classification = classify_docker_command(command)?;
    match classification.risk {
        CommandRiskLevel::Safe | CommandRiskLevel::Medium => Ok(classification.normalized),
        CommandRiskLevel::Destructive => {
            if confirm_destructive {
                Ok(classification.normalized)
            } else {
                Err(
                    "Destructive command requires explicit confirmation before execution."
                        .to_string(),
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_docker_completion() {
        assert!(validate_and_normalize_docker_command_completion("ps aux").is_err());
    }

    #[test]
    fn classifies_prune_as_destructive() {
        let risk = classify_docker_command_risk("docker system prune -f").unwrap();
        assert!(matches!(risk, AiCommandRisk::Destructive));
    }

    #[test]
    fn classifies_container_rm_as_destructive() {
        let classification = classify_docker_command("docker rm d04fc034dc2a").unwrap();
        assert!(matches!(classification.risk, CommandRiskLevel::Destructive));
        assert!(!classification.reasons.is_empty());
    }

    #[test]
    fn classifies_compose_down_as_destructive() {
        let risk = classify_docker_command_risk("docker compose down -v").unwrap();
        assert!(matches!(risk, AiCommandRisk::Destructive));
    }

    #[test]
    fn classifies_ps_as_safe() {
        let classification = classify_docker_command("docker ps").unwrap();
        assert!(matches!(classification.risk, CommandRiskLevel::Safe));
        assert!(classification.reasons.is_empty());
    }

    #[test]
    fn classifies_system_prune_with_reasons() {
        let classification = classify_docker_command("docker system prune -a").unwrap();
        assert!(matches!(classification.risk, CommandRiskLevel::Destructive));
        assert!(!classification.reasons.is_empty());
    }

    #[test]
    fn rejects_shell_chaining() {
        assert!(validate_and_normalize_docker_command_completion("docker ps && rm -rf /").is_err());
    }

    #[test]
    fn allows_safe_command_without_confirmation() {
        let normalized =
            assert_command_execution_allowed("docker ps", false).expect("safe command");
        assert_eq!(normalized, "docker ps");
    }

    #[test]
    fn blocks_destructive_without_confirmation() {
        assert!(assert_command_execution_allowed("docker system prune -f", false).is_err());
    }

    #[test]
    fn allows_destructive_with_confirmation() {
        assert!(assert_command_execution_allowed("docker system prune -f", true).is_ok());
    }
}

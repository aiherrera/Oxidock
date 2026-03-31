use bollard::models::{
    ContainerBlkioStatEntry, ContainerMemoryStats, ContainerNetworkStats, ContainerPidsStats,
    ContainerStatsResponse, PortMap, PortSummary,
};
use chrono::{DateTime, TimeZone, Utc};
use std::collections::HashMap;

use super::{ContainerStatsInfo, MAX_TEXT_LEN, SHORT_ID_LEN};

pub(crate) fn format_inspect_ports(ports: &PortMap) -> Vec<String> {
    let mut formatted = Vec::new();

    for (key, bindings) in ports {
        if let Some(bindings) = bindings {
            for binding in bindings {
                if let Some(public) = &binding.host_port {
                    formatted.push(format!("{public}:{key}"));
                } else {
                    formatted.push(key.clone());
                }
            }
        } else {
            formatted.push(key.clone());
        }
    }

    formatted.sort();
    formatted
}

pub(crate) fn format_port_summaries(ports: Option<Vec<PortSummary>>) -> Vec<String> {
    ports
        .unwrap_or_default()
        .into_iter()
        .map(|port| {
            let private = port.private_port;
            let public = port.public_port.unwrap_or(private);
            format!("{public}:{private}")
        })
        .collect()
}

pub(crate) fn format_created_timestamp(created: Option<i64>) -> String {
    created
        .and_then(|timestamp| Utc.timestamp_opt(timestamp, 0).single())
        .map(|datetime: DateTime<Utc>| datetime.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| "—".to_string())
}

pub(crate) fn short_id_from_full(id: &str) -> String {
    short_id(id.trim_start_matches("sha256:"))
}

pub(crate) fn clean_container_name(names: Option<Vec<String>>) -> String {
    names
        .and_then(|names| names.into_iter().next())
        .map(|name| clean_text(name.trim_start_matches('/').to_string()))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "unnamed".to_string())
}

pub(crate) fn short_id(id: &str) -> String {
    id.chars().take(SHORT_ID_LEN).collect()
}

pub(crate) fn clean_text(value: String) -> String {
    value
        .chars()
        .filter(|character| !character.is_control())
        .take(MAX_TEXT_LEN)
        .collect()
}

pub(crate) fn label_value(labels: &HashMap<String, String>, key: &str) -> Option<String> {
    labels
        .get(key)
        .map(|value| clean_text(value.clone()))
        .filter(|value| !value.is_empty())
}

pub(crate) fn format_last_started(status: &str) -> String {
    let trimmed = status.trim();
    if trimmed.is_empty() {
        return "—".to_string();
    }

    if let Some(rest) = trimmed.strip_prefix("Up ") {
        let without_health = rest.split(" (").next().unwrap_or(rest).trim();
        if without_health.is_empty() {
            return "—".to_string();
        }
        return format!("{without_health} ago");
    }

    if trimmed.contains(" ago") {
        if let Some(after_exit) = trimmed.split(')').nth(1) {
            let part = after_exit.trim();
            if !part.is_empty() {
                return part.to_string();
            }
        }
    }

    trimmed.to_string()
}

pub(crate) fn format_stats_with_previous(
    id: &str,
    stats: ContainerStatsResponse,
    previous: Option<&ContainerStatsResponse>,
) -> ContainerStatsInfo {
    let cpu_percent = match previous {
        Some(previous) => format_cpu_percent_between(previous, &stats),
        None => format_cpu_percent(&stats),
    };
    let (memory_usage, memory_percent) = format_memory(&stats.memory_stats);
    let disk_read_write = format_disk_io(stats.blkio_stats.as_ref());
    let network_io = format_network_io(stats.networks.as_ref());
    let pids = format_pids(stats.pids_stats.as_ref());

    ContainerStatsInfo {
        id: id.to_string(),
        cpu_percent,
        memory_usage,
        memory_percent,
        disk_read_write,
        network_io,
        pids,
    }
}

pub(crate) fn format_cpu_percent_between(
    previous: &ContainerStatsResponse,
    current: &ContainerStatsResponse,
) -> String {
    let cpu_usage = previous
        .cpu_stats
        .as_ref()
        .and_then(|stats| stats.cpu_usage.as_ref())
        .and_then(|usage| usage.total_usage);
    let next_cpu_usage = current
        .cpu_stats
        .as_ref()
        .and_then(|stats| stats.cpu_usage.as_ref())
        .and_then(|usage| usage.total_usage);
    let system_usage = previous
        .cpu_stats
        .as_ref()
        .and_then(|stats| stats.system_cpu_usage);
    let next_system_usage = current
        .cpu_stats
        .as_ref()
        .and_then(|stats| stats.system_cpu_usage);

    let (cpu_usage, precpu_usage, system_usage, presystem_usage) =
        match (next_cpu_usage, cpu_usage, next_system_usage, system_usage) {
            (Some(next_cpu), Some(prev_cpu), Some(next_system), Some(prev_system)) => {
                (next_cpu, prev_cpu, next_system, prev_system)
            }
            _ => return "0%".to_string(),
        };

    if system_usage <= presystem_usage || cpu_usage < precpu_usage {
        return "0%".to_string();
    }

    let cpu_delta = cpu_usage.saturating_sub(precpu_usage) as f64;
    let system_delta = system_usage.saturating_sub(presystem_usage) as f64;
    let online_cpus = current
        .cpu_stats
        .as_ref()
        .and_then(|stats| stats.online_cpus)
        .or(current.num_procs)
        .unwrap_or(1) as f64;

    let percent = (cpu_delta / system_delta) * online_cpus * 100.0;
    format!("{:.2}%", percent.max(0.0))
}

pub(crate) fn format_cpu_percent(stats: &ContainerStatsResponse) -> String {
    let cpu_stats = match stats.cpu_stats.as_ref() {
        Some(cpu_stats) => cpu_stats,
        None => return "0%".to_string(),
    };
    let precpu_stats = match stats.precpu_stats.as_ref() {
        Some(precpu_stats) => precpu_stats,
        None => return "0%".to_string(),
    };

    let cpu_usage = match cpu_stats
        .cpu_usage
        .as_ref()
        .and_then(|usage| usage.total_usage)
    {
        Some(value) => value,
        None => return "0%".to_string(),
    };
    let precpu_usage = match precpu_stats
        .cpu_usage
        .as_ref()
        .and_then(|usage| usage.total_usage)
    {
        Some(value) => value,
        None => return "0%".to_string(),
    };
    let system_usage = match cpu_stats.system_cpu_usage {
        Some(value) => value,
        None => return "0%".to_string(),
    };
    let presystem_usage = match precpu_stats.system_cpu_usage {
        Some(value) => value,
        None => return "0%".to_string(),
    };

    if system_usage <= presystem_usage || cpu_usage < precpu_usage {
        return "0%".to_string();
    }

    let cpu_delta = cpu_usage.saturating_sub(precpu_usage) as f64;
    let system_delta = system_usage.saturating_sub(presystem_usage) as f64;
    let online_cpus = cpu_stats.online_cpus.or(stats.num_procs).unwrap_or(1) as f64;

    let percent = (cpu_delta / system_delta) * online_cpus * 100.0;
    format!("{:.2}%", percent.max(0.0))
}

pub(crate) fn format_memory(memory: &Option<ContainerMemoryStats>) -> (String, String) {
    let memory = match memory {
        Some(memory) => memory,
        None => return ("0B / 0B".to_string(), "0%".to_string()),
    };

    let usage = memory.usage.unwrap_or(0);
    let limit = memory.limit.unwrap_or(0);

    let percent = if limit > 0 {
        format!("{:.2}%", (usage as f64 / limit as f64) * 100.0)
    } else {
        "0%".to_string()
    };

    (
        format!("{} / {}", format_bytes(usage), format_bytes(limit)),
        percent,
    )
}

pub(crate) fn format_disk_io(blkio: Option<&bollard::models::ContainerBlkioStats>) -> String {
    let entries = blkio
        .and_then(|stats| stats.io_service_bytes_recursive.as_ref())
        .map(|entries| entries.as_slice())
        .unwrap_or(&[]);

    let read = sum_blkio(entries, "read");
    let write = sum_blkio(entries, "write");
    format!("{} / {}", format_bytes(read), format_bytes(write))
}

pub(crate) fn sum_blkio(entries: &[ContainerBlkioStatEntry], op: &str) -> u64 {
    entries
        .iter()
        .filter(|entry| entry.op.as_deref() == Some(op))
        .filter_map(|entry| entry.value)
        .sum()
}

pub(crate) fn format_network_io(networks: Option<&HashMap<String, ContainerNetworkStats>>) -> String {
    let networks = match networks {
        Some(networks) => networks,
        None => return "0B / 0B".to_string(),
    };

    let rx: u64 = networks.values().filter_map(|net| net.rx_bytes).sum();
    let tx: u64 = networks.values().filter_map(|net| net.tx_bytes).sum();
    format!("{} / {}", format_bytes(rx), format_bytes(tx))
}

pub(crate) fn format_pids(pids: Option<&ContainerPidsStats>) -> String {
    pids.and_then(|stats| stats.current)
        .map(|count| count.to_string())
        .unwrap_or_else(|| "0".to_string())
}

pub(crate) fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if bytes == 0 {
        return "0B".to_string();
    }

    let mut value = bytes as f64;
    let mut unit_index = 0;

    while value >= 1024.0 && unit_index < UNITS.len() - 1 {
        value /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{bytes}B")
    } else {
        format!("{:.2}{}", value, UNITS[unit_index])
    }
}


use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use sysinfo::{Disks, Pid, ProcessesToUpdate, System};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Default)]
pub struct AppMetricsState {
    system: Mutex<System>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppResourceUsage {
    pub ram: String,
    pub cpu: String,
    pub disk_used: String,
    pub disk_limit: String,
}

pub fn get_app_resource_usage(
    app: &AppHandle,
    state: &AppMetricsState,
) -> Result<AppResourceUsage, String> {
    let pid = sysinfo::get_current_pid().map_err(|error| error.to_string())?;
    let (ram_bytes, cpu_percent) = read_process_usage(pid, state)?;

    let usage_paths = resolve_app_usage_paths(app)?;
    let disk_used_bytes = paths_size(&usage_paths)?;
    let disk_limit_bytes = usage_paths
        .iter()
        .find_map(|path| disk_capacity_for_path(path).ok())
        .ok_or_else(|| "Could not determine disk capacity.".to_string())?;

    Ok(AppResourceUsage {
        ram: format_bytes_label(ram_bytes),
        cpu: format_cpu_label(cpu_percent),
        disk_used: format_bytes_label(disk_used_bytes),
        disk_limit: format_bytes_label(disk_limit_bytes),
    })
}

fn read_process_usage(pid: Pid, state: &AppMetricsState) -> Result<(u64, f32), String> {
    let mut system = state
        .system
        .lock()
        .map_err(|_| "Failed to lock app metrics state.".to_string())?;

    // Keep System alive between polls so CPU usage is calculated across real UI activity,
    // not across an artificial sleep while this command is idle.
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), false);
    let process = system
        .process(pid)
        .ok_or_else(|| "Could not read Oxidock process metrics.".to_string())?;

    Ok((process.memory(), process.cpu_usage()))
}

fn resolve_app_usage_paths(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        paths.push(exe);
    }

    if let Ok(path) = app.path().app_data_dir() {
        paths.push(path);
    }

    if let Ok(path) = app.path().app_cache_dir() {
        paths.push(path);
    }

    if let Ok(path) = app.path().app_config_dir() {
        paths.push(path);
    }

    dedupe_paths(paths)
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Result<Vec<PathBuf>, String> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for path in paths {
        let normalized = path.canonicalize().unwrap_or(path);
        if seen.insert(normalized.clone()) {
            deduped.push(normalized);
        }
    }

    if deduped.is_empty() {
        return Err("Could not resolve Oxidock disk usage paths.".to_string());
    }

    Ok(deduped)
}

fn paths_size(paths: &[PathBuf]) -> Result<u64, String> {
    paths.iter().try_fold(0_u64, |total, path| {
        directory_size(path).map(|size| total.saturating_add(size))
    })
}

fn directory_size(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total = 0_u64;

    if path.is_file() {
        return path
            .metadata()
            .map(|metadata| metadata.len())
            .map_err(|error| error.to_string());
    }

    let entries = std::fs::read_dir(path).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            total = total.saturating_add(directory_size(&entry_path)?);
        } else {
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            total = total.saturating_add(metadata.len());
        }
    }

    Ok(total)
}

fn disk_capacity_for_path(path: &Path) -> Result<u64, String> {
    let disks = Disks::new_with_refreshed_list();
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

    let mut best_match: Option<u64> = None;
    let mut best_prefix_len = 0_usize;

    for disk in disks.list() {
        let mount_point = disk.mount_point();
        if canonical.starts_with(mount_point) {
            let prefix_len = mount_point.as_os_str().len();
            if prefix_len >= best_prefix_len {
                best_prefix_len = prefix_len;
                best_match = Some(disk.total_space());
            }
        }
    }

    best_match.ok_or_else(|| "Could not determine disk capacity.".to_string())
}

fn format_bytes_label(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if bytes == 0 {
        return "0 B".to_string();
    }

    let mut value = bytes as f64;
    let mut unit_index = 0;

    while value >= 1024.0 && unit_index < UNITS.len() - 1 {
        value /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", value, UNITS[unit_index])
    }
}

fn format_cpu_label(cpu_percent: f32) -> String {
    if cpu_percent <= 0.005 {
        return "<0.01%".to_string();
    }

    format!("{cpu_percent:.2}%")
}

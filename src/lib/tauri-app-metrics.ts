import { invoke } from "@tauri-apps/api/core";
import type { AppResourceUsage } from "../types/app-metrics";

export const fetchAppResourceUsage = () => invoke<AppResourceUsage>("get_app_resource_usage");

import { useEffect, useState } from "react";
import { fetchAppResourceUsage } from "../lib/tauri-app-metrics";
import type { AppResourceUsage } from "../types/app-metrics";

const METRICS_POLL_MS = 2000;

const PLACEHOLDER_METRICS: AppResourceUsage = {
  ram: "--",
  cpu: "--",
  diskUsed: "--",
  diskLimit: "--",
};

export function useAppResourceUsage() {
  const [metrics, setMetrics] = useState<AppResourceUsage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const pollMetrics = async () => {
      try {
        const next = await fetchAppResourceUsage();
        if (!cancelled) {
          setMetrics(next);
        }
      } catch {
        if (!cancelled) {
          setMetrics(null);
        }
      }
    };

    void pollMetrics();
    const intervalId = window.setInterval(() => {
      void pollMetrics();
    }, METRICS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return metrics ?? PLACEHOLDER_METRICS;
}

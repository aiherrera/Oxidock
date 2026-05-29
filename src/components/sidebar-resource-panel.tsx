import { useEffect, useMemo, useRef, useState } from "react";
import { useAppResourceUsage } from "../hooks/use-app-resource-usage";
import { IconCpu, IconDisk, IconMemory } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const HISTORY_LENGTH = 24;

const parseCpuPercent = (value: string): number => {
  const normalized = value.replace("<", "").replace("%", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseMemoryLabel = (value: string): number => {
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  return Number.isFinite(amount) ? amount * (multipliers[unit] ?? 1) : 0;
};

const pushHistory = (current: number[], nextValue: number): number[] => {
  const next = [...current, nextValue];
  if (next.length > HISTORY_LENGTH) {
    return next.slice(next.length - HISTORY_LENGTH);
  }
  return next;
};

type SparklineProps = {
  values: number[];
  strokeClass: string;
};

const SPARKLINE_WIDTH = 92;
const SPARKLINE_HEIGHT = 24;
const SPARKLINE_PADDING = 3;
const ROW_HEIGHT_CLASS = "h-10";

function Sparkline({ values, strokeClass }: SparklineProps) {
  const path = useMemo(() => {
    const width = SPARKLINE_WIDTH;
    const height = SPARKLINE_HEIGHT;
    const chartHeight = height - SPARKLINE_PADDING * 2;
    const centerY = height / 2;

    if (values.length < 2) {
      return "";
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    if (range <= 0.0001) {
      return `M0,${centerY.toFixed(1)} L${width},${centerY.toFixed(1)}`;
    }

    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = SPARKLINE_PADDING + chartHeight - ((value - min) / range) * chartHeight;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  if (!path) {
    return (
      <span
        aria-hidden
        className="block rounded bg-(--surface-hover)"
        style={{ width: SPARKLINE_WIDTH, height: SPARKLINE_HEIGHT }}
      />
    );
  }

  return (
    <svg
      aria-hidden
      className="block"
      height={SPARKLINE_HEIGHT}
      style={{ width: SPARKLINE_WIDTH, height: SPARKLINE_HEIGHT }}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      width={SPARKLINE_WIDTH}
    >
      <path
        className={strokeClass}
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

type ResourceRowProps = {
  compact: boolean;
  icon: typeof IconCpu;
  label: string;
  value: string;
  values: number[];
  strokeClass: string;
};

function ResourceRow({ compact, icon: Icon, label, value, values, strokeClass }: ResourceRowProps) {
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger
          aria-label={`${label}: ${value}`}
          className="flex h-10 w-full items-center justify-center rounded-md text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--accent)"
        >
          <Icon className="size-5" />
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="rounded-lg border border-(--border) bg-(--surface) p-3 text-(--text-primary) shadow-xl"
          side="right"
          sideOffset={10}
        >
          <div className="flex w-40 flex-col gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-(--text-muted)">
                <Icon className="size-3.5 shrink-0" />
                <span>{label}</span>
              </p>
              <p className={`mt-1 text-sm font-semibold leading-none ${strokeClass}`}>{value}</p>
            </div>
            <div className="flex justify-center">
              <Sparkline
                strokeClass={strokeClass}
                values={values}
              />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={`flex ${ROW_HEIGHT_CLASS} items-center gap-2`}>
      <div className="w-19 shrink-0">
        <p className="flex items-center gap-1 text-xs text-(--text-muted)">
          <Icon className="size-3.5 shrink-0" />
          <span>{label}</span>
        </p>
        <p className={`mt-0.5 text-xs font-medium leading-none ${strokeClass}`}>{value}</p>
      </div>
      <div className={`flex ${ROW_HEIGHT_CLASS} min-w-0 flex-1 items-center justify-center`}>
        <Sparkline
          strokeClass={strokeClass}
          values={values}
        />
      </div>
    </div>
  );
}

type SidebarResourcePanelProps = {
  compact: boolean;
};

export function SidebarResourcePanel({ compact }: SidebarResourcePanelProps) {
  const metrics = useAppResourceUsage();
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const lastSampleRef = useRef("");

  useEffect(() => {
    const sampleKey = `${metrics.cpu}|${metrics.ram}|${metrics.diskUsed}`;
    if (sampleKey === lastSampleRef.current) {
      return;
    }

    lastSampleRef.current = sampleKey;
    setCpuHistory((current) => pushHistory(current, parseCpuPercent(metrics.cpu)));
    setMemoryHistory((current) => pushHistory(current, parseMemoryLabel(metrics.ram)));
    setDiskHistory((current) => pushHistory(current, parseMemoryLabel(metrics.diskUsed)));
  }, [metrics.cpu, metrics.diskUsed, metrics.ram]);

  return (
    <div
      className={`rounded-lg border border-(--border) bg-(--surface) ${
        compact ? "flex flex-col gap-1 px-1.5 py-2" : "px-3 py-2"
      }`}
    >
      <ResourceRow
        compact={compact}
        icon={IconCpu}
        label="CPU"
        strokeClass="text-(--accent)"
        value={metrics.cpu}
        values={cpuHistory}
      />
      <ResourceRow
        compact={compact}
        icon={IconMemory}
        label="Memory"
        strokeClass="text-violet-400"
        value={metrics.ram}
        values={memoryHistory}
      />
      <ResourceRow
        compact={compact}
        icon={IconDisk}
        label="Disk"
        strokeClass="text-emerald-400"
        value={metrics.diskUsed}
        values={diskHistory}
      />
    </div>
  );
}

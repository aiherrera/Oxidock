const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const UNIT_MULTIPLIERS: Record<(typeof BYTE_UNITS)[number], number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export const parseFormattedBytes = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0B") {
    return 0;
  }

  const match = trimmed.match(/^([\d.]+)(B|KB|MB|GB|TB)$/i);
  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toUpperCase() as (typeof BYTE_UNITS)[number];
  if (!Number.isFinite(amount) || !(unit in UNIT_MULTIPLIERS)) {
    return 0;
  }

  return Math.round(amount * UNIT_MULTIPLIERS[unit]);
};

/** Matches Docker/Rust `format_bytes` labels (e.g. `1.50KB`, `158.9MB`). */
export const formatFormattedBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return "0B";
  }

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${bytes}B`;
  }

  return `${value.toFixed(2)}${BYTE_UNITS[unitIndex]}`;
};

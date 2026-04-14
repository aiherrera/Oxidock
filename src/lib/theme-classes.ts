/** Theme-aware status and alert class strings (pair with CSS variables in App.css). */

export const statusBadgeSuccess =
  "border border-(--status-success-border) bg-(--status-success-bg) text-(--status-success-text)";

export const statusBadgeDanger =
  "border border-(--status-danger-border) bg-(--status-danger-bg) text-(--status-danger-text)";

export const statusBadgeWarning =
  "border border-(--status-warning-border) bg-(--status-warning-bg) text-(--status-warning-text)";

export const statusBadgeInfo = "border border-(--status-info-border) bg-(--status-info-bg) text-(--status-info-text)";

export const statusBadgeLocal =
  "border border-(--status-local-border) bg-(--status-local-bg) text-(--status-local-text)";

export const alertSuccess =
  "border border-(--status-success-border) bg-(--status-success-bg) text-(--status-success-text)";

export const alertDanger = "border border-(--status-danger-border) bg-(--status-danger-bg) text-(--status-danger-text)";

export const alertWarning =
  "border border-(--status-warning-border) bg-(--status-warning-bg) text-(--status-warning-text)";

export const alertWarningSubtle =
  "border border-(--status-warning-border) bg-(--status-warning-bg) text-(--status-warning-strong-text)";

export const alertInfo = "border border-(--status-info-border) bg-(--status-info-bg) text-(--status-info-text)";

export const riskBadgeClasses = {
  safe: statusBadgeSuccess,
  medium: statusBadgeWarning,
  destructive: statusBadgeDanger,
} as const;

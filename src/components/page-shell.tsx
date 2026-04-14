import type { ReactNode } from "react";
import { alertDanger } from "../lib/theme-classes";
import { OverviewFooter } from "./overview-footer";

type PageShellProps = {
  title: string;
  description: string;
  isLoading: boolean;
  errorMessage: string | null;
  actions?: ReactNode;
  footerStatusLabel?: string;
  children: ReactNode;
};

export function PageShell({ title, description, errorMessage, actions, footerStatusLabel, children }: PageShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative z-20 space-y-4 border-b border-(--border) bg-(--bg) px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-(--text-primary) sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm text-(--text-muted)">{description}</p>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {errorMessage ? (
        <div className={`mx-4 mt-4 rounded-lg px-4 py-3 text-sm sm:mx-6 ${alertDanger}`}>{errorMessage}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {footerStatusLabel ? <OverviewFooter statusLabel={footerStatusLabel} /> : null}
    </div>
  );
}

export function PageLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-4 sm:p-6">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="h-12 animate-pulse rounded-md bg-(--surface-elevated)"
          key={index}
        />
      ))}
    </div>
  );
}

export function PageEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-(--text-muted)">
      {message}
    </div>
  );
}

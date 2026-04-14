import { useCallback, useMemo } from "react";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { useDockerResourcePage } from "../hooks/use-docker-resource-page";
import { filterByQuery } from "../lib/search-utils";
import { fetchDockerEvents } from "../lib/tauri-docker";
import type { DockerStatus } from "../types/docker";

type EventsPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  searchQuery: string;
};

export function EventsPage({ dockerStatus, engineRevision, searchQuery }: EventsPageProps) {
  const fetchEventsList = useCallback(() => fetchDockerEvents(), []);
  const {
    items: events,
    isLoading,
    errorMessage,
  } = useDockerResourcePage({
    dockerStatus,
    engineRevision,
    fetch: fetchEventsList,
    failureMessage: "Could not load Docker events.",
  });

  const filteredEvents = useMemo(
    () =>
      filterByQuery(events, searchQuery, (event) => [
        event.time,
        event.typ,
        event.action,
        event.actorId,
        event.actorName,
        ...Object.values(event.attributes),
      ]),
    [events, searchQuery]
  );

  return (
    <PageShell
      description="Recent daemon events from the last 24 hours."
      errorMessage={errorMessage}
      isLoading={isLoading}
      footerStatusLabel={`Showing ${filteredEvents.length} events`}
      title="Events"
    >
      {isLoading ? (
        <PageLoadingSkeleton />
      ) : filteredEvents.length === 0 ? (
        <PageEmptyState message="No events were collected. Try refreshing while Docker activity is happening." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <ul className="space-y-2">
            {filteredEvents.map((event, index) => (
              <li
                className="rounded-lg border border-(--border) bg-(--surface) p-4"
                key={`${event.time}-${event.actorId}-${event.action}-${index}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-(--text-primary)">
                      <span className="text-(--accent)">{event.typ}</span>
                      <span className="text-(--text-muted)"> · </span>
                      {event.action}
                    </p>
                    <p className="mt-1 text-sm text-(--text-secondary)">
                      {event.actorName}
                      <span className="font-mono text-xs text-(--text-muted)"> ({event.actorId})</span>
                    </p>
                  </div>
                  <time className="text-xs text-(--text-muted)">{event.time}</time>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}

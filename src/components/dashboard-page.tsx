import { useCallback, useEffect, useMemo, useState } from "react";
import { PageEmptyState, PageLoadingSkeleton, PageShell } from "./page-shell";
import { countRunning } from "../lib/container-utils";
import {
  buildDashboardInsights,
  insightSeverityClass,
  type DashboardInsight,
  type DashboardInsightAction,
} from "../lib/dashboard-insights";
import { getEngineStateLabel } from "../lib/engine-ui";
import { toErrorMessage } from "../lib/search-utils";
import { useDockerContainersChanged } from "../lib/docker-change-events";
import { fetchContainers, fetchImages, fetchNetworks, fetchVolumes } from "../lib/tauri-docker";
import type { AppPage } from "../types/app";
import type { ContainerInfo, DockerStatus, ImageInfo, NetworkInfo, VolumeInfo } from "../types/docker";

type DashboardPageProps = {
  dockerStatus: DockerStatus | null;
  engineRevision: number;
  onNavigate: (page: AppPage) => void;
  onOpenPlayground: (command: string) => void;
};

type DashboardSummary = {
  containers: ContainerInfo[];
  images: ImageInfo[];
  volumes: VolumeInfo[];
  networks: NetworkInfo[];
};

const QUICK_LINKS: { page: AppPage; label: string; description: string }[] = [
  { page: "containers", label: "Containers", description: "Manage running and stopped containers." },
  { page: "images", label: "Images", description: "Browse local images and registries." },
  { page: "events", label: "Events", description: "Monitor recent Docker activity." },
  { page: "assistant", label: "AI Assistant", description: "Ask questions about your environment." },
];

const runInsightAction = (
  action: DashboardInsightAction,
  onNavigate: (page: AppPage) => void,
  onOpenPlayground: (command: string) => void
) => {
  if (action.type === "navigate") {
    onNavigate(action.page);
    return;
  }

  onOpenPlayground(action.command);
};

function DashboardInsightCard({
  insight,
  onNavigate,
  onOpenPlayground,
}: {
  insight: DashboardInsight;
  onNavigate: (page: AppPage) => void;
  onOpenPlayground: (command: string) => void;
}) {
  const label = `${insight.title}. ${insight.detail} ${insight.actionLabel}`;

  return (
    <button
      aria-label={label}
      className={`rounded-xl border px-4 py-4 text-left transition hover:border-(--accent)/40 hover:bg-(--surface-hover) ${insightSeverityClass(insight.severity)}`}
      type="button"
      onClick={() => runInsightAction(insight.action, onNavigate, onOpenPlayground)}
    >
      <p className="font-medium text-(--text-primary)">{insight.title}</p>
      <p className="mt-1 text-sm text-(--text-secondary)">{insight.detail}</p>
      <p className="mt-3 text-xs font-medium text-(--accent)">{insight.actionLabel} →</p>
    </button>
  );
}

export function DashboardPage({ dockerStatus, engineRevision, onNavigate, onOpenPlayground }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        if (!dockerStatus?.isRunning) {
          setSummary({
            containers: [],
            images: [],
            volumes: [],
            networks: [],
          });
          return;
        }

        const [containers, images, volumes, networks] = await Promise.all([
          fetchContainers(true),
          fetchImages(),
          fetchVolumes(),
          fetchNetworks(),
        ]);

        setSummary({
          containers,
          images,
          volumes,
          networks,
        });
      } catch (error) {
        setSummary(null);
        setErrorMessage(toErrorMessage(error, "Could not load dashboard summary."));
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [dockerStatus?.isRunning]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, engineRevision]);

  useDockerContainersChanged(
    useCallback(() => {
      void loadSummary({ silent: true });
    }, [loadSummary]),
    Boolean(dockerStatus?.isRunning)
  );

  const runningCount = useMemo(() => countRunning(summary?.containers ?? []), [summary?.containers]);
  const totalContainers = summary?.containers.length ?? 0;
  const engineLabel = getEngineStateLabel(dockerStatus?.engineState ?? "unavailable", null);

  const insights = useMemo(
    () =>
      summary
        ? buildDashboardInsights({
            containers: summary.containers,
            images: summary.images,
            volumes: summary.volumes,
            networks: summary.networks,
          })
        : [],
    [summary]
  );

  const statCards = [
    { label: "Running containers", value: String(runningCount) },
    { label: "Total containers", value: String(totalContainers) },
    { label: "Images", value: String(summary?.images.length ?? 0) },
    { label: "Volumes", value: String(summary?.volumes.length ?? 0) },
    { label: "Networks", value: String(summary?.networks.length ?? 0) },
  ];

  return (
    <PageShell
      description="Overview of your container engine, resources, and quick navigation."
      errorMessage={errorMessage}
      isLoading={isLoading}
      title="Dashboard"
    >
      {isLoading ? (
        <PageLoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-6 p-4 sm:p-6">
          <section className="rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-(--text-secondary)">
                  {dockerStatus?.providerName ?? "Container engine"}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary)">{engineLabel}</p>
                <p className="mt-1 text-sm text-(--text-muted)">
                  {dockerStatus?.isRunning
                    ? dockerStatus.message || "Engine is reachable."
                    : dockerStatus?.message || "Start your container engine to load live data."}
                </p>
              </div>
              {dockerStatus?.serverVersion || dockerStatus?.apiVersion ? (
                <div className="text-right text-sm text-(--text-muted)">
                  {dockerStatus?.serverVersion ? <p>Docker v{dockerStatus.serverVersion}</p> : null}
                  {dockerStatus?.apiVersion ? <p>API {dockerStatus.apiVersion}</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          {!dockerStatus?.isRunning ? (
            <PageEmptyState message="Docker is not running. Start the engine to populate dashboard metrics." />
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {statCards.map((card) => (
                  <article
                    className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3"
                    key={card.label}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-(--text-primary)">{card.value}</p>
                  </article>
                ))}
              </section>

              <section aria-labelledby="dashboard-action-needed-heading">
                <h2
                  className="text-sm font-semibold uppercase tracking-wide text-(--text-muted)"
                  id="dashboard-action-needed-heading"
                >
                  Action needed
                </h2>
                {insights.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-secondary)">
                    No action needed — your environment looks healthy based on current Docker data.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {insights.map((insight) => (
                      <DashboardInsightCard
                        insight={insight}
                        key={insight.id}
                        onNavigate={onNavigate}
                        onOpenPlayground={onOpenPlayground}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-(--text-muted)">Quick links</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {QUICK_LINKS.map((link) => (
                    <button
                      aria-label={`Quick link: ${link.label}`}
                      className="rounded-xl border border-(--border) bg-(--surface) px-4 py-4 text-left transition hover:border-(--accent)/40 hover:bg-(--surface-hover)"
                      key={link.page}
                      type="button"
                      onClick={() => onNavigate(link.page)}
                    >
                      <p className="font-medium text-(--text-primary)">{link.label}</p>
                      <p className="mt-1 text-sm text-(--text-muted)">{link.description}</p>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}

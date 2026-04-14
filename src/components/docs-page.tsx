import { useEffect, useMemo, useState } from "react";
import { PageShell } from "./page-shell";
import {
  getDockerCommand,
  riskLabels,
  type DockerCommandId,
  type DockerCommandMetadata,
  type DockerCommandRisk,
} from "../lib/docker-command-registry";
import { dockerCommandLessons, isAdvancedLesson, type DockerCommandLessonId } from "../lib/docker-command-lessons";

import { alertInfo, riskBadgeClasses, statusBadgeInfo } from "../lib/theme-classes";

const safetyLegend: { risk: DockerCommandRisk; title: string; body: string }[] = [
  {
    risk: "safe",
    title: "Safe",
    body: "Reads information only. Nothing on your machine is changed.",
  },
  {
    risk: "medium",
    title: "Caution",
    body: "Starts, stops, or changes resources. Review flags before running.",
  },
  {
    risk: "destructive",
    title: "Destructive",
    body: "Can delete containers, images, volumes, or free disk space.",
  },
];

const getUniqueCommandCount = () => new Set(dockerCommandLessons.flatMap((lesson) => lesson.commandIds)).size;

const getAdvancedCommandCount = () =>
  new Set(dockerCommandLessons.filter(isAdvancedLesson).flatMap((lesson) => lesson.commandIds)).size;

const countCommandsByRisk = (commands: DockerCommandMetadata[], risk: DockerCommandRisk) =>
  commands.filter((command) => command.risk === risk).length;

const COMMAND_TARGET_HIGHLIGHT_MS = 2500;

type CommandLessonCardProps = {
  command: DockerCommandMetadata;
  isHighlighted?: boolean;
  onOpenPlayground: (example: string) => void;
};

function CommandLessonCard({ command, isHighlighted = false, onOpenPlayground }: CommandLessonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (command.prerequisites && command.prerequisites.length > 0) ||
    (command.relatedIds && command.relatedIds.length > 0);

  return (
    <article
      className={`rounded-xl border border-(--border) bg-(--surface) p-4 transition hover:border-(--accent)/40 ${
        isHighlighted ? "border-(--accent) ring-2 ring-(--accent)/50 shadow-[0_0_0_1px_var(--accent)]" : ""
      }`}
      data-command-id={command.id}
      data-testid={`docs-command-${command.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-(--text-muted)">
              {command.category}
            </p>
            {command.advanced ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${statusBadgeInfo}`}
              >
                Advanced
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-base font-semibold text-(--text-primary)">{command.label}</h3>
          <p className="mt-2 text-sm leading-6 text-(--text-muted)">{command.description}</p>
          {command.proTip ? (
            <p className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${alertInfo}`}>
              <span className="font-semibold">Pro tip: </span>
              {command.proTip}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] leading-4 font-medium ${riskBadgeClasses[command.risk]}`}
        >
          {riskLabels[command.risk]}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-(--text-muted)">
            Command pattern
          </p>
          <code className="block overflow-x-auto rounded-lg border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs text-(--code-text)">
            {command.cli}
          </code>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-(--text-muted)">Example</p>
            <button
              className="text-xs font-medium text-(--accent) transition hover:text-(--accent-hover)"
              type="button"
              onClick={() => onOpenPlayground(command.example)}
            >
              Open in Playground
            </button>
          </div>
          <code className="block overflow-x-auto rounded-lg border border-(--accent)/30 bg-(--accent-soft) px-3 py-2 font-mono text-xs text-(--text-primary)">
            {command.example}
          </code>
        </div>
      </div>

      {command.whenToUse ? (
        <p className="mt-3 text-xs leading-5 text-(--text-secondary)">
          <span className="font-medium text-(--text-muted)">When to use: </span>
          {command.whenToUse}
        </p>
      ) : null}

      {hasDetails ? (
        <button
          className="mt-3 text-xs font-medium text-(--accent) transition hover:text-(--accent-hover)"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Hide details" : "Show setup & related commands"}
        </button>
      ) : null}

      {expanded && hasDetails ? (
        <div className="mt-3 space-y-3 rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-3 text-xs">
          {command.prerequisites && command.prerequisites.length > 0 ? (
            <div>
              <p className="font-medium uppercase tracking-[0.12em] text-(--text-muted)">Prerequisites</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-(--text-secondary)">
                {command.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {command.relatedIds && command.relatedIds.length > 0 ? (
            <div>
              <p className="font-medium uppercase tracking-[0.12em] text-(--text-muted)">Related</p>
              <ul className="mt-1 space-y-1">
                {command.relatedIds.map((relatedId: DockerCommandId) => {
                  const related = getDockerCommand(relatedId);
                  return (
                    <li
                      key={relatedId}
                      className="text-(--text-secondary)"
                    >
                      {related.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type DocsPageProps = {
  initialLessonId?: DockerCommandLessonId;
  initialCommandId?: DockerCommandId;
  onCommandTargetConsumed?: () => void;
  onOpenPlayground: (example: string) => void;
};

export function DocsPage({
  initialLessonId = "first-steps",
  initialCommandId,
  onCommandTargetConsumed,
  onOpenPlayground,
}: DocsPageProps) {
  const [activeLessonId, setActiveLessonId] = useState<DockerCommandLessonId>(initialLessonId);
  const [highlightedCommandId, setHighlightedCommandId] = useState<DockerCommandId | undefined>();

  useEffect(() => {
    setActiveLessonId(initialLessonId);
  }, [initialLessonId]);

  const lessonCommands = useMemo(() => {
    const activeLesson = dockerCommandLessons.find((lesson) => lesson.id === activeLessonId);
    if (!activeLesson) {
      return [];
    }
    return activeLesson.commandIds.map((id) => getDockerCommand(id)).filter(Boolean);
  }, [activeLessonId]);

  useEffect(() => {
    if (!initialCommandId) {
      return;
    }

    const commandIsInLesson = lessonCommands.some((command) => command.id === initialCommandId);
    if (!commandIsInLesson) {
      onCommandTargetConsumed?.();
      return;
    }

    setHighlightedCommandId(initialCommandId);

    const scrollFrame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-command-id="${initialCommandId}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedCommandId(undefined);
      onCommandTargetConsumed?.();
    }, COMMAND_TARGET_HIGHLIGHT_MS);

    return () => {
      cancelAnimationFrame(scrollFrame);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [initialCommandId, activeLessonId, lessonCommands, onCommandTargetConsumed]);

  const activeLesson = useMemo(
    () => dockerCommandLessons.find((lesson) => lesson.id === activeLessonId),
    [activeLessonId]
  );

  const totalCommandCount = useMemo(() => getUniqueCommandCount(), []);
  const advancedCommandCount = useMemo(() => getAdvancedCommandCount(), []);
  const safeCommandCount = countCommandsByRisk(lessonCommands, "safe");
  const cautionCommandCount = countCommandsByRisk(lessonCommands, "medium");
  const destructiveCommandCount = countCommandsByRisk(lessonCommands, "destructive");

  return (
    <PageShell
      description="A compact Docker course with real examples, risk labels, and every registry command grouped by workflow."
      errorMessage={null}
      isLoading={false}
      title="Docs"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 sm:p-6 lg:flex-row lg:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="rounded-2xl border border-(--border) bg-(--surface) px-4 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--accent)">
              Docker command school
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary) sm:text-3xl">
              Learn Docker commands without memorizing everything
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-(--text-muted)">
              Pick a workflow, learn what each command changes, and copy a real example when you are ready to try it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs ${riskBadgeClasses.safe}`}>Safe first</span>
              <span className="rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs text-(--text-secondary)">
                {totalCommandCount} commands covered
              </span>
              <span className={`rounded-full px-3 py-1 text-xs ${statusBadgeInfo}`}>
                {advancedCommandCount} advanced lifesavers
              </span>
              <span className="rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs text-(--text-secondary)">
                Real examples included
              </span>
              <span className="rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs text-(--text-secondary)">
                Risk labeled
              </span>
            </div>
          </section>

          {activeLesson ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-(--text-primary)">{activeLesson.title}</h3>
                      {isAdvancedLesson(activeLesson) ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${statusBadgeInfo}`}
                        >
                          Advanced
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-(--text-muted)">{activeLesson.subtitle}</p>
                    <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
                      <span className="font-medium text-(--text-primary)">Lesson goal: </span>
                      {activeLesson.goal}
                    </p>
                  </div>
                  <div className="grid min-w-40 grid-cols-3 gap-2 text-center text-xs">
                    <div className={`rounded-lg px-2 py-2 ${riskBadgeClasses.safe}`}>
                      <p className="text-base font-semibold">{safeCommandCount}</p>
                      <p>safe</p>
                    </div>
                    <div className={`rounded-lg px-2 py-2 ${riskBadgeClasses.medium}`}>
                      <p className="text-base font-semibold">{cautionCommandCount}</p>
                      <p>caution</p>
                    </div>
                    <div className={`rounded-lg px-2 py-2 ${riskBadgeClasses.destructive}`}>
                      <p className="text-base font-semibold">{destructiveCommandCount}</p>
                      <p>delete</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {lessonCommands.map((command) => (
                  <CommandLessonCard
                    key={command.id}
                    command={command}
                    isHighlighted={highlightedCommandId === command.id}
                    onOpenPlayground={onOpenPlayground}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <section className="rounded-xl border border-(--border) bg-(--surface) p-4">
            <h3 className="text-sm font-semibold text-(--text-primary)">Course map</h3>
            <p className="mt-1 text-xs leading-5 text-(--text-muted)">
              The docs now cover the command registry by workflow, not just a sampler.
            </p>
            <div className="mt-4 space-y-2">
              {dockerCommandLessons.map((lesson, index) => {
                const isActive = lesson.id === activeLessonId;
                const showAdvancedDivider =
                  index > 0 && isAdvancedLesson(lesson) && !isAdvancedLesson(dockerCommandLessons[index - 1]);
                return (
                  <div key={lesson.id}>
                    {showAdvancedDivider ? (
                      <p className="mb-2 mt-3 px-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-(--status-info-text)">
                        Advanced playbook
                      </p>
                    ) : null}
                    <button
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                          : "border-(--border) bg-(--surface-elevated) text-(--text-secondary) hover:border-(--accent)/40 hover:text-(--text-primary)"
                      }`}
                      type="button"
                      onClick={() => {
                        setHighlightedCommandId(undefined);
                        setActiveLessonId(lesson.id);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="mr-2 font-mono text-[0.65rem] opacity-70">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {lesson.title}
                      </span>
                      <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[0.65rem]">
                        {lesson.commandIds.length}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-(--border) bg-(--surface) p-4">
            <h3 className="text-sm font-semibold text-(--text-primary)">Safety at a glance</h3>
            <p className="mt-1 text-xs leading-5 text-(--text-muted)">
              Every command is labeled so you know what you are about to run.
            </p>
            <ul className="mt-4 space-y-3">
              {safetyLegend.map((item) => (
                <li
                  className="flex items-start gap-3"
                  key={item.risk}
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] leading-4 font-medium ${riskBadgeClasses[item.risk]}`}
                  >
                    {item.title}
                  </span>
                  <p className="text-xs leading-5 text-(--text-muted)">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-(--border) bg-(--surface) p-4">
            <h3 className="text-sm font-semibold text-(--text-primary)">How to use this page</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-(--text-muted)">
              <li>Start with read-only lessons if you are unsure.</li>
              <li>Compare the command pattern with the concrete example.</li>
              <li>Open details before commands that change or delete resources.</li>
            </ol>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

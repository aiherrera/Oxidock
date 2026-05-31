import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import {
  getDockerCommand,
  riskLabels,
  type DockerCommandId,
  type DockerCommandMetadata,
} from "../lib/docker-command-registry";
import { type CommandSuggestion } from "../lib/docker-command-suggestions";
import { riskBadgeClasses } from "../lib/theme-classes";

const registryIssueUrl = "https://github.com/aiherrera/oxidock/issues/new";

type CliCommandInspectorProps = {
  commandText: string;
  focusedSuggestion: CommandSuggestion | null;
  registryMatch: DockerCommandMetadata | null;
  onSelectCommand: (command: string) => void;
  className?: string;
};

const resolveDisplayMetadata = (
  focusedSuggestion: CommandSuggestion | null,
  registryMatch: DockerCommandMetadata | null
): DockerCommandMetadata | null => {
  if (focusedSuggestion?.registryId) {
    return getDockerCommand(focusedSuggestion.registryId);
  }
  return registryMatch;
};

const buildRegistryIssueUrl = (command: string) => {
  const issueParams = new URLSearchParams({
    template: "feature_request.yml",
    title: `[feature]: Add ${command} to the curated Docker command registry`,
    problem: `The command \`${command}\` is currently treated as a custom command in Oxidock, so users do not get curated guidance, risk metadata, examples, or related commands for it.`,
    proposal: `Add \`${command}\` to the curated Docker command registry with an appropriate description, example, risk level, prerequisites, and related commands.`,
    alternatives: "Continue running this as a custom command and checking the official Docker CLI reference manually.",
  });

  return `${registryIssueUrl}?${issueParams.toString()}`;
};

export function CliCommandInspector({
  commandText,
  focusedSuggestion,
  registryMatch,
  onSelectCommand,
  className = "",
}: CliCommandInspectorProps) {
  const metadata = resolveDisplayMetadata(focusedSuggestion, registryMatch);
  const trimmed = commandText.trim();
  const [issueOpenError, setIssueOpenError] = useState<string | null>(null);

  const openRegistryIssue = async (command: string) => {
    setIssueOpenError(null);

    try {
      await openUrl(buildRegistryIssueUrl(command));
    } catch {
      setIssueOpenError("Could not open GitHub. Restart Oxidock and try again.");
    }
  };

  if (!trimmed && !metadata) {
    return (
      <div className={`flex h-full flex-col rounded-xl border border-(--border) bg-(--surface) ${className}`}>
        <div className="border-b border-(--border) px-4 py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted)">Command guide</p>
          <h2 className="mt-1 text-lg font-semibold text-(--text-primary)">Learn as you type</h2>
        </div>
        <div className="flex flex-1 flex-col justify-center px-4 py-6">
          <p className="text-sm leading-6 text-(--text-muted)">
            Type a docker command or describe what you want to do. Suggestions, examples, risk, and related commands
            will appear here.
          </p>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className={`flex h-full flex-col rounded-xl border border-(--border) bg-(--surface) ${className}`}>
        <div className="border-b border-(--border) px-4 py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted)">Command guide</p>
          <h2 className="mt-1 text-lg font-semibold text-(--text-primary)">Custom command</h2>
        </div>
        <div className="space-y-4 px-4 py-4">
          <p className="text-sm leading-6 text-(--text-muted)">
            This command is not in the curated registry. It will still run if it is a valid docker subcommand. Check the
            official Docker CLI reference before running unfamiliar flags.
          </p>
          {trimmed ? (
            <code className="block rounded-lg border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs text-(--code-text)">
              {trimmed}
            </code>
          ) : null}
          {trimmed ? (
            <button
              className="inline-flex rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-xs font-medium text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary)"
              type="button"
              onClick={() => void openRegistryIssue(trimmed)}
            >
              Request registry support on GitHub
            </button>
          ) : null}
          {issueOpenError ? (
            <p
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
              role="alert"
            >
              {issueOpenError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const relatedIds = metadata.relatedIds ?? [];

  return (
    <aside className={`flex h-full flex-col rounded-xl border border-(--border) bg-(--surface) ${className}`}>
      <div className="border-b border-(--border) px-4 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-(--text-muted)">Command guide</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-6 text-(--text-primary)">{metadata.label}</h2>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${riskBadgeClasses[metadata.risk]}`}
          >
            {riskLabels[metadata.risk]}
          </span>
        </div>
        {focusedSuggestion ? (
          <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-(--text-muted)">
            Source: {focusedSuggestion.source}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
        <section>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">What it does</p>
          <p className="mt-2 text-sm leading-6 text-(--text-muted)">{metadata.description}</p>
        </section>

        {metadata.whenToUse ? (
          <section className="rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">When to use</p>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">{metadata.whenToUse}</p>
          </section>
        ) : null}

        <section>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Example</p>
          <code className="mt-2 block rounded-lg border border-(--border) bg-(--code-bg) px-3 py-2 font-mono text-xs leading-5 text-(--code-text)">
            {metadata.example}
          </code>
        </section>

        {metadata.prerequisites && metadata.prerequisites.length > 0 ? (
          <section>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">
              Prerequisites
            </p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-(--text-muted)">
              {metadata.prerequisites.map((item) => (
                <li
                  className="flex gap-2"
                  key={item}
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-(--accent)" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {relatedIds.length > 0 ? (
          <section>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">
              Related commands
            </p>
            <div className="mt-2 grid gap-2">
              {relatedIds.map((relatedId: DockerCommandId) => {
                const related = getDockerCommand(relatedId);
                return (
                  <button
                    key={relatedId}
                    className="rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-left text-xs text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary)"
                    type="button"
                    onClick={() => onSelectCommand(related.example)}
                  >
                    <span className="block font-medium">{related.label}</span>
                    <code className="mt-1 block truncate font-mono text-[0.65rem] text-(--text-muted)">
                      {related.example}
                    </code>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

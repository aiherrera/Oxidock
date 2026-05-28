import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PageShell } from "./page-shell";
import { CliCommandAutocomplete } from "./cli-command-autocomplete";
import { CliCommandInspector } from "./cli-command-inspector";
import { DestructiveCommandDialog } from "./destructive-command-dialog";
import { resolveRegistryCommand } from "../lib/docker-command-resolver";
import { getDestructiveConfirmationPhrase } from "../lib/destructive-command-confirmation";
import { loadCliPlaygroundSettings, type CliPlaygroundSettings } from "../lib/cli-playground-settings";
import { type CommandSuggestion } from "../lib/docker-command-suggestions";
import { toErrorMessage } from "../lib/search-utils";
import { alertDanger, alertWarningSubtle, statusBadgeDanger, statusBadgeSuccess } from "../lib/theme-classes";
import { classifyDockerCommand, runDockerCommand } from "../lib/tauri-docker";
import type { DockerCommandResult, DockerStatus } from "../types/docker";

export type CliHistoryEntry = {
  command: string;
  result: DockerCommandResult;
  ranWithoutProtection?: boolean;
  registryExplanation?: string;
};

type PendingDestructiveRun = {
  command: string;
  normalized: string;
  reasons: string[];
  confirmationPhrase: string;
};

type CliPlaygroundPageProps = {
  command?: string;
  dockerStatus: DockerStatus | null;
  errorMessage?: string | null;
  history?: CliHistoryEntry[];
  initialCommand?: string;
  isRunning?: boolean;
  setCommand?: Dispatch<SetStateAction<string>>;
  setErrorMessage?: Dispatch<SetStateAction<string | null>>;
  setHistory?: Dispatch<SetStateAction<CliHistoryEntry[]>>;
  setIsRunning?: Dispatch<SetStateAction<boolean>>;
  onOpenSettingsPage: () => void;
  onInitialCommandApplied?: () => void;
};

export function CliPlaygroundPage({
  command: controlledCommand,
  dockerStatus,
  errorMessage: controlledErrorMessage,
  history: controlledHistory,
  initialCommand,
  isRunning: controlledIsRunning,
  setCommand: setControlledCommand,
  setErrorMessage: setControlledErrorMessage,
  setHistory: setControlledHistory,
  setIsRunning: setControlledIsRunning,
  onOpenSettingsPage,
  onInitialCommandApplied,
}: CliPlaygroundPageProps) {
  const [localCommand, setLocalCommand] = useState(() => initialCommand ?? "docker ps");
  const [localHistory, setLocalHistory] = useState<CliHistoryEntry[]>([]);
  const [localIsRunning, setLocalIsRunning] = useState(false);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState<CommandSuggestion | null>(null);
  const [settings] = useState<CliPlaygroundSettings>(() => loadCliPlaygroundSettings());
  const [pendingDestructiveRun, setPendingDestructiveRun] = useState<PendingDestructiveRun | null>(null);
  const outputRef = useRef<HTMLElement>(null);
  const command = controlledCommand ?? localCommand;
  const history = controlledHistory ?? localHistory;
  const isRunning = controlledIsRunning ?? localIsRunning;
  const errorMessage = controlledErrorMessage ?? localErrorMessage;
  const setCommand = setControlledCommand ?? setLocalCommand;
  const setHistory = setControlledHistory ?? setLocalHistory;
  const setIsRunning = setControlledIsRunning ?? setLocalIsRunning;
  const setErrorMessage = setControlledErrorMessage ?? setLocalErrorMessage;

  useEffect(() => {
    if (!initialCommand) {
      return;
    }

    setCommand(initialCommand);
    setHighlightedSuggestion(null);
    setErrorMessage(null);
    onInitialCommandApplied?.();
  }, [initialCommand, onInitialCommandApplied, setCommand, setErrorMessage]);

  const registryMatch = useMemo(() => resolveRegistryCommand(command), [command]);

  const historyCommands = useMemo(() => history.map((entry) => entry.command), [history]);

  const executeCommand = useCallback(
    async (trimmed: string, options?: { ranWithoutProtection?: boolean; confirmDestructive?: boolean }) => {
      setIsRunning(true);
      setErrorMessage(null);

      try {
        const result = await runDockerCommand(trimmed, {
          confirmDestructive: options?.confirmDestructive ?? false,
        });
        const match = resolveRegistryCommand(trimmed);
        setHistory((current) =>
          [
            {
              command: trimmed,
              result,
              ranWithoutProtection: options?.ranWithoutProtection,
              registryExplanation: match?.explanation,
            },
            ...current,
          ].slice(0, 20)
        );
      } catch (error) {
        setErrorMessage(toErrorMessage(error, "Failed to run docker command."));
      } finally {
        setIsRunning(false);
      }
    },
    [setErrorMessage, setHistory, setIsRunning]
  );

  const runCommand = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed) {
      setErrorMessage("Enter a docker command to run.");
      return;
    }

    if (!dockerStatus?.isRunning) {
      setErrorMessage("Docker does not appear to be running. Start Docker Engine before running commands.");
      return;
    }

    try {
      const classification = await classifyDockerCommand(trimmed);

      if (classification.risk === "destructive" && settings.destructiveProtectionEnabled) {
        setPendingDestructiveRun({
          command: trimmed,
          normalized: classification.normalized,
          reasons: classification.reasons,
          confirmationPhrase: getDestructiveConfirmationPhrase(classification.normalized),
        });
        return;
      }

      const isDestructive = classification.risk === "destructive";
      await executeCommand(classification.normalized, {
        ranWithoutProtection: isDestructive && !settings.destructiveProtectionEnabled,
        confirmDestructive: isDestructive,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to validate docker command."));
    }
  }, [command, dockerStatus?.isRunning, executeCommand, setErrorMessage, settings.destructiveProtectionEnabled]);

  useEffect(() => {
    outputRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [history]);

  const latest = history[0];

  return (
    <PageShell
      description="Run arbitrary docker commands locally. Output is captured from the docker CLI."
      errorMessage={errorMessage}
      isLoading={isRunning}
      title="CLI Playground"
      actions={
        <button
          className={`inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm transition hover:opacity-90 ${statusBadgeDanger}`}
          type="button"
          onClick={() => {
            setHistory([]);
            setErrorMessage(null);
          }}
        >
          Clear output
        </button>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-h-0 flex-col gap-4">
          <form
            className="flex flex-col gap-3 lg:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void runCommand();
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              <span className="font-medium text-(--text-secondary)">Command</span>
              <CliCommandAutocomplete
                disabled={isRunning}
                historyCommands={historyCommands}
                placeholder="docker ps -a or describe what you want…"
                value={command}
                onChange={setCommand}
                onHighlightChange={setHighlightedSuggestion}
                onSubmit={() => void runCommand()}
              />
            </label>
            <button
              className="inline-flex min-h-11 items-center justify-center self-end rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white transition hover:bg-(--accent-hover) disabled:opacity-60 lg:self-auto lg:mt-7"
              disabled={isRunning}
              type="submit"
            >
              {isRunning ? "Running…" : "Run"}
            </button>
          </form>

          <p className="text-xs leading-5 text-(--text-muted)">
            Commands execute directly against your local Docker CLI without a shell.
            {settings.destructiveProtectionEnabled
              ? " Destructive commands such as prune or rm require confirmation before they run."
              : " Destructive command protection is off — commands run immediately."}{" "}
            Use <kbd className="rounded border border-(--border) px-1">↑</kbd> in the input to recall previous commands.
          </p>

          {latest ? (
            <section
              className="flex min-h-0 flex-1 flex-col gap-3"
              ref={outputRef}
            >
              {latest.registryExplanation ? (
                <p className="text-xs text-(--text-secondary)">You ran: {latest.registryExplanation}</p>
              ) : null}

              {latest.ranWithoutProtection ? (
                <p className={`rounded-md px-3 py-2 text-xs ${alertWarningSubtle}`}>
                  This destructive command ran without confirmation because CLI safety protection is turned off in
                  settings.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-(--text-muted)">{latest.command}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    latest.result.exitCode === 0 ? statusBadgeSuccess : statusBadgeDanger
                  }`}
                >
                  exit {latest.result.exitCode}
                </span>
              </div>

              {latest.result.stdout ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-(--text-muted)">stdout</p>
                  <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--border) bg-(--code-bg) p-3 font-mono text-xs leading-5 text-(--code-text)">
                    {latest.result.stdout}
                  </pre>
                </div>
              ) : null}

              {latest.result.stderr ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-(--text-muted)">stderr</p>
                  <pre className={`max-h-48 overflow-auto rounded-lg p-3 font-mono text-xs leading-5 ${alertDanger}`}>
                    {latest.result.stderr}
                  </pre>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-(--border) p-10 text-center text-sm text-(--text-muted)">
              Run a command to see stdout and stderr here.
            </div>
          )}

          {history.length > 1 ? (
            <details className="rounded-lg border border-(--border) bg-(--surface) p-3">
              <summary className="cursor-pointer text-sm font-medium text-(--text-secondary)">
                Command history ({history.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {history.slice(1).map((entry) => (
                  <li key={`${entry.command}-${entry.result.exitCode}`}>
                    <button
                      className="w-full rounded-md px-2 py-2 text-left font-mono text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
                      type="button"
                      onClick={() => setCommand(entry.command)}
                    >
                      {entry.command}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <CliCommandInspector
          className="min-h-88 lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)]"
          commandText={command}
          focusedSuggestion={highlightedSuggestion}
          registryMatch={registryMatch}
          onSelectCommand={setCommand}
        />
      </div>

      <DestructiveCommandDialog
        command={pendingDestructiveRun?.normalized ?? ""}
        open={pendingDestructiveRun !== null}
        confirmationPhrase={pendingDestructiveRun?.confirmationPhrase ?? "Oxidock"}
        reasons={pendingDestructiveRun?.reasons ?? []}
        registryMatch={pendingDestructiveRun ? resolveRegistryCommand(pendingDestructiveRun.normalized) : null}
        onCancel={() => setPendingDestructiveRun(null)}
        onConfirm={() => {
          const pending = pendingDestructiveRun;
          setPendingDestructiveRun(null);
          if (pending) {
            void executeCommand(pending.normalized, { confirmDestructive: true });
          }
        }}
        onOpenSettings={() => {
          setPendingDestructiveRun(null);
          onOpenSettingsPage();
        }}
      />
    </PageShell>
  );
}

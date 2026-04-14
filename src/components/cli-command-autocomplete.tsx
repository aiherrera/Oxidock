import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { riskLabels } from "../lib/docker-command-registry";
import { riskBadgeClasses } from "../lib/theme-classes";
import {
  applyCompletion,
  computeInlineSuffix,
  getCommandSuggestions,
  isDockerCommandInput,
  type CommandSuggestion,
  type SuggestionSource,
} from "../lib/docker-command-suggestions";
import { getIntentSuggestions } from "../lib/docker-intent-matcher";
import { getLocalAiAssistantStatus, suggestDockerCommands, type AiCommandSuggestion } from "../lib/local-ai-assistant";

type CliCommandAutocompleteProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onHighlightChange?: (suggestion: CommandSuggestion | null) => void;
  historyCommands?: string[];
};

const sourceLabels: Record<SuggestionSource, string> = {
  registry: "Registry",
  intent: "Intent",
  ai: "AI",
};

export function CliCommandAutocomplete({
  value,
  disabled = false,
  placeholder = "docker ps -a or describe what you want…",
  onChange,
  onSubmit,
  onHighlightChange,
  historyCommands = [],
}: CliCommandAutocompleteProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [suggestionQuery, setSuggestionQuery] = useState(value);
  const [aiInstalled, setAiInstalled] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<CommandSuggestion[]>([]);
  const aiRequestIdRef = useRef(0);
  const historyIndexRef = useRef<number | null>(null);
  const isPreviewingSuggestionRef = useRef(false);

  const intentMode = useMemo(() => {
    const trimmed = suggestionQuery.trim();
    return trimmed.length >= 3 && !isDockerCommandInput(trimmed);
  }, [suggestionQuery]);

  const registryResult = useMemo(() => {
    if (intentMode) {
      return getIntentSuggestions(suggestionQuery);
    }
    return getCommandSuggestions(suggestionQuery);
  }, [intentMode, suggestionQuery]);

  useEffect(() => {
    void getLocalAiAssistantStatus()
      .then((status) => setAiInstalled(status.state === "installed"))
      .catch(() => setAiInstalled(false));
  }, []);

  useEffect(() => {
    if (disabled || intentMode || !aiInstalled) {
      setAiSuggestions([]);
      return;
    }

    const trimmed = suggestionQuery.trim();
    if (!trimmed || !isDockerCommandInput(trimmed)) {
      setAiSuggestions([]);
      return;
    }

    const requestId = (aiRequestIdRef.current += 1);
    const timeoutId = window.setTimeout(() => {
      void suggestDockerCommands(trimmed)
        .then((response) => {
          if (aiRequestIdRef.current !== requestId) {
            return;
          }

          const mapped: CommandSuggestion[] = response.suggestions
            .slice(0, 2)
            .map((suggestion: AiCommandSuggestion) => ({
              id: suggestion.id,
              label: suggestion.label,
              completion: suggestion.completion,
              explanation: suggestion.explanation,
              description: suggestion.explanation,
              risk: suggestion.risk,
              score: suggestion.confidence,
              source: "ai" as const,
            }));

          setAiSuggestions(mapped);
        })
        .catch(() => {
          if (aiRequestIdRef.current !== requestId) {
            return;
          }
          setAiSuggestions([]);
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [aiInstalled, disabled, intentMode, suggestionQuery]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...registryResult.suggestions, ...aiSuggestions].filter((suggestion) => {
      const key = suggestion.completion.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return merged.slice(0, 8);
  }, [aiSuggestions, registryResult.suggestions]);

  const inlineSuffix = computeInlineSuffix(value, suggestions[0]?.completion);

  const showSuggestions = isFocused && suggestions.length > 0;
  const highlighted = suggestions[highlightIndex] ?? suggestions[0] ?? null;

  useEffect(() => {
    if (isPreviewingSuggestionRef.current) {
      isPreviewingSuggestionRef.current = false;
      return;
    }

    setSuggestionQuery(value);
    setHighlightIndex(0);
    historyIndexRef.current = null;
  }, [value, suggestions.length]);

  useEffect(() => {
    onHighlightChange?.(highlighted);
  }, [highlighted, onHighlightChange]);

  const selectSuggestion = useCallback(
    (suggestion: CommandSuggestion) => {
      setSuggestionQuery(suggestion.completion);
      onChange(suggestion.completion);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const acceptInlineCompletion = useCallback(() => {
    if (inlineSuffix) {
      const completed = value + inlineSuffix;
      setSuggestionQuery(completed);
      onChange(completed);
      return true;
    }
    if (highlighted) {
      const completed = applyCompletion(value, highlighted.completion);
      setSuggestionQuery(completed);
      onChange(completed);
      return true;
    }
    return false;
  }, [highlighted, inlineSuffix, onChange, value]);

  const previewSuggestionAtIndex = useCallback(
    (index: number) => {
      const suggestion = suggestions[index];
      if (!suggestion) {
        return;
      }

      isPreviewingSuggestionRef.current = true;
      setHighlightIndex(index);
      onHighlightChange?.(suggestion);
      onChange(suggestion.completion);
    },
    [onChange, onHighlightChange, suggestions]
  );

  const recallHistory = useCallback(
    (direction: "up" | "down") => {
      if (historyCommands.length === 0) {
        return false;
      }

      if (historyIndexRef.current === null) {
        historyIndexRef.current = direction === "up" ? 0 : historyCommands.length - 1;
      } else if (direction === "up") {
        historyIndexRef.current = Math.min(historyIndexRef.current + 1, historyCommands.length - 1);
      } else {
        historyIndexRef.current = Math.max(historyIndexRef.current - 1, 0);
      }

      const nextCommand = historyCommands[historyIndexRef.current];
      if (nextCommand) {
        onChange(nextCommand);
      }
      return true;
    },
    [historyCommands, onChange]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      if (showSuggestions && (inlineSuffix || highlighted)) {
        event.preventDefault();
        acceptInlineCompletion();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      if (showSuggestions && !event.altKey) {
        event.preventDefault();
        const nextIndex = Math.min(highlightIndex + 1, suggestions.length - 1);
        previewSuggestionAtIndex(nextIndex);
        return;
      }
    }

    if (event.key === "ArrowUp") {
      if (showSuggestions && !event.altKey && highlightIndex > 0) {
        event.preventDefault();
        const nextIndex = Math.max(highlightIndex - 1, 0);
        previewSuggestionAtIndex(nextIndex);
        return;
      }

      if (historyCommands.length > 0) {
        event.preventDefault();
        recallHistory("up");
      }
      return;
    }

    if (event.key === "ArrowDown" && historyCommands.length > 0 && !showSuggestions) {
      event.preventDefault();
      recallHistory("down");
      return;
    }

    if (event.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (event.key === "Enter" && showSuggestions && event.shiftKey && highlighted) {
      event.preventDefault();
      selectSuggestion(highlighted);
    }
  };

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-2">
      <div className="relative min-h-11 rounded-lg border border-(--border) bg-(--surface) focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--accent)">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 py-2 font-mono text-sm"
        >
          <span className="invisible whitespace-pre">{value}</span>
          {inlineSuffix && isFocused ? (
            <span className="whitespace-pre text-(--text-muted) opacity-70">{inlineSuffix}</span>
          ) : null}
        </div>
        <input
          ref={inputRef}
          aria-activedescendant={showSuggestions && highlighted ? `${listboxId}-option-${highlightIndex}` : undefined}
          aria-autocomplete="both"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="relative z-10 min-h-11 w-full rounded-lg bg-transparent px-3 py-2 font-mono text-sm text-(--text-primary)"
          disabled={disabled}
          placeholder={placeholder}
          role="combobox"
          spellCheck={false}
          type="text"
          value={value}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          onChange={(event) => {
            setSuggestionQuery(event.target.value);
            onChange(event.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
        />
        {inlineSuffix && isFocused ? (
          <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 text-[0.65rem] text-(--text-muted)">
            Tab
          </span>
        ) : null}
      </div>

      {showSuggestions ? (
        <ul
          className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-(--border) bg-(--surface-elevated) py-1 shadow-xl"
          id={listboxId}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightIndex;
            return (
              <li
                key={`${suggestion.id}-${suggestion.completion}`}
                aria-selected={isHighlighted}
                id={`${listboxId}-option-${index}`}
                role="option"
              >
                <button
                  className={`flex w-full flex-col gap-1 px-3 py-2 text-left transition ${
                    isHighlighted
                      ? "bg-(--accent-soft) text-(--text-primary)"
                      : "text-(--text-secondary) hover:bg-(--surface-hover)"
                  }`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-xs text-(--text-primary)">{suggestion.completion}</code>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full border border-(--border) px-2 py-0.5 text-[0.6rem] text-(--text-muted)">
                        {sourceLabels[suggestion.source]}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${riskBadgeClasses[suggestion.risk]}`}
                      >
                        {riskLabels[suggestion.risk]}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-(--text-muted)">{suggestion.explanation}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {highlighted && (isFocused || value.length > 0) ? (
        <div className="rounded-lg border border-(--border) bg-(--surface) px-3 py-2 lg:hidden">
          <p className="text-xs font-medium text-(--text-secondary)">{highlighted.label}</p>
          <p className="mt-1 text-xs leading-5 text-(--text-muted)">{highlighted.description}</p>
          <p className="mt-2 text-[0.65rem] text-(--text-muted)">
            Press <kbd className="rounded border border-(--border) px-1">Tab</kbd> to complete ·{" "}
            <kbd className="rounded border border-(--border) px-1">↑↓</kbd> to browse ·{" "}
            <kbd className="rounded border border-(--border) px-1">Enter</kbd> {onSubmit ? "to run" : "to submit"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { flattenSearchGroups } from "../lib/intelligent-search";
import type { IntelligentSearchGroup, IntelligentSearchResult } from "../types/intelligent-search";
import {
  alertWarning,
  statusBadgeInfo,
  statusBadgeLocal,
  statusBadgeSuccess,
  statusBadgeWarning,
} from "../lib/theme-classes";
import { IconSearch } from "./icons";

type GlobalSearchPaletteProps = {
  searchQuery: string;
  searchShortcutLabel?: string;
  groups: IntelligentSearchGroup[];
  isSearchingRegistry: boolean;
  registryMessage: string | null;
  onSearchChange: (query: string) => void;
  onSelectResult: (result: IntelligentSearchResult) => void;
  onOpenChange?: (open: boolean) => void;
};

const scopeBadgeClasses: Record<IntelligentSearchResult["scope"], string> = {
  local: statusBadgeLocal,
  registry: statusBadgeInfo,
  learn: statusBadgeSuccess,
  docs: statusBadgeWarning,
};

export type GlobalSearchPaletteHandle = {
  focusSearch: () => void;
};

export const GlobalSearchPalette = forwardRef<GlobalSearchPaletteHandle, GlobalSearchPaletteProps>(
  function GlobalSearchPalette(
    {
      searchQuery,
      searchShortcutLabel = "⌘K",
      groups,
      isSearchingRegistry,
      registryMessage,
      onSearchChange,
      onSelectResult,
      onOpenChange,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const flatResults = useMemo(() => flattenSearchGroups(groups), [groups]);
    const showPanel = isOpen && searchQuery.trim().length > 0;

    const setOpen = useCallback(
      (next: boolean) => {
        setIsOpen(next);
        onOpenChange?.(next);
      },
      [onOpenChange]
    );

    useEffect(() => {
      setActiveIndex(0);
    }, [searchQuery, groups]);

    useEffect(() => {
      if (!showPanel || !listRef.current) {
        return;
      }

      const activeElement = listRef.current.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`);
      activeElement?.scrollIntoView?.({ block: "nearest" });
    }, [activeIndex, showPanel]);

    const handleSelect = useCallback(
      (result: IntelligentSearchResult) => {
        onSelectResult(result);
        setOpen(false);
      },
      [onSelectResult, setOpen]
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
        return;
      }

      if (!showPanel || flatResults.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1 >= flatResults.length ? 0 : current + 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 < 0 ? flatResults.length - 1 : current - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = flatResults[activeIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    };

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      },
    }));

    const listboxId = "global-search-results";
    const activeOptionId = showPanel && flatResults.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined;

    let resultOffset = 0;

    return (
      <div className="relative w-full">
        <label className="relative block">
          <span className="sr-only">Search resources, registries, and docs</span>
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <input
            ref={inputRef}
            aria-activedescendant={activeOptionId}
            aria-controls={showPanel ? listboxId : undefined}
            aria-expanded={showPanel}
            className="w-full rounded-md border border-(--border) bg-(--surface) py-1.5 pr-14 pl-9 text-sm text-(--text-primary) outline-none placeholder:text-(--text-muted) focus:border-(--accent)/60 focus:ring-1 focus:ring-(--accent)/30"
            placeholder="Search containers, images, lessons, registries..."
            role="combobox"
            type="search"
            value={searchQuery}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 120);
            }}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-(--border) bg-(--surface-elevated) px-1.5 py-0.5 font-mono text-[0.65rem] text-(--text-muted)">
            {searchShortcutLabel}
          </kbd>
        </label>

        {showPanel ? (
          <div
            ref={listRef}
            className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 max-h-[min(28rem,70vh)] overflow-auto rounded-xl border border-(--border) bg-(--surface-elevated) p-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            id={listboxId}
            role="listbox"
          >
            {flatResults.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-(--text-muted)">
                {isSearchingRegistry
                  ? "Searching registries..."
                  : "No matches yet. Try a container name, image, or question like “how do I see logs?”"}
              </div>
            ) : (
              groups.map((group) => {
                const groupStartIndex = resultOffset;
                resultOffset += group.results.length;

                return (
                  <section
                    className="mb-2 last:mb-0"
                    key={group.scope}
                  >
                    <p className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
                      {group.label}
                    </p>
                    <ul className="space-y-1">
                      {group.results.map((result, index) => {
                        const flatIndex = groupStartIndex + index;
                        const isActive = flatIndex === activeIndex;

                        return (
                          <li key={result.id}>
                            <button
                              aria-selected={isActive}
                              id={`${listboxId}-option-${flatIndex}`}
                              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition ${
                                isActive
                                  ? "bg-(--accent-soft) text-(--text-primary)"
                                  : "text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)"
                              }`}
                              data-result-index={flatIndex}
                              role="option"
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() => setActiveIndex(flatIndex)}
                              onClick={() => handleSelect(result)}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{result.title}</span>
                                {result.subtitle ? (
                                  <span className="mt-0.5 block truncate text-xs text-(--text-muted)">
                                    {result.subtitle}
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${scopeBadgeClasses[result.scope]}`}
                              >
                                {result.badge}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}

            {isSearchingRegistry ? (
              <p className="px-2 pt-2 text-xs text-(--text-muted)">Searching registries...</p>
            ) : null}
            {registryMessage ? <p className={`px-2 pt-2 text-xs ${alertWarning}`}>{registryMessage}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }
);

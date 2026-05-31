import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchPalette } from "./global-search-palette";
import type { IntelligentSearchGroup } from "../types/intelligent-search";

const groups: IntelligentSearchGroup[] = [
  {
    scope: "local",
    label: "Local",
    results: [
      {
        id: "container-1",
        kind: "container",
        scope: "local",
        title: "web",
        subtitle: "running",
        badge: "Container",
        score: 1,
        action: { type: "navigate", page: "containers", query: "web" },
      },
      {
        id: "container-2",
        kind: "container",
        scope: "local",
        title: "api",
        subtitle: "stopped",
        badge: "Container",
        score: 0.9,
        action: { type: "navigate", page: "containers", query: "api" },
      },
    ],
  },
];

afterEach(() => cleanup());

describe("GlobalSearchPalette", () => {
  it("does not select a result when Enter is pressed without highlighting one", () => {
    const onSelectResult = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <GlobalSearchPalette
        groups={groups}
        isSearchingRegistry={false}
        registryMessage={null}
        searchQuery="web"
        onOpenChange={onOpenChange}
        onSearchChange={vi.fn()}
        onSelectResult={onSelectResult}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectResult).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("selects the first highlighted result after ArrowDown and Enter", () => {
    const onSelectResult = vi.fn();

    render(
      <GlobalSearchPalette
        groups={groups}
        isSearchingRegistry={false}
        registryMessage={null}
        searchQuery="web"
        onSearchChange={vi.fn()}
        onSelectResult={onSelectResult}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectResult).toHaveBeenCalledWith(groups[0].results[0]);
  });

  it("moves keyboard focus through results and selects on Enter", () => {
    const onSelectResult = vi.fn();

    render(
      <GlobalSearchPalette
        groups={groups}
        isSearchingRegistry={false}
        registryMessage={null}
        searchQuery="web"
        onSearchChange={vi.fn()}
        onSelectResult={onSelectResult}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectResult).toHaveBeenCalledWith(groups[0].results[1]);
  });
});

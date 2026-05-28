import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

afterEach(() => cleanup());

describe("AppShell", () => {
  it("keeps a minimum shell size below the compact sidebar breakpoint", () => {
    const { container } = render(
      <AppShell
        dockerStatus={null}
        isLoading={false}
        searchEnabled={false}
        searchQuery=""
        sidebar={<aside>Navigation</aside>}
        onRefresh={vi.fn()}
        onSearchChange={vi.fn()}
        onSearchResultSelect={vi.fn()}
      >
        <main>Page content</main>
      </AppShell>
    );

    expect(container.firstElementChild).toHaveClass("min-w-[960px]", "min-h-[640px]", "overflow-hidden");
  });
});

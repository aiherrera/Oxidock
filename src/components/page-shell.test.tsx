import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageShell } from "./page-shell";

afterEach(() => cleanup());

describe("PageShell", () => {
  it("does not add a generic page refresh action", () => {
    render(
      <PageShell
        description="Page description"
        errorMessage={null}
        isLoading={false}
        title="Volumes"
      >
        <div>Page content</div>
      </PageShell>
    );

    expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
  });
});

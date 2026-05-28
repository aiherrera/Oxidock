import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceBulkActionsBar } from "./resource-bulk-actions-bar";

afterEach(() => {
  cleanup();
});

describe("ResourceBulkActionsBar", () => {
  it("renders nothing when no rows are selected", () => {
    const { container } = render(
      <ResourceBulkActionsBar
        resourceLabel="container"
        selectedCount={0}
        onClearSelection={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("fires delete and clear callbacks", () => {
    const onDelete = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <ResourceBulkActionsBar
        resourceLabel="volume"
        selectedCount={2}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Clear selection/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2 volumes selected")).toBeInTheDocument();
  });
});

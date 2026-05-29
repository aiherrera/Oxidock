import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TableRow } from "../types/docker";
import { ContainersTable } from "./containers-table";

afterEach(() => {
  cleanup();
});

const createContainer = (overrides: Partial<Parameters<typeof buildContainerRow>[0]> = {}) =>
  buildContainerRow({
    id: overrides.id ?? "c1",
    name: overrides.name ?? "my-container",
    state: overrides.state ?? "running",
  });

const buildContainerRow = (container: { id: string; name: string; state: string }): TableRow => ({
  kind: "container",
  depth: 0,
  stats: null,
  container: {
    id: container.id,
    shortId: container.id.slice(0, 12),
    name: container.name,
    image: "alpine:latest",
    state: container.state,
    status: container.state,
    ports: [],
    createdAt: "2026-01-01",
    project: null,
    service: null,
    command: "sh",
    lastStartedAt: "2026-01-01",
  },
});

describe("ContainersTable actions", () => {
  const baseProps = {
    selectedId: null as string | null,
    isBulkSelected: () => false,
    allVisibleSelected: false,
    partiallyVisibleSelected: false,
    onToggleBulkSelected: vi.fn(),
    onToggleSelectAllVisible: vi.fn(),
    onSelectRow: vi.fn(),
    onOpenInspectTab: vi.fn(),
    onOpenLogsTab: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onRestart: vi.fn(),
    onRequestRemove: vi.fn(),
    onToggleProject: vi.fn(),
  };

  it("opens inspect tab from Inspect quick action", () => {
    const onOpenInspectTab = vi.fn();

    render(
      <ContainersTable
        {...baseProps}
        rows={[createContainer({ id: "c1", state: "running" })]}
        onOpenInspectTab={onOpenInspectTab}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Inspect my-container/i }));
    expect(onOpenInspectTab).toHaveBeenCalledWith("c1");
  });

  it("disables Logs quick action when container is not running", () => {
    render(
      <ContainersTable
        {...baseProps}
        rows={[createContainer({ id: "c1", state: "exited" })]}
      />
    );

    const logsButton = screen.getByRole("button", { name: /Logs my-container/i });
    expect(logsButton).toBeDisabled();
  });

  it("runs Stop from More menu for running containers", () => {
    const onStop = vi.fn();

    render(
      <ContainersTable
        {...baseProps}
        rows={[createContainer({ id: "c1", state: "running" })]}
        onStop={onStop}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /More actions for my-container/i }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledWith("c1");
  });

  it("prompts for remove confirmation then calls onRequestRemove", () => {
    const onRequestRemove = vi.fn();

    render(
      <ContainersTable
        {...baseProps}
        rows={[createContainer({ id: "c1", state: "running" })]}
        onRequestRemove={onRequestRemove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /More actions for my-container/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remove container/i }));

    // running container => force remove
    expect(onRequestRemove).toHaveBeenCalledWith("c1", true);
  });

  it("toggles bulk selection from checkbox without selecting inspector row", () => {
    const onToggleBulkSelected = vi.fn();
    const onSelectRow = vi.fn();

    render(
      <ContainersTable
        {...baseProps}
        rows={[createContainer({ id: "c1", state: "running" })]}
        onSelectRow={onSelectRow}
        onToggleBulkSelected={onToggleBulkSelected}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Select my-container/i }));
    expect(onToggleBulkSelected).toHaveBeenCalledWith("c1");
    expect(onSelectRow).not.toHaveBeenCalled();
  });
});

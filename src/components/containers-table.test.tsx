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
  it("opens inspect tab from Inspect quick action", () => {
    const onOpenInspectTab = vi.fn();

    render(
      <ContainersTable
        rows={[createContainer({ id: "c1", state: "running" })]}
        selectedId={null}
        onSelectRow={vi.fn()}
        onOpenInspectTab={onOpenInspectTab}
        onOpenLogsTab={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
        onRequestRemove={vi.fn()}
        onToggleProject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Inspect my-container/i }));
    expect(onOpenInspectTab).toHaveBeenCalledWith("c1");
  });

  it("disables Logs quick action when container is not running", () => {
    render(
      <ContainersTable
        rows={[createContainer({ id: "c1", state: "exited" })]}
        selectedId={null}
        onSelectRow={vi.fn()}
        onOpenInspectTab={vi.fn()}
        onOpenLogsTab={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
        onRequestRemove={vi.fn()}
        onToggleProject={vi.fn()}
      />
    );

    const logsButton = screen.getByRole("button", { name: /Logs my-container/i });
    expect(logsButton).toBeDisabled();
  });

  it("runs Stop from More menu for running containers", () => {
    const onStop = vi.fn();

    render(
      <ContainersTable
        rows={[createContainer({ id: "c1", state: "running" })]}
        selectedId={null}
        onSelectRow={vi.fn()}
        onOpenInspectTab={vi.fn()}
        onOpenLogsTab={vi.fn()}
        onStart={vi.fn()}
        onStop={onStop}
        onRestart={vi.fn()}
        onRequestRemove={vi.fn()}
        onToggleProject={vi.fn()}
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
        rows={[createContainer({ id: "c1", state: "running" })]}
        selectedId={null}
        onSelectRow={vi.fn()}
        onOpenInspectTab={vi.fn()}
        onOpenLogsTab={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
        onRequestRemove={onRequestRemove}
        onToggleProject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /More actions for my-container/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remove container/i }));

    // running container => force remove
    expect(onRequestRemove).toHaveBeenCalledWith("c1", true);
  });
});

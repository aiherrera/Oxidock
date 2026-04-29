import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TitleBar } from "./title-bar";
import type { ComponentProps } from "react";
import type { DockerStatus } from "../types/docker";

const dockerStatus: DockerStatus = {
  isRunning: true,
  engineState: "running",
  message: "Docker is running.",
  serverVersion: "27.0.0",
  apiVersion: "1.46",
  providerId: "docker",
  providerName: "Docker",
  contextName: "default",
  endpointLabel: "Default",
  lifecycleCapabilities: [],
};

const renderTitleBar = (overrides: Partial<ComponentProps<typeof TitleBar>> = {}) => {
  const props: ComponentProps<typeof TitleBar> = {
    isLoading: false,
    searchEnabled: false,
    searchQuery: "",
    status: dockerStatus,
    onOpenHelp: vi.fn(),
    onOpenSettings: vi.fn(),
    onRefresh: vi.fn(),
    onSearchChange: vi.fn(),
    onSearchResultSelect: vi.fn(),
    ...overrides,
  };

  render(<TitleBar {...props} />);

  return props;
};

afterEach(() => cleanup());

describe("TitleBar actions", () => {
  it("describes each global title bar action with useful tooltips", () => {
    renderTitleBar();

    expect(screen.getByRole("button", { name: "Refresh Docker data" }).getAttribute("title")).toBe(
      "Refresh Docker status and visible data"
    );
    expect(screen.getByRole("button", { name: "Open documentation" }).getAttribute("title")).toBe(
      "Open Docker command docs and examples"
    );
    expect(screen.getByRole("button", { name: "Open settings" }).getAttribute("title")).toBe("Open settings (Cmd+,)");
  });

  it("opens help from the global title bar action", () => {
    const props = renderTitleBar();

    fireEvent.click(screen.getByRole("button", { name: "Open documentation" }));

    expect(props.onOpenHelp).toHaveBeenCalledOnce();
  });

  it("does not render a placeholder account action", () => {
    renderTitleBar();

    expect(screen.queryByRole("button", { name: /account/i })).toBeNull();
  });
});

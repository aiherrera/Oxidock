import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";
import { APP_PAGE_SECTIONS, getAppPagesBySection } from "../types/app";

vi.mock("../hooks/use-engine-lifecycle", () => ({
  useEngineLifecycle: () => ({
    runningLifecycleAction: null,
    actionError: null,
    runLifecycleAction: vi.fn(),
  }),
}));

vi.mock("./sidebar-resource-panel", () => ({
  SidebarResourcePanel: () => <div data-testid="sidebar-resource-panel" />,
}));

vi.mock("./brand-logo", () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

const baseStatus = {
  isRunning: true,
  engineState: "running" as const,
  message: "Connected",
  serverVersion: "27.0.0",
  apiVersion: "1.47",
  providerId: "docker",
  providerName: "Docker",
  contextName: "default",
  endpointLabel: "Default",
  lifecycleCapabilities: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sidebar", () => {
  it("renders overview, tools, and learn navigation sections", () => {
    render(
      <Sidebar
        activePage="dashboard"
        isLoading={false}
        status={baseStatus}
        onPageChange={vi.fn()}
      />
    );

    for (const section of APP_PAGE_SECTIONS) {
      expect(screen.getByText(section.label)).toBeInTheDocument();
    }

    for (const page of getAppPagesBySection("overview")) {
      expect(screen.getByRole("button", { name: page.label })).toBeInTheDocument();
    }

    for (const page of getAppPagesBySection("tools")) {
      expect(screen.getByRole("button", { name: page.label })).toBeInTheDocument();
    }

    for (const page of getAppPagesBySection("learn")) {
      expect(screen.getByRole("button", { name: page.label })).toBeInTheDocument();
    }

    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("marks the active page and forwards navigation clicks", () => {
    const onPageChange = vi.fn();

    render(
      <Sidebar
        activePage="dashboard"
        isLoading={false}
        status={baseStatus}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Containers" }));
    expect(onPageChange).toHaveBeenCalledWith("containers");

    fireEvent.click(screen.getByRole("button", { name: "Command School" }));
    expect(onPageChange).toHaveBeenCalledWith("docs");
  });

  it("renders the resource usage panel", () => {
    render(
      <Sidebar
        activePage="dashboard"
        isLoading={false}
        status={baseStatus}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("sidebar-resource-panel")).toBeInTheDocument();
  });
});

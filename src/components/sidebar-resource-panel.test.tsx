import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarResourcePanel } from "./sidebar-resource-panel";

vi.mock("../hooks/use-app-resource-usage", () => ({
  useAppResourceUsage: () => ({
    ram: "412 MB",
    cpu: "7.00%",
    diskUsed: "2.10 GB",
    diskLimit: "500 GB",
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SidebarResourcePanel", () => {
  it("renders cpu, memory, and disk rows", () => {
    render(<SidebarResourcePanel compact={false} />);

    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("Disk")).toBeInTheDocument();
    expect(screen.getByText("7.00%")).toBeInTheDocument();
    expect(screen.getByText("412 MB")).toBeInTheDocument();
    expect(screen.getByText("2.10 GB")).toBeInTheDocument();
  });

  it("renders compact metric triggers", () => {
    render(<SidebarResourcePanel compact />);

    expect(screen.getByLabelText("CPU: 7.00%")).toBeInTheDocument();
    expect(screen.getByLabelText("Memory: 412 MB")).toBeInTheDocument();
    expect(screen.getByLabelText("Disk: 2.10 GB")).toBeInTheDocument();
  });
});

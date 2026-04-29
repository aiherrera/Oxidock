import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppResourceUsage } from "./use-app-resource-usage";

vi.mock("../lib/tauri-app-metrics", () => ({
  fetchAppResourceUsage: vi.fn(),
}));

import { fetchAppResourceUsage } from "../lib/tauri-app-metrics";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useAppResourceUsage", () => {
  it("clears the polling interval on unmount", () => {
    vi.mocked(fetchAppResourceUsage).mockResolvedValue({
      ram: "128 MB",
      cpu: "2%",
      diskUsed: "1 GB",
      diskLimit: "10 GB",
    });

    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useAppResourceUsage());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

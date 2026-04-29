import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrySettingsPanel } from "./registry-settings-panel";

vi.mock("../lib/tauri-registry", () => ({
  fetchRegistries: vi.fn(),
  upsertRegistry: vi.fn(),
  removeRegistry: vi.fn(),
  saveRegistryCredentials: vi.fn(),
  deleteRegistryCredentials: vi.fn(),
  testRegistryConnection: vi.fn(),
}));

import { fetchRegistries, upsertRegistry } from "../lib/tauri-registry";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegistrySettingsPanel", () => {
  it("shows validation errors when saving a registry fails", async () => {
    vi.mocked(fetchRegistries).mockResolvedValue([]);
    vi.mocked(upsertRegistry).mockRejectedValue(new Error("Registry URL must use https://."));

    render(<RegistrySettingsPanel />);

    expect(await screen.findByText(/no registries configured/i)).toBeInTheDocument();

    const [nameInput, urlInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Private Hub" } });
    fireEvent.change(urlInput, { target: { value: "http://registry.internal" } });
    fireEvent.click(screen.getByRole("button", { name: /add registry/i }));

    expect(await screen.findByText(/must use https/i)).toBeInTheDocument();
  });
});

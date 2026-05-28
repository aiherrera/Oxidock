import { describe, expect, it } from "vitest";
import { getInvokeErrorMessage } from "./local-ai-assistant";

describe("getInvokeErrorMessage", () => {
  it("returns string invoke errors", () => {
    expect(getInvokeErrorMessage("Failed to download model: network", "fallback")).toBe(
      "Failed to download model: network"
    );
  });

  it("returns Error message when present", () => {
    expect(getInvokeErrorMessage(new Error("Checksum mismatch"), "fallback")).toBe("Checksum mismatch");
  });

  it("falls back when error is empty", () => {
    expect(getInvokeErrorMessage({}, "Install failed.")).toBe("Install failed.");
  });
});

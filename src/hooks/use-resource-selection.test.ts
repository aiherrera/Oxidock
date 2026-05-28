import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useResourceSelection } from "./use-resource-selection";

describe("useResourceSelection", () => {
  it("toggles keys and tracks counts", () => {
    const { result } = renderHook(() => useResourceSelection());

    act(() => {
      result.current.toggle("a");
      result.current.toggle("b");
    });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected("a")).toBe(true);

    act(() => {
      result.current.toggle("a");
    });

    expect(result.current.selectedCount).toBe(1);
  });

  it("selects all visible keys and clears selection", () => {
    const { result } = renderHook(() => useResourceSelection());

    act(() => {
      result.current.selectAll(["a", "b", "c"]);
    });

    expect(result.current.isAllSelected(["a", "b", "c"])).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.selectedCount).toBe(0);
  });

  it("detects partial selection", () => {
    const { result } = renderHook(() => useResourceSelection());

    act(() => {
      result.current.toggle("a");
    });

    expect(result.current.isPartiallySelected(["a", "b"])).toBe(true);
    expect(result.current.isAllSelected(["a", "b"])).toBe(false);
  });
});

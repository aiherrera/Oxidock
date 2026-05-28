import { useCallback, useMemo, useState } from "react";

export type UseResourceSelectionResult = {
  selectedKeys: Set<string>;
  selectedCount: number;
  isSelected: (key: string) => boolean;
  toggle: (key: string) => void;
  selectAll: (keys: string[]) => void;
  clear: () => void;
  setSelectedKeys: (keys: Iterable<string>) => void;
  isAllSelected: (keys: string[]) => boolean;
  isPartiallySelected: (keys: string[]) => boolean;
};

export function useResourceSelection(): UseResourceSelectionResult {
  const [selectedKeys, setSelectedKeysState] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback((key: string) => selectedKeys.has(key), [selectedKeys]);

  const toggle = useCallback((key: string) => {
    setSelectedKeysState((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => {
    setSelectedKeysState(new Set(keys));
  }, []);

  const clear = useCallback(() => {
    setSelectedKeysState(new Set());
  }, []);

  const setSelectedKeys = useCallback((keys: Iterable<string>) => {
    setSelectedKeysState(new Set(keys));
  }, []);

  const isAllSelected = useCallback(
    (keys: string[]) => keys.length > 0 && keys.every((key) => selectedKeys.has(key)),
    [selectedKeys]
  );

  const isPartiallySelected = useCallback(
    (keys: string[]) => keys.some((key) => selectedKeys.has(key)) && !keys.every((key) => selectedKeys.has(key)),
    [selectedKeys]
  );

  const selectedCount = selectedKeys.size;

  return useMemo(
    () => ({
      selectedKeys,
      selectedCount,
      isSelected,
      toggle,
      selectAll,
      clear,
      setSelectedKeys,
      isAllSelected,
      isPartiallySelected,
    }),
    [
      selectedKeys,
      selectedCount,
      isSelected,
      toggle,
      selectAll,
      clear,
      setSelectedKeys,
      isAllSelected,
      isPartiallySelected,
    ]
  );
}

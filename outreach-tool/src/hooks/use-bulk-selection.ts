import { useState, useCallback } from 'react';

export function useBulkSelection<T extends { id: string }>(
  items: T[] = []
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    const ids = items.map((item) => item.id);
    setSelectedIds(new Set(ids));
  }, [items]);

  const selectAllMatching = useCallback((allIds: string[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const isAllSelected = useCallback(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const isPartiallySelected = useCallback(() => {
    if (items.length === 0 || selectedIds.size === 0) return false;
    return !isAllSelected();
  }, [items, selectedIds, isAllSelected]);

  return {
    selectedIds,
    count: selectedIds.size,
    toggleItem,
    selectAllOnPage,
    selectAllMatching,
    deselectAll,
    isSelected,
    isAllSelected,
    isPartiallySelected,
  };
}

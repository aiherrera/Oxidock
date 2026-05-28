type ResourceSelectionHeaderCheckboxProps = {
  allSelected: boolean;
  partiallySelected: boolean;
  onToggleAll: () => void;
};

export function ResourceSelectionHeaderCheckbox({
  allSelected,
  partiallySelected,
  onToggleAll,
}: ResourceSelectionHeaderCheckboxProps) {
  return (
    <input
      aria-label="Select all visible rows"
      checked={allSelected}
      className="size-4 rounded border-(--border) bg-(--surface) accent-(--accent)"
      ref={(node) => {
        if (node) {
          node.indeterminate = partiallySelected;
        }
      }}
      type="checkbox"
      onChange={onToggleAll}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function ResourceSelectionRowCheckbox({
  checked,
  disabled = false,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <input
      aria-label={`Select ${label}`}
      checked={checked}
      className="size-4 rounded border-(--border) bg-(--surface) accent-(--accent) disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      type="checkbox"
      onChange={onToggle}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

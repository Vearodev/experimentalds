export type TableGroupRule = { field: string; direction: 'asc' | 'desc' };
export type TableGroupValue = {
  key: string;
  label: string;
  sortValue: string | number;
  empty: boolean;
};
export type TableRowGroup<T> = TableGroupValue & { rows: T[] };
export type TableGrouping<T> = {
  id: string;
  label: string;
  direction: 'asc' | 'desc';
  getValue: (row: T) => TableGroupValue;
  /** Counts after filtering, before pagination. */
  totalCounts?: ReadonlyMap<string, number>;
  totalGroups?: number;
  onClear?: () => void;
};

/** Group identity uses the source value, never its rendered or translated label. */
export function tableGroupValue(
  raw: string | number | null | undefined,
  options: { kind?: string; unit?: string; label?: string } = {},
): TableGroupValue {
  if (
    raw === null ||
    raw === undefined ||
    raw === '' ||
    (typeof raw === 'number' && !Number.isFinite(raw))
  )
    return { key: 'empty:', label: 'Не задано', sortValue: '', empty: true };
  if (options.kind === 'date') {
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return tableGroupValue(null);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      key: `date:${key}`,
      label: date.toLocaleDateString('ru-RU'),
      sortValue: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
      empty: false,
    };
  }
  return {
    key: `${typeof raw}:${raw}`,
    label: `${options.label ?? raw}${options.unit ? ` ${options.unit}` : ''}`,
    sortValue: typeof raw === 'number' ? raw : (options.label ?? raw),
    empty: false,
  };
}

/** Stable within groups: callers apply their row sort before grouping. */
export function groupTableRows<T>(
  rows: readonly T[],
  getValue: (row: T) => TableGroupValue,
  direction: 'asc' | 'desc' = 'asc',
): TableRowGroup<T>[] {
  const groups = new Map<string, TableRowGroup<T>>();
  for (const row of rows) {
    const value = getValue(row);
    const group = groups.get(value.key);
    if (group) group.rows.push(row);
    else groups.set(value.key, { ...value, rows: [row] });
  }
  return [...groups.values()].sort((a, b) => {
    if (a.empty !== b.empty) return a.empty ? 1 : -1;
    const compared =
      typeof a.sortValue === 'number' && typeof b.sortValue === 'number'
        ? a.sortValue - b.sortValue
        : String(a.sortValue).localeCompare(String(b.sortValue), 'ru', { numeric: true });
    return (compared || a.key.localeCompare(b.key, 'ru')) * (direction === 'asc' ? 1 : -1);
  });
}

import {
  tableFilterOperators,
  tableGroupValue,
  type TableGroupRule,
  type TableGrouping,
  type DataColumn,
  type SortState,
  type TableFilterRule,
  type TableFilterKind,
  type TableFilterOperator,
} from '@basis/ui';

export type FilterKind = TableFilterKind;
export type RegistryColumn<T> = Omit<DataColumn<T>, 'filter'> & {
  value?: (row: T) => string | number | null;
  kind?: FilterKind;
  options?: { value: string; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  hidden?: boolean;
  required?: boolean;
  groupable?: boolean;
};
export type Operator = TableFilterOperator;
export type Rule = TableFilterRule;
export type RegistryView = {
  query: string;
  filters: Rule[];
  sorts: SortState[];
  columns: string[];
  columnOrder: string[];
  page: number;
  grouping: TableGroupRule | null;
};

export function registryGrouping<T>(
  columns: RegistryColumn<T>[],
  rule?: TableGroupRule | null,
): TableGrouping<T> | undefined {
  const column = columns.find(
    (item) => item.id === rule?.field && item.value && item.groupable !== false,
  );
  if (!column || !rule) return undefined;
  return {
    id: column.id,
    label: column.header,
    direction: rule.direction,
    getValue: (row) => {
      const raw = column.value!(row);
      return tableGroupValue(raw, {
        kind: column.kind,
        unit: column.unit,
        label: column.options?.find((option) => option.value === String(raw))?.label,
      });
    },
  };
}
export const operatorNames: Record<Operator, string> = {
  contains: 'Содержит',
  equals: 'Равно',
  startsWith: 'Начинается с',
  notContains: 'Не содержит',
  in: 'Любое из',
  notIn: 'Кроме',
  between: 'В диапазоне',
  gte: 'Не меньше',
  lte: 'Не больше',
};
export const operators = (kind: FilterKind = 'text') => tableFilterOperators(kind);
export function newRule<T>(column: RegistryColumn<T>): Rule {
  return { field: column.id, operator: operators(column.kind)[0], value: '', to: '', values: [] };
}
export function ruleError<T>(rule: Rule, column?: RegistryColumn<T>): string {
  if (!column?.value || !operators(column.kind).includes(rule.operator))
    return 'Поле или условие недоступно.';
  if (column.kind === 'enum') return rule.values.length ? '' : 'Выберите хотя бы одно значение.';
  if (!rule.value.trim() && !(rule.operator === 'between' && rule.to.trim()))
    return 'Укажите значение.';
  const values = rule.operator === 'between' ? [rule.value, rule.to] : [rule.value];
  if (column.kind === 'number') {
    if (
      values.some(
        (v) =>
          v !== '' &&
          (!Number.isFinite(Number(v)) ||
            Number(v) < (column.min ?? 0) ||
            Number(v) > (column.max ?? Infinity)),
      )
    )
      return `Укажите число от ${column.min ?? 0}${column.max !== undefined ? ` до ${column.max}` : ''}${column.unit ? ` ${column.unit}` : ''}.`;
    if (
      rule.operator === 'between' &&
      rule.value &&
      rule.to &&
      Number(rule.value) > Number(rule.to)
    )
      return 'Начало диапазона больше конца.';
  }
  if (column.kind === 'date') {
    if (
      values.some((v) => {
        if (!v) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
        const parsed = new Date(`${v}T00:00:00`),
          parts = v.split('-').map(Number);
        return (
          parsed.getFullYear() !== parts[0] ||
          parsed.getMonth() + 1 !== parts[1] ||
          parsed.getDate() !== parts[2]
        );
      })
    )
      return 'Укажите существующую дату.';
    if (rule.operator === 'between' && rule.value && rule.to && rule.value > rule.to)
      return 'Начало периода позже окончания.';
  }
  return '';
}
const normalize = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLocaleLowerCase('ru');
// Local calendar boundaries include the entire final day, including DST changes.
const dayStart = (v: string) => new Date(`${v}T00:00:00`).getTime();
const nextDay = (v: string) => {
  const date = new Date(`${v}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.getTime();
};
export function matchesRule<T>(row: T, rule: Rule, column: RegistryColumn<T>): boolean {
  if (ruleError(rule, column)) return false;
  const raw = column.value!(row);
  if (raw === null) return false;
  if (column.kind === 'enum')
    return rule.operator === 'notIn'
      ? !rule.values.includes(String(raw))
      : rule.values.includes(String(raw));
  if (column.kind === 'number' || column.kind === 'date') {
    const date = column.kind === 'date',
      value = date && typeof raw === 'string' ? new Date(raw).getTime() : Number(raw);
    const from = date ? dayStart(rule.value) : Number(rule.value),
      to = date ? nextDay(rule.to) : Number(rule.to);
    if (rule.operator === 'equals')
      return date ? value >= from && value < nextDay(rule.value) : value === from;
    if (rule.operator === 'gte') return value >= from;
    if (rule.operator === 'lte') return date ? value < nextDay(rule.value) : value <= from;
    return (!rule.value || value >= from) && (!rule.to || (date ? value < to : value <= to));
  }
  const value = normalize(raw),
    target = normalize(rule.value);
  if (rule.operator === 'equals') return value === target;
  if (rule.operator === 'startsWith') return value.startsWith(target);
  if (rule.operator === 'notContains') return !value.includes(target);
  return value.includes(target);
}
export function queryRows<T>(
  rows: T[],
  columns: RegistryColumn<T>[],
  query: string,
  filters: Rule[],
  sorts: SortState[] = [],
): T[] {
  const fields = new Map(columns.map((c) => [c.id, c]));
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return rows
    .filter((row) => {
      const searchText = columns
        .filter((c) => c.value)
        .map((c) => {
          const value = c.value!(row);
          return c.options?.find((o) => o.value === String(value))?.label ?? value ?? '';
        })
        .join(' ')
        .toLocaleLowerCase('ru');
      return (
        terms.every((term) => searchText.includes(term)) &&
        filters.every((rule) => {
          const field = fields.get(rule.field);
          return !!field && matchesRule(row, rule, field);
        })
      );
    })
    .sort((a, b) => {
      for (const sort of sorts) {
        const field = fields.get(sort.column);
        if (!field?.value) continue;
        const av = field.value(a),
          bv = field.value(b);
        if (av === null || bv === null) {
          if (av !== bv) return av === null ? 1 : -1;
          else continue;
        }
        const toSort = (v: string | number) =>
          field.kind === 'date'
            ? new Date(v).getTime()
            : field.kind === 'ip'
              ? String(v)
                  .split('.')
                  .slice(0, 4)
                  .reduce((n, p) => n * 256 + Number(p.split('/')[0]), 0)
              : (field.options?.find((o) => o.value === String(v))?.label ?? v);
        const x = toSort(av),
          y = toSort(bv);
        const result =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), 'ru', { numeric: true });
        if (result) return result * (sort.direction === 'asc' ? 1 : -1);
      }
      return 0;
    });
}
export function ruleLabel<T>(rule: Rule, column: RegistryColumn<T>): string {
  const format = (v: string) =>
    column.kind === 'date' && v ? new Date(`${v}T00:00:00`).toLocaleDateString('ru-RU') : v;
  const value =
    column.kind === 'enum'
      ? rule.values.map((v) => column.options?.find((o) => o.value === v)?.label || v).join(', ')
      : rule.operator === 'between'
        ? `${rule.value ? format(rule.value) : '…'} — ${rule.to ? format(rule.to) : '…'}`
        : format(rule.value);
  const prefix: Partial<Record<Operator, string>> = {
    notIn: 'кроме ',
    gte: '≥ ',
    lte: '≤ ',
    notContains: 'без ',
    contains: 'содержит ',
    startsWith: 'начинается с ',
    equals: '= ',
  };
  return `${column.header}: ${prefix[rule.operator] || ''}${value}${column.unit ? ` ${column.unit}` : ''}`;
}
export function defaultView<T>(
  columns: RegistryColumn<T>[],
  sorts: SortState[] = [],
): RegistryView {
  return {
    query: '',
    filters: [],
    sorts,
    columns: columns.filter((c) => !c.hidden || c.pinned || c.required).map((c) => c.id),
    columnOrder: columns.map((c) => c.id),
    page: 1,
    grouping: null,
  };
}
export function restoreView<T>(
  raw: string | null,
  columns: RegistryColumn<T>[],
  fallback: RegistryView,
): RegistryView {
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return fallback;
    const known = new Set(columns.map((c) => c.id));
    const visible = Array.isArray(value.columns)
      ? [...new Set<string>(value.columns.filter((id: string) => known.has(id)))]
      : fallback.columns;
    columns
      .filter((c) => c.required || c.pinned)
      .forEach((c) => {
        if (!visible.includes(c.id)) visible.push(c.id);
      });
    return {
      query: typeof value.query === 'string' ? value.query : '',
      filters: Array.isArray(value.filters)
        ? value.filters.filter(
            (r: Rule) =>
              r &&
              typeof r.value === 'string' &&
              typeof r.to === 'string' &&
              Array.isArray(r.values) &&
              r.values.every((v) => typeof v === 'string') &&
              !ruleError(
                r,
                columns.find((c) => c.id === r.field),
              ),
          )
        : [],
      sorts: Array.isArray(value.sorts)
        ? value.sorts.filter(
            (s: SortState) =>
              s &&
              columns.some((c) => c.id === s.column && c.value) &&
              ['asc', 'desc'].includes(s.direction),
          )
        : fallback.sorts,
      columns: visible.length ? visible : fallback.columns,
      columnOrder: [
        ...columns.filter((c) => c.pinned === 'start').map((c) => c.id),
        ...[
          ...new Set<string>([
            ...(Array.isArray(value.columnOrder) ? value.columnOrder : visible),
            ...columns.map((c) => c.id),
          ]),
        ].filter((id) => columns.some((c) => c.id === id && !c.pinned)),
        ...columns.filter((c) => c.pinned === 'end').map((c) => c.id),
      ],
      page: Number.isInteger(value.page) && value.page > 0 ? value.page : 1,
      grouping:
        value.grouping &&
        ['asc', 'desc'].includes(value.grouping.direction) &&
        columns.some(
          (column) =>
            column.id === value.grouping.field && column.value && column.groupable !== false,
        )
          ? { field: value.grouping.field, direction: value.grouping.direction }
          : null,
    };
  } catch {
    return fallback;
  }
}

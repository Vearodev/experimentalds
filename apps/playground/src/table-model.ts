import type { SortState } from '@basis/ui';
export type ResourceRow = {
  name: string;
  status: string;
  project: string;
  cpu: number;
  ram: number;
  ip: string;
};
export type FilterField = keyof ResourceRow;
export type FilterOperator =
  'contains' | 'notContains' | 'equals' | 'startsWith' | 'in' | 'notIn' | 'between' | 'gte' | 'lte';
export type FilterRule = {
  field: FilterField;
  operator: FilterOperator;
  value: string;
  to: string;
  values: string[];
};
export type Filters = FilterRule[];
export const filterLabels: Record<FilterField, string> = {
  name: 'Имя',
  status: 'Статус',
  project: 'Проект',
  cpu: 'CPU',
  ram: 'RAM',
  ip: 'IP-адрес',
};
export const fieldTypes: Record<FilterField, 'text' | 'set' | 'number'> = {
  name: 'text',
  status: 'set',
  project: 'set',
  cpu: 'number',
  ram: 'number',
  ip: 'text',
};
export const operatorLabels: Record<FilterOperator, string> = {
  contains: 'Содержит',
  notContains: 'Не содержит',
  equals: 'Равно',
  startsWith: 'Начинается с',
  in: 'Любое из',
  notIn: 'Ни одно из',
  between: 'В диапазоне',
  gte: 'Не меньше',
  lte: 'Не больше',
};
export const statusLabels: Record<string, string> = {
  running: 'Работает',
  off: 'Выключена',
  error: 'Ошибка',
};
export const operatorsFor = (field: FilterField): FilterOperator[] =>
  fieldTypes[field] === 'number'
    ? ['between', 'equals', 'gte', 'lte']
    : fieldTypes[field] === 'set'
      ? ['in', 'notIn']
      : field === 'ip'
        ? ['startsWith', 'equals']
        : ['contains', 'equals', 'startsWith', 'notContains'];
export const newFilter = (field: FilterField): FilterRule => ({
  field,
  operator: operatorsFor(field)[0],
  value: '',
  to: '',
  values: [],
});
export const blankFilters: Filters = [];
export function isFilled(rule: FilterRule) {
  return fieldTypes[rule.field] === 'set'
    ? rule.values.length > 0
    : Boolean(rule.value.trim() || (rule.operator === 'between' && rule.to.trim()));
}
export function filterError(rule: FilterRule): string {
  if (!operatorsFor(rule.field).includes(rule.operator))
    return 'Выберите условие для этого типа поля.';
  if (!isFilled(rule)) return 'Укажите значение или удалите условие.';
  if (fieldTypes[rule.field] !== 'number') return '';
  const values = rule.operator === 'between' ? [rule.value, rule.to] : [rule.value];
  if (
    values.some(
      (value) =>
        value !== '' &&
        (!Number.isFinite(Number(value)) ||
          Number(value) < 0 ||
          (rule.field === 'cpu' && Number(value) > 100)),
    )
  )
    return rule.field === 'cpu'
      ? 'CPU: значение должно быть от 0 до 100 %.'
      : 'Объём не может быть отрицательным.';
  if (
    rule.operator === 'between' &&
    rule.value !== '' &&
    rule.to !== '' &&
    Number(rule.value) > Number(rule.to)
  )
    return 'Начало диапазона не может быть больше конца.';
  return '';
}
export const activeFilters = (filters: Filters) =>
  filters.filter(isFilled).map((rule) => rule.field);
export function filterMatches(row: ResourceRow, filters: Filters) {
  return filters.every((rule) => {
    if (!isFilled(rule)) return true;
    if (filterError(rule)) return false;
    const raw = row[rule.field];
    if (fieldTypes[rule.field] === 'set')
      return rule.operator === 'notIn'
        ? !rule.values.includes(String(raw))
        : rule.values.includes(String(raw));
    if (fieldTypes[rule.field] === 'number') {
      if (rule.field === 'cpu' && row.status !== 'running') return false;
      const value = Number(raw),
        target = Number(rule.value);
      if (rule.operator === 'equals') return value === target;
      if (rule.operator === 'gte') return value >= target;
      if (rule.operator === 'lte') return value <= target;
      return (rule.value === '' || value >= target) && (rule.to === '' || value <= Number(rule.to));
    }
    const value = String(raw).toLocaleLowerCase('ru'),
      target = rule.value.trim().toLocaleLowerCase('ru');
    if (rule.operator === 'equals') return value === target;
    if (rule.operator === 'startsWith') return value.startsWith(target);
    if (rule.operator === 'notContains') return !value.includes(target);
    return value.includes(target);
  });
}
export function formatFilter(rule: FilterRule) {
  const unit = rule.field === 'cpu' ? ' %' : rule.field === 'ram' ? ' GiB' : '';
  const value =
    fieldTypes[rule.field] === 'set'
      ? rule.values.map((v) => statusLabels[v] || v).join(', ')
      : rule.operator === 'between'
        ? rule.value && rule.to
          ? `${rule.value}–${rule.to}${unit}`
          : rule.value
            ? `от ${rule.value}${unit}`
            : `до ${rule.to}${unit}`
        : `${rule.value}${unit}`;
  return `${filterLabels[rule.field]} · ${rule.operator === 'between' ? '' : operatorLabels[rule.operator].toLowerCase() + ' '}${value}`;
}
export function sortResources<T extends ResourceRow>(rows: T[], rules: SortState[]): T[] {
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      const field = rule.column as FilterField;
      const aMissing = field === 'cpu' && a.status !== 'running',
        bMissing = field === 'cpu' && b.status !== 'running';
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (aMissing && bMissing) continue;
      const av = a[field],
        bv = b[field];
      const compared =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : field === 'ip'
            ? String(av)
                .split('.')
                .reduce((n, v, i) => n || Number(v) - Number(String(bv).split('.')[i]), 0)
            : String(field === 'status' ? statusLabels[av] : av).localeCompare(
                String(field === 'status' ? statusLabels[bv] : bv),
                'ru',
                { numeric: true },
              );
      if (compared) return compared * (rule.direction === 'asc' ? 1 : -1);
    }
    return 0;
  });
}

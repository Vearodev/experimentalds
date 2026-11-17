import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowDownUp,
  CircleHelp,
  Columns3,
  Group,
  ListFilter,
  LockKeyhole,
  Plus,
  Search,
  X,
  Bookmark,
  BookmarkPlus,
  Pin,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import { Button, IconButton } from './Button';
import { Checkbox, Select, type SelectOption } from './Choice';
import { Input } from './Fields';
import { ContextPanel } from './ContextPanel';
import { Tooltip } from './Tooltip';
import { Menu } from './Disclosure';
import { FilterPresetSettings } from './TableFilterPresets';
import { filterPresetKey, type TableFilterPresetLibrary } from './table-filter-presets';
import type { DataTableView, SortState } from './DataTable';
import type { TableGroupRule } from './table-grouping';

export type TableFilterKind = 'text' | 'number' | 'enum' | 'date' | 'ip';
export type TableFilterOperator =
  'contains' | 'equals' | 'startsWith' | 'notContains' | 'in' | 'notIn' | 'between' | 'gte' | 'lte';
export type TableFilterRule<F extends string = string> = {
  field: F;
  operator: TableFilterOperator;
  value: string;
  to: string;
  values: string[];
};
export type TableFilterField<F extends string = string> = {
  id: F;
  label: string;
  description?: string;
  kind: TableFilterKind;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  groupable?: boolean;
  options?: SelectOption[] | ((rules: TableFilterRule<F>[]) => SelectOption[]);
};
export type TableToolColumn = {
  id: string;
  label: string;
  description?: string;
  locked?: boolean;
};
export type TableToolsValue<F extends string = string> = {
  filters: TableFilterRule<F>[];
  sorts: SortState[];
  order: string[];
  hidden: Set<string>;
  grouping?: TableGroupRule | null;
};
export type TableToolsMode = 'filters' | 'sort' | 'group' | 'columns';
export function TableToolbarActions<F extends string = string>({
  view = 'table',
  primaryOnly = false,
  filterCount,
  sortCount,
  groupLabel,
  onOpen,
  presets,
}: {
  view?: DataTableView;
  primaryOnly?: boolean;
  filterCount: number;
  sortCount: number;
  groupLabel?: string;
  onOpen: (mode: TableToolsMode, anchor: HTMLElement) => void;
  presets?: {
    library: TableFilterPresetLibrary<F>;
    rules: TableFilterRule<F>[];
    describe: (rule: TableFilterRule<F>) => string;
    validate: (rule: TableFilterRule<F>) => string;
    onApply: (rules: TableFilterRule<F>[]) => void;
    onManage: (action: 'library' | 'save', anchor: HTMLElement) => void;
  };
}) {
  const presetTrigger = useRef<HTMLSpanElement>(null);
  const matchingPreset =
    presets &&
    (presets.library.items.find(
      (p) =>
        p.id === presets.library.currentId &&
        filterPresetKey(p.rules) === filterPresetKey(presets.rules),
    ) ||
      presets.library.items.find(
        (p) =>
          p.id === presets.library.defaultId &&
          filterPresetKey(p.rules) === filterPresetKey(presets.rules),
      ) ||
      presets.library.items.find(
        (p) => filterPresetKey(p.rules) === filterPresetKey(presets.rules),
      ));
  const isDefault = Boolean(matchingPreset && matchingPreset.id === presets?.library.defaultId);
  const manage = (action: 'library' | 'save') => {
    const anchor = presetTrigger.current?.querySelector('button');
    if (anchor) presets?.onManage(action, anchor);
  };
  return (
    <div className="basis-table-tools-actions">
      <div className="basis-table-filter-group" data-presets={Boolean(presets)}>
        <Tooltip content={filterCount ? `Фильтры · условий: ${filterCount}` : 'Фильтры'}>
          <Button
            className="basis-table-tools-filter"
            size="sm"
            variant={filterCount ? 'tonal' : 'ghost'}
            leadingIcon={<ListFilter />}
            aria-label={filterCount ? `Фильтры · ${filterCount}` : 'Фильтры'}
            aria-pressed={filterCount > 0}
            onClick={(event) => onOpen('filters', event.currentTarget)}
          >
            Фильтры{filterCount ? ` · ${filterCount}` : ''}
          </Button>
        </Tooltip>
        {presets && (
          <span ref={presetTrigger} className="basis-table-preset-trigger">
            <Tooltip content="Сохранённые наборы фильтров">
              <Menu
                compact
                size="sm"
                label="Сохранённые фильтры"
                icon={<ChevronDown />}
                variant={filterCount ? 'tonal' : 'ghost'}
                align="end"
                onOpenChange={(open) => {
                  if (!open) presets.library.dismiss();
                }}
                items={[
                  ...presets.library.items.map((p) => ({
                    id: p.id,
                    label: p.name,
                    icon: p.id === presets.library.defaultId ? <Pin /> : <Bookmark />,
                    iconAlign: 'center' as const,
                    description: p.rules.map(presets.describe).join(' · ').slice(0, 120),
                    hint:
                      p.id === presets.library.defaultId
                        ? `«${p.name}» — набор по умолчанию для этой таблицы.`
                        : `Применить набор «${p.name}».`,
                    checked: matchingPreset?.id === p.id,
                    disabled: p.rules.some(presets.validate),
                    onSelect: () => {
                      presets.library.select(p.id);
                      presets.onApply(p.rules.map((r) => ({ ...r, values: [...r.values] })));
                    },
                  })),
                  ...(!presets.library.items.length
                    ? [
                        {
                          id: 'empty',
                          label: 'Пока нет сохранённых наборов',
                          description: 'Настройте фильтры и сохраните условия.',
                          disabled: true,
                        },
                      ]
                    : []),
                  ...(matchingPreset
                    ? [
                        {
                          id: 'default',
                          separatorBefore: true,
                          label: 'Запомнить выбор',
                          hint: `Применять «${matchingPreset.name}» при открытии этой таблицы.`,
                          checked: isDefault,
                          checkType: 'checkbox' as const,
                          keepOpen: true,
                          disabled: !isDefault && matchingPreset.rules.some(presets.validate),
                          onSelect: () =>
                            presets.library.setDefault(isDefault ? null : matchingPreset.id),
                        },
                      ]
                    : []),
                  ...(!matchingPreset && presets.rules.length
                    ? [
                        {
                          id: 'save',
                          label: 'Сохранить текущие условия',
                          icon: <BookmarkPlus />,
                          disabled: !presets.rules.length || presets.rules.some(presets.validate),
                          onSelect: () => manage('save'),
                        },
                      ]
                    : []),
                  {
                    id: 'manage',
                    label: 'Управление наборами',
                    icon: <Settings2 />,
                    onSelect: () => manage('library'),
                  },
                  ...(presets.library.notice?.error
                    ? [
                        {
                          id: 'error',
                          group: 'Не удалось сохранить',
                          label: presets.library.notice.text,
                          disabled: true,
                        },
                      ]
                    : []),
                ]}
              />
            </Tooltip>
          </span>
        )}
      </div>
      <Tooltip content={sortCount ? `Сортировка · условий: ${sortCount}` : 'Настроить сортировку'}>
        <IconButton
          size="sm"
          variant={sortCount ? 'tonal' : 'ghost'}
          icon={<ArrowDownUp />}
          aria-label="Настроить сортировку"
          aria-pressed={sortCount > 0}
          onClick={(event) => onOpen('sort', event.currentTarget)}
        />
      </Tooltip>
      {!primaryOnly && (
        <>
          <Tooltip
            content={
              groupLabel ? `Группировка по полю «${groupLabel}»` : 'Объединить ресурсы по полю'
            }
          >
            <IconButton
              size="sm"
              variant={groupLabel ? 'tonal' : 'ghost'}
              icon={<Group />}
              aria-label="Настроить группировку"
              aria-pressed={Boolean(groupLabel)}
              onClick={(event) => onOpen('group', event.currentTarget)}
            />
          </Tooltip>
          <Tooltip
            content={
              view === 'tiles' ? 'Состав и порядок полей плиток' : 'Видимость и порядок столбцов'
            }
          >
            <IconButton
              size="sm"
              variant="ghost"
              icon={<Columns3 />}
              aria-label={view === 'tiles' ? 'Настроить поля плиток' : 'Настроить столбцы таблицы'}
              onClick={(event) => onOpen('columns', event.currentTarget)}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}
export type TableToolsPanelProps<F extends string = string> = {
  filterPresets?: TableFilterPresetLibrary<F>;
  presetAction?: 'library' | 'save';
  describeFilter?: (rule: TableFilterRule<F>) => string;
  view?: DataTableView;
  mode: TableToolsMode;
  anchor: HTMLElement | null;
  field?: F | null;
  caption: string;
  fields: TableFilterField<F>[];
  columns: TableToolColumn[];
  value: TableToolsValue<F>;
  defaultOrder: string[];
  defaultHidden?: Set<string>;
  validateFilter: (rule: TableFilterRule<F>) => string;
  countResults: (rules: TableFilterRule<F>[]) => number;
  countGroups?: (grouping: TableGroupRule) => number;
  onApply: (value: TableToolsValue<F>) => void;
  onClose: () => void;
};

const operatorLabels: Record<TableFilterOperator, string> = {
  contains: 'Содержит',
  equals: 'Равно',
  startsWith: 'Начинается с',
  notContains: 'Не содержит',
  in: 'Любое из',
  notIn: 'Ни одно из',
  between: 'В диапазоне',
  gte: 'Не меньше',
  lte: 'Не больше',
};
export function tableFilterOperators(kind: TableFilterKind): TableFilterOperator[] {
  if (kind === 'enum') return ['in', 'notIn'];
  if (kind === 'number' || kind === 'date') return ['between', 'equals', 'gte', 'lte'];
  if (kind === 'ip') return ['startsWith', 'equals'];
  return ['contains', 'equals', 'startsWith', 'notContains'];
}
function newRule<F extends string>(field: TableFilterField<F>): TableFilterRule<F> {
  return {
    field: field.id,
    operator: tableFilterOperators(field.kind)[0],
    value: '',
    to: '',
    values: [],
  };
}
function hasValue(rule: TableFilterRule) {
  return Boolean(
    rule.values.length || rule.value.trim() || (rule.operator === 'between' && rule.to.trim()),
  );
}
function ruleHint<F extends string>(field: TableFilterField<F>, rule: TableFilterRule<F>) {
  if (field.hint) return field.hint;
  if (field.kind === 'enum')
    return rule.operator === 'in'
      ? 'Достаточно совпадения с одним выбранным значением.'
      : 'Все выбранные значения исключаются из результата.';
  if (field.kind === 'date')
    return rule.operator === 'between'
      ? 'Включая обе даты. Можно указать только начало или конец.'
      : 'По календарной дате, включая весь день.';
  if (rule.operator === 'between') return 'Включая границы. Можно указать только одну.';
  if (field.kind === 'number') return `Числовое значение${field.unit ? `, ${field.unit}` : ''}.`;
  if (field.kind === 'ip')
    return rule.operator === 'startsWith' ? 'Начало адреса, например 10.20.' : 'Полный IP-адрес.';
  return 'Сравнение без учёта регистра.';
}

function FilterValue<F extends string>({
  field,
  rule,
  rules,
  change,
}: {
  field: TableFilterField<F>;
  rule: TableFilterRule<F>;
  rules: TableFilterRule<F>[];
  change: (rule: TableFilterRule<F>) => void;
}) {
  if (field.kind === 'enum')
    return (
      <Select
        label={`Значения: ${field.label}`}
        multiple
        searchable
        placeholder="Выберите значения"
        value={rule.values}
        onValueChange={(values: string[]) => change({ ...rule, values })}
        options={typeof field.options === 'function' ? field.options(rules) : field.options || []}
      />
    );
  const range = rule.operator === 'between';
  const type = field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text';
  const input = (bound: 'value' | 'to') => (
    <Input
      label={
        range ? `${field.label} ${bound === 'value' ? 'от' : 'до'}` : `Значение: ${field.label}`
      }
      type={type}
      min={field.kind === 'number' ? (field.min ?? 0) : undefined}
      max={field.kind === 'number' ? field.max : undefined}
      step={field.kind === 'number' ? 'any' : undefined}
      value={rule[bound]}
      suffix={field.unit}
      placeholder={
        range
          ? bound === 'value'
            ? 'От'
            : 'До'
          : field.placeholder || (field.kind === 'ip' ? '10.20.' : 'Значение')
      }
      onChange={(event) => change({ ...rule, [bound]: event.target.value })}
      onInput={
        field.kind === 'date'
          ? (event) => change({ ...rule, [bound]: event.currentTarget.value })
          : undefined
      }
    />
  );
  return range ? (
    <div className="basis-tt-condition-range">
      {input('value')}
      <span aria-hidden="true">—</span>
      {input('to')}
    </div>
  ) : (
    input('value')
  );
}

function FilterSettings<F extends string>({
  rules,
  onChange,
  field,
  fields,
  validate,
}: {
  rules: TableFilterRule<F>[];
  onChange: (rules: TableFilterRule<F>[]) => void;
  field?: F | null;
  fields: TableFilterField<F>[];
  validate: (rule: TableFilterRule<F>) => string;
}) {
  const shown = field ? rules.filter((r) => r.field === field) : rules;
  const available = fields.filter((f) => !rules.some((r) => r.field === f.id));
  const change = (before: TableFilterRule<F>, after: TableFilterRule<F>) =>
    onChange(rules.map((r) => (r === before ? after : r)));
  return (
    <div className="basis-tt-table-conditions" data-single={Boolean(field)}>
      {!field && (
        <div className="basis-tt-condition-logic">
          <span>Все условия</span>
          <span className="basis-tt-logic-connector">И</span>
          <p>Ресурс должен соответствовать каждому условию.</p>
        </div>
      )}
      <div className="basis-tt-condition-list">
        {shown.map((rule, index) => {
          const definition = fields.find((f) => f.id === rule.field)!;
          const error = hasValue(rule) ? validate(rule) : '';
          return (
            <div
              key={rule.field}
              className="basis-tt-condition-rule"
              data-filter-field={rule.field}
            >
              <div className="basis-tt-condition-rule__caption">
                <span>{field ? 'Условие отбора' : `Условие ${index + 1}`}</span>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Удалить условие: ${definition.label}`}
                  icon={<X />}
                  onClick={() => onChange(rules.filter((r) => r !== rule))}
                />
              </div>
              <div className="basis-tt-condition-rule__fields">
                {!field && (
                  <Select
                    label="Поле"
                    value={rule.field}
                    onValueChange={(id: F) =>
                      change(rule, newRule(fields.find((f) => f.id === id)!))
                    }
                    options={[definition, ...available].map((f) => ({
                      value: f.id,
                      label: f.label,
                      description: f.description,
                    }))}
                  />
                )}
                <Select
                  label="Условие"
                  value={rule.operator}
                  onValueChange={(operator: TableFilterOperator) =>
                    change(rule, { ...rule, operator })
                  }
                  options={tableFilterOperators(definition.kind).map((value) => ({
                    value,
                    label:
                      definition.kind === 'date' && value === 'gte'
                        ? 'Не раньше'
                        : definition.kind === 'date' && value === 'lte'
                          ? 'Не позже'
                          : operatorLabels[value],
                  }))}
                />
                <div className="basis-tt-condition-rule__value">
                  <FilterValue
                    field={definition}
                    rule={rule}
                    rules={rules}
                    change={(after) => change(rule, after)}
                  />
                </div>
              </div>
              {error ? (
                <p className="basis-tt-condition-validation" role="alert">
                  {error}
                </p>
              ) : (
                <p className="basis-tt-condition-hint">
                  <CircleHelp size={12} />
                  {ruleHint(definition, rule)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!shown.length && (
        <div className="basis-tt-tool-empty">
          <strong>Без ограничений</strong>
          <p>
            {field
              ? 'Добавьте условие для этого столбца.'
              : 'Добавьте только те поля, которые нужны для поиска.'}
          </p>
        </div>
      )}
      <div className="basis-tt-condition-add">
        {field
          ? !shown.length && (
              <Button
                size="sm"
                variant="tonal"
                leadingIcon={<Plus />}
                onClick={() => onChange([...rules, newRule(fields.find((f) => f.id === field)!)])}
              >
                Добавить условие
              </Button>
            )
          : available.length > 0 && (
              <>
                <span>Добавить условие</span>
                <div>
                  {available.map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant="ghost"
                      leadingIcon={<Plus />}
                      onClick={() => onChange([...rules, newRule(f)])}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
      </div>
    </div>
  );
}

function SortSettings({
  rules,
  onChange,
  hidden,
  fields,
}: {
  rules: SortState[];
  onChange: (rules: SortState[]) => void;
  hidden: Set<string>;
  fields: Pick<TableFilterField, 'id' | 'label' | 'description' | 'kind' | 'groupable'>[];
}) {
  const available = fields.filter((f) => !rules.some((r) => r.column === f.id));
  const update = (index: number, rule: SortState) =>
    onChange(rules.map((r, i) => (i === index ? rule : r)));
  const move = (index: number, delta: number) => {
    const next = [...rules];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="basis-tt-table-sort-settings">
      <p className="basis-tt-tool-note">
        Первое поле задаёт основной порядок. Следующее используется, если значения совпали.
      </p>
      <div className="basis-tt-sort-rules">
        {rules.map((rule, index) => {
          const field = fields.find((f) => f.id === rule.column)!;
          const numeric = ['number', 'ip'].includes(field.kind);
          const date = field.kind === 'date';
          return (
            <div className="basis-tt-sort-rule" key={rule.column}>
              <span className="basis-tt-sort-priority" aria-label={`Приоритет ${index + 1}`}>
                Уровень {index + 1}
              </span>
              <Select
                label={`Поле сортировки ${index + 1}`}
                value={rule.column}
                onValueChange={(column: string) => update(index, { ...rule, column })}
                options={[field, ...available].map((f) => ({ value: f.id, label: f.label }))}
              />
              <Select
                label={`Порядок сортировки ${index + 1}`}
                value={rule.direction}
                onValueChange={(direction: 'asc' | 'desc') => update(index, { ...rule, direction })}
                options={[
                  {
                    value: 'asc',
                    label: date ? 'Сначала старые' : numeric ? 'По возрастанию' : 'А → Я',
                    icon: <ArrowUp />,
                  },
                  {
                    value: 'desc',
                    label: date ? 'Сначала новые' : numeric ? 'По убыванию' : 'Я → А',
                    icon: <ArrowDown />,
                  },
                ]}
              />
              <div className="basis-tt-sort-rule__actions">
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Повысить приоритет: ${field.label}`}
                  icon={<ArrowUp />}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Понизить приоритет: ${field.label}`}
                  icon={<ArrowDown />}
                  disabled={index === rules.length - 1}
                  onClick={() => move(index, 1)}
                />
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Удалить сортировку: ${field.label}`}
                  icon={<X />}
                  onClick={() => onChange(rules.filter((_, i) => i !== index))}
                />
              </div>
              {hidden.has(rule.column) && (
                <p className="basis-tt-sort-hidden-note">
                  Столбец скрыт, но участвует в сортировке.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!rules.length && (
        <div className="basis-tt-tool-empty">
          <strong>Исходный порядок</strong>
          <p>Добавьте поле, чтобы задать порядок ресурсов.</p>
        </div>
      )}
      {available.length > 0 && (
        <Select
          label="Добавить уровень"
          placeholder="Выберите поле"
          value=""
          onValueChange={(column: string) => onChange([...rules, { column, direction: 'asc' }])}
          options={available.map((f) => ({ value: f.id, label: f.label }))}
        />
      )}
      <p className="basis-tt-tool-note basis-tt-tool-keyboard">
        <kbd>Shift</kbd> + заголовок добавляет поле к текущему порядку. Пустые значения всегда в
        конце.
      </p>
    </div>
  );
}

function GroupSettings({
  value,
  fields,
  hidden,
  onChange,
}: {
  value: TableGroupRule | null;
  fields: Pick<TableFilterField, 'id' | 'label' | 'description' | 'kind' | 'groupable'>[];
  hidden: Set<string>;
  onChange: (value: TableGroupRule | null) => void;
}) {
  const field = fields.find((item) => item.id === value?.field);
  return (
    <div className="basis-tt-group-settings">
      <p className="basis-tt-tool-note">
        Ресурсы с одинаковым значением поля объединяются в группы. Внутри сохраняется выбранная
        сортировка.
      </p>
      <div className="basis-tt-group-fields">
        <Select
          label="Группировать по"
          value={value?.field ?? '__none__'}
          onValueChange={(id: string) =>
            onChange(id === '__none__' ? null : { field: id, direction: value?.direction ?? 'asc' })
          }
          options={[
            { value: '__none__', label: 'Без группировки', description: 'Единый список ресурсов' },
            ...fields
              .filter((item) => item.groupable !== false)
              .map((item) => ({
                value: item.id,
                label: item.label,
                description: item.description,
              })),
          ]}
        />
        {value && (
          <Select
            label="Порядок групп"
            value={value.direction}
            onValueChange={(direction: string) =>
              onChange({ ...value, direction: direction as 'asc' | 'desc' })
            }
            options={[
              {
                value: 'asc',
                label:
                  field?.kind === 'number'
                    ? 'От меньшего к большему'
                    : field?.kind === 'date'
                      ? 'Сначала ранние даты'
                      : 'А → Я',
                icon: <ArrowUp />,
              },
              {
                value: 'desc',
                label:
                  field?.kind === 'number'
                    ? 'От большего к меньшему'
                    : field?.kind === 'date'
                      ? 'Сначала поздние даты'
                      : 'Я → А',
                icon: <ArrowDown />,
              },
            ]}
          />
        )}
        {value && hidden.has(value.field) && (
          <p className="basis-tt-tool-note">
            Столбец скрыт. Его значение останется видно в заголовке группы.
          </p>
        )}
      </div>
      <p className="basis-tt-tool-note">
        {field?.kind === 'date'
          ? 'Даты объединяются по календарному дню. '
          : field?.kind === 'number'
            ? 'Каждое точное значение образует группу. '
            : ''}
        Пустые значения попадают в группу «Не задано» в конце списка.
      </p>
      <p className="basis-tt-tool-note">
        Счётчики учитывают поиск и фильтры. Если группа разбита на страницы, рядом указано, сколько
        её ресурсов показано сейчас. Выбор группы отмечает строки только на текущей странице.
      </p>
    </div>
  );
}

function ColumnSettings({
  view = 'table',
  columns,
  order,
  hidden,
  onOrder,
  onHidden,
}: {
  view?: DataTableView;
  columns: TableToolColumn[];
  order: string[];
  hidden: Set<string>;
  onOrder: (order: string[]) => void;
  onHidden: (hidden: Set<string>) => void;
}) {
  const [query, setQuery] = useState('');
  const map = new Map(columns.map((column) => [column.id, column]));
  const shown = order.filter((id) =>
    `${map.get(id)?.label} ${map.get(id)?.description || ''}`
      .toLocaleLowerCase('ru')
      .includes(query.trim().toLocaleLowerCase('ru')),
  );
  const canMove = (index: number, delta: number) =>
    index + delta >= 0 && index + delta < order.length && !map.get(order[index + delta])?.locked;
  const move = (index: number, delta: number) => {
    if (!canMove(index, delta)) return;
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onOrder(next);
  };
  return (
    <div className="basis-tt-table-column-settings">
      <Input
        aria-label={view === 'tiles' ? 'Найти поле' : 'Найти столбец'}
        placeholder={view === 'tiles' ? 'Найти поле' : 'Найти столбец'}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leadingIcon={<Search />}
        onClear={query ? () => setQuery('') : undefined}
      />
      <div className="basis-tt-column-settings-summary">
        <span>
          Видно{' '}
          <strong>
            {order.length - hidden.size} из {order.length}
          </strong>
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!hidden.size}
          onClick={() => onHidden(new Set())}
        >
          Показать все
        </Button>
      </div>
      {shown.length > 0 && (
        <div className="basis-tt-column-options">
          {shown.map((id) => {
            const column = map.get(id)!,
              index = order.indexOf(id);
            return (
              <div className="basis-tt-column-option" key={id} data-hidden={hidden.has(id)}>
                <Checkbox
                  label={column.label}
                  description={column.description}
                  checked={!hidden.has(id)}
                  disabled={column.locked}
                  onCheckedChange={(checked) => {
                    const next = new Set(hidden);
                    if (checked) next.delete(id);
                    else next.add(id);
                    onHidden(next);
                  }}
                />
                {column.locked ? (
                  <span className="basis-tt-column-lock">
                    <LockKeyhole size={12} />
                    Закреплён
                  </span>
                ) : (
                  <div className="basis-tt-column-move">
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Переместить ${view === 'tiles' ? 'выше' : 'влево'}: ${column.label}`}
                      icon={<ArrowUp />}
                      disabled={!canMove(index, -1)}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Переместить ${view === 'tiles' ? 'ниже' : 'вправо'}: ${column.label}`}
                      icon={<ArrowDown />}
                      disabled={!canMove(index, 1)}
                      onClick={() => move(index, 1)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!shown.length && (
        <div className="basis-tt-tool-empty">
          <strong>{view === 'tiles' ? 'Поле не найдено' : 'Столбец не найден'}</strong>
          <p>Попробуйте другое название.</p>
        </div>
      )}
      <p className="basis-tt-tool-note">
        {view === 'tiles'
          ? 'Состав и порядок полей общие с таблицей. Имя и действия остаются в шапке плитки. Скрытие поля сохраняет его фильтр, сортировку и группировку.'
          : 'Скрытие столбца сохраняет его фильтр, сортировку и группировку. Закреплённые столбцы остаются на своих местах.'}
      </p>
    </div>
  );
}

/** Mount while open. Drafts are isolated until Apply; every consumer uses this same panel. */
export function TableToolsPanel<F extends string = string>(props: TableToolsPanelProps<F>) {
  const {
    mode,
    anchor,
    field,
    caption,
    fields,
    columns,
    value,
    onClose,
    onApply,
    validateFilter,
    countResults,
  } = props;
  const [filters, setFilters] = useState(() => {
    const next = value.filters.map((r) => ({ ...r, values: [...r.values] }));
    if (mode === 'filters' && field && !next.some((r) => r.field === field))
      next.push(newRule(fields.find((f) => f.id === field)!));
    return next;
  });
  const [sorts, setSorts] = useState(() => value.sorts.map((r) => ({ ...r })));
  const [order, setOrder] = useState(() => [...value.order]);
  const [hidden, setHidden] = useState(() => new Set(value.hidden));
  const [grouping, setGrouping] = useState<TableGroupRule | null>(() =>
    value.grouping ? { ...value.grouping } : null,
  );
  const [filterSection, setFilterSection] = useState<'conditions' | 'saved'>(
    props.presetAction === 'library' ? 'saved' : 'conditions',
  );
  const hasPresets = mode === 'filters' && !field && Boolean(props.filterPresets);
  const valid = filters.every((r) => !validateFilter(r));
  const title =
    mode === 'filters'
      ? field
        ? `Фильтр · ${fields.find((f) => f.id === field)?.label}`
        : 'Фильтры'
      : mode === 'sort'
        ? 'Сортировка'
        : mode === 'group'
          ? 'Группировка'
          : props.view === 'tiles'
            ? 'Поля плиток'
            : 'Столбцы таблицы';
  const reset = () => {
    if (mode === 'filters') setFilters(field ? filters.filter((r) => r.field !== field) : []);
    else if (mode === 'sort') setSorts([]);
    else if (mode === 'group') setGrouping(null);
    else {
      setOrder([...props.defaultOrder]);
      setHidden(new Set(props.defaultHidden));
    }
  };
  return (
    <ContextPanel
      open
      anchor={anchor}
      presentation="drawer"
      title={title}
      description={
        mode === 'filters'
          ? `${caption} · условия по типу данных`
          : mode === 'sort'
            ? 'Порядок ресурсов и приоритет полей'
            : mode === 'group'
              ? `${caption} · объединение по полю`
              : props.view === 'tiles'
                ? 'Состав и порядок · общие с таблицей'
                : 'Видимость и порядок столбцов'
      }
      icon={
        mode === 'filters' ? (
          <ListFilter />
        ) : mode === 'sort' ? (
          <ArrowDownUp />
        ) : mode === 'group' ? (
          <Group />
        ) : (
          <Columns3 />
        )
      }
      onClose={onClose}
      footer={
        hasPresets && filterSection === 'saved' ? (
          <div className="basis-filter-preset-footer">
            <span>Хранятся в этом браузере</span>
            <Button onClick={onClose}>Готово</Button>
          </div>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={reset}>
              {mode === 'columns' ? 'По умолчанию' : 'Сбросить'}
            </Button>
            <span className="panel-result" aria-live="polite">
              {mode === 'filters' ? (
                valid ? (
                  <>
                    Найдено: <strong>{countResults(filters)}</strong>
                  </>
                ) : (
                  'Заполните условия'
                )
              ) : mode === 'sort' ? (
                <>
                  Уровней: <strong>{sorts.length}</strong>
                </>
              ) : mode === 'group' ? (
                grouping ? (
                  <>
                    Групп: <strong>{props.countGroups?.(grouping) ?? '—'}</strong>
                  </>
                ) : (
                  'Без группировки'
                )
              ) : (
                <>
                  Видно: <strong>{order.length - hidden.size}</strong>
                </>
              )}
            </span>
            <Button onClick={onClose}>Отмена</Button>
            <Button
              variant="primary"
              disabled={mode === 'filters' && !valid}
              onClick={() => {
                onApply({
                  filters,
                  sorts,
                  order,
                  hidden,
                  ...(grouping !== null || value.grouping !== undefined ? { grouping } : {}),
                });
                onClose();
              }}
            >
              Применить
            </Button>
          </>
        )
      }
    >
      <div className="basis-table-tools" data-tool={mode}>
        {mode === 'filters' ? (
          hasPresets ? (
            <FilterPresetSettings
              library={props.filterPresets!}
              rules={filters}
              describe={
                props.describeFilter ||
                ((rule) =>
                  `${fields.find((f) => f.id === rule.field)?.label || rule.field}: ${rule.values.length ? rule.values.join(', ') : rule.value}`)
              }
              validate={(rule) =>
                fields.some((f) => f.id === rule.field) ? validateFilter(rule) : 'Поле недоступно'
              }
              section={filterSection}
              onSectionChange={setFilterSection}
              initialSave={props.presetAction === 'save'}
              onApply={(rules) => {
                onApply({ ...value, filters: rules });
                onClose();
              }}
            >
              <FilterSettings
                rules={filters}
                onChange={setFilters}
                fields={fields}
                validate={validateFilter}
              />
            </FilterPresetSettings>
          ) : (
            <FilterSettings
              rules={filters}
              onChange={setFilters}
              field={field}
              fields={fields}
              validate={validateFilter}
            />
          )
        ) : mode === 'sort' ? (
          <SortSettings
            rules={sorts}
            onChange={setSorts}
            hidden={hidden}
            fields={fields.map(({ options: _options, ...f }) => f)}
          />
        ) : mode === 'group' ? (
          <GroupSettings value={grouping} onChange={setGrouping} fields={fields} hidden={hidden} />
        ) : (
          <ColumnSettings
            view={props.view}
            columns={columns}
            order={order}
            hidden={hidden}
            onOrder={setOrder}
            onHidden={setHidden}
          />
        )}
      </div>
    </ContextPanel>
  );
}

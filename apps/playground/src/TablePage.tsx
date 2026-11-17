import {
  blankFilters,
  activeFilters,
  filterMatches,
  filterLabels,
  type Filters,
} from './table-model';
import { filterError, formatFilter, sortResources, type FilterField } from './table-model';
import { columnDescriptions, columnIds, toolColumns, toolFields } from './table-tools-config';
import { useDesign } from './DesignContext';
import { ComponentTokens } from './TokenPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, ArrowLeft, Info, Power, Search, Server, Square, X } from 'lucide-react';
import {
  Button,
  ContextPanel,
  DataTable,
  useIncrementalPages,
  useTableFilterPresets,
  loadDefaultFilterRules,
  type TablePagingMode,
  type TableNavigationPlacement,
  IconButton,
  Input,
  Message,
  Menu,
  Select,
  TableEmptyState,
  type DataTableState,
  type DataTableView,
  StatusBadge,
  TableToolsPanel,
  TableToolbarActions,
  groupTableRows,
  tableGroupValue,
  type DataColumn,
  type SortState,
  type TableGroupRule,
  type TableGrouping,
  type TableToolsMode,
} from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';

type VM = {
  id: string;
  name: string;
  status: 'running' | 'off' | 'error';
  cpu: number;
  ram: number;
  project: string;
  ip: string;
};
const initial: VM[] = [
  {
    id: 'vm-001',
    name: 'prod-api-01',
    status: 'running',
    cpu: 42,
    ram: 16,
    project: 'Production',
    ip: '10.20.1.14',
  },
  {
    id: 'vm-002',
    name: 'prod-api-02',
    status: 'running',
    cpu: 38,
    ram: 16,
    project: 'Production',
    ip: '10.20.1.15',
  },
  {
    id: 'vm-003',
    name: 'prod-database-01',
    status: 'running',
    cpu: 87,
    ram: 64,
    project: 'Production',
    ip: '10.20.2.10',
  },
  {
    id: 'vm-004',
    name: 'stage-worker-01',
    status: 'error',
    cpu: 0,
    ram: 8,
    project: 'Staging',
    ip: '10.30.1.22',
  },
  {
    id: 'vm-005',
    name: 'stage-gateway-01',
    status: 'running',
    cpu: 21,
    ram: 8,
    project: 'Staging',
    ip: '10.30.0.2',
  },
  {
    id: 'vm-006',
    name: 'dev-sandbox-01',
    status: 'off',
    cpu: 0,
    ram: 4,
    project: 'Development',
    ip: '10.40.1.10',
  },
  {
    id: 'vm-007',
    name: 'dev-runner-01',
    status: 'off',
    cpu: 0,
    ram: 8,
    project: 'Development',
    ip: '10.40.1.11',
  },
  {
    id: 'vm-008',
    name: 'prod-monitoring-01',
    status: 'running',
    cpu: 12,
    ram: 16,
    project: 'Production',
    ip: '10.20.3.5',
  },
];
const statuses = { running: 'Работает', off: 'Выключена', error: 'Ошибка' };
const blank = blankFilters;

export function TablePage() {
  const { resolved } = useDesign();
  const readResource = () => new URLSearchParams(location.hash.split('?')[1]).get('resource');
  const [openedId, setOpenedId] = useState(readResource);
  useEffect(() => {
    const update = () => setOpenedId(readResource());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const columnWidth = (name: string) => resolved[`comp.table.column.${name}.width`].value.value;
  const [filterField, setFilterField] = useState<FilterField | null>(null);
  const [rows, setRows] = useState(() => [
      ...initial,
      ...Array.from({ length: 16 }, (_, i): VM => ({
        ...initial[i % initial.length],
        id: `vm-${String(i + 9).padStart(3, '0')}`,
        name: initial[i % initial.length].name.replace(/\d+$/, String(i + 3).padStart(2, '0')),
        ip: `10.50.${Math.floor(i / initial.length)}.${i + 10}`,
      })),
    ]),
    [selected, setSelected] = useState(new Set<string>()),
    [query, setQuery] = useState('');
  const [sorts, setSorts] = useState<SortState[]>([{ column: 'name', direction: 'asc' }]);
  const [grouping, setGrouping] = useState<TableGroupRule | null>(null);
  const [view, setView] = useState<DataTableView>('table');
  const [paging, setPaging] = useState<TablePagingMode>('pages');
  const [navigationPlacement, setNavigationPlacement] = useState<TableNavigationPlacement>('both');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState('ready');
  const [requestPhase, setRequestPhase] = useState<DataTableState | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTable = () => {
    if (refreshTimer.current) return;
    setRequestPhase(scenario === 'error' ? 'loading' : 'refreshing');
    refreshTimer.current = setTimeout(() => {
      setRequestPhase(null);
      if (scenario === 'error' || scenario === 'stale') setScenario('ready');
      setMessage('Данные обновлены · поиск, настройки и выбор сохранены');
      refreshTimer.current = null;
    }, 1600);
  };
  const changeScenario = (value: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
    setRequestPhase(null);
    setScenario(value);
    setCurrentPage(1);
    if (value === 'append-error') setPaging('infinite');
    setSelected(new Set());
  };
  const [columnOrder, setColumnOrder] = useState(columnIds);
  const [panelAnchor, setPanelAnchor] = useState<HTMLElement | null>(null);
  const [filters, setFilters] = useState<Filters>(
    () =>
      loadDefaultFilterRules<FilterField>('basis.filter-presets.v1:playground:table', (rule) =>
        toolFields.some((f) => f.id === rule.field) ? filterError(rule) : 'Поле недоступно',
      ) || blank,
  );
  const [presetAction, setPresetAction] = useState<'library' | 'save' | undefined>();
  const validateSavedFilter = (rule: Filters[number]) =>
    toolFields.some((f) => f.id === rule.field) ? filterError(rule) : 'Поле недоступно';
  const savedFilters = useTableFilterPresets<FilterField>(
    'basis.filter-presets.v1:playground:table',
    validateSavedFilter,
  );
  const describeSavedFilter = (rule: Filters[number]) =>
    toolFields.some((f) => f.id === rule.field)
      ? formatFilter(rule)
      : `Поле «${rule.field}» недоступно`;
  const [panel, setPanel] = useState<TableToolsMode | null>(null),
    [hidden, setHidden] = useState(new Set<string>()),
    [previewId, setPreviewId] = useState<string | null>(null);
  const [pending, setPending] = useState<'running' | 'off' | null>(null),
    [message, setMessage] = useState(
      'Демонстрационные ресурсы · изменения сохраняются до перезагрузки',
    );
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  const preview = rows.find((row) => row.id === previewId);
  const applied = activeFilters(filters),
    filterCount = applied.length;
  const filtered = useMemo(() => {
    const result = rows.filter(
      (row) =>
        `${row.name} ${row.ip} ${row.project}`.toLowerCase().includes(query.trim().toLowerCase()) &&
        filterMatches(row, filters),
    );
    return sortResources(result, sorts);
  }, [rows, query, filters, sorts]);
  const resultRows = ['empty', 'filtered'].includes(scenario) ? [] : filtered;
  const tableState: DataTableState =
    requestPhase ??
    (['loading', 'refreshing', 'error', 'stale'].includes(scenario)
      ? (scenario as DataTableState)
      : 'ready');
  const groupConfig = (rule: TableGroupRule): TableGrouping<VM> => {
    const field = toolFields.find((item) => item.id === rule.field)!;
    return {
      id: field.id,
      label: field.label,
      direction: rule.direction,
      getValue: (row) =>
        tableGroupValue(field.id === 'cpu' && row.status !== 'running' ? null : row[field.id], {
          kind: field.kind,
          unit: field.unit,
          label: field.id === 'status' ? statuses[row.status] : undefined,
        }),
      onClear: () => setGrouping(null),
    };
  };
  const resultGroups = grouping
    ? groupTableRows(resultRows, groupConfig(grouping).getValue, grouping.direction)
    : [];
  const ordered = grouping ? resultGroups.flatMap((group) => group.rows) : resultRows;
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.min(currentPage, pages);
  const displayRows = ordered.slice(
    paging === 'infinite' ? 0 : (page - 1) * pageSize,
    page * pageSize,
  );
  const resultKey = JSON.stringify([query, filters, sorts, grouping, scenario]);
  const pagingKey = JSON.stringify([resultKey, pageSize]);
  useEffect(() => {
    setCurrentPage(1);
  }, [resultKey]);
  const failedBatch = useRef({ failed: false });
  useEffect(() => {
    failedBatch.current = { failed: false };
  }, [pagingKey]);
  const incremental = useIncrementalPages({
    mode: paging,
    page,
    pages,
    resetKey: pagingKey,
    disabled: tableState !== 'ready' && tableState !== 'stale',
    onPageChange: setCurrentPage,
    loadPage: async () => {
      const attempt = failedBatch.current;
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (scenario === 'append-error' && !attempt.failed) {
        attempt.failed = true;
        throw new Error('Сервис временно недоступен. Повторите запрос.');
      }
    },
  });
  const startable = rows.filter((row) => selected.has(row.id) && row.status !== 'running');
  const stoppable = rows.filter((row) => selected.has(row.id) && row.status === 'running');
  const perform = (ids: string[], status: VM['status']) => {
    if (pending || !ids.length) return;
    setPending(status === 'running' ? 'running' : 'off');
    setMessage(
      status === 'running' ? 'Запускаем выбранные машины…' : 'Выключаем выбранные машины…',
    );
    timer.current = setTimeout(() => {
      setRows((current) =>
        current.map((row) =>
          ids.includes(row.id) ? { ...row, status, cpu: status === 'running' ? 8 : 0 } : row,
        ),
      );
      setPending(null);
      setMessage(`${status === 'running' ? 'Запущено' : 'Выключено'} машин: ${ids.length}.`);
    }, 1800);
  };
  const openFilters = (field: FilterField | null = null, anchor?: HTMLElement) => {
    setPresetAction(undefined);
    setFilterField(field);
    setPanelAnchor(anchor || (document.activeElement as HTMLElement));
    setPanel('filters');
  };
  const hasFilter = (field: string) => applied.includes(field as FilterField);
  const changeSort = (rule: SortState, additive = false) =>
    setSorts((current) =>
      additive
        ? current.some((item) => item.column === rule.column)
          ? current.map((item) => (item.column === rule.column ? rule : item))
          : [...current, rule]
        : [rule],
    );
  const columns: DataColumn<VM>[] = [
    {
      id: 'name',
      header: filterLabels.name,
      pinned: 'start',
      width: columnWidth('identity'),
      filter: {
        active: hasFilter('name'),
        onClick: (event) => openFilters('name', event.currentTarget),
      },
      sortable: true,
      description: columnDescriptions.name,
      render: (row) => (
        <a className="vm-name" href={`#table?resource=${row.id}`}>
          <Server size={16} aria-hidden="true" />
          {row.name}
        </a>
      ),
    },
    {
      id: 'status',
      tile: { span: 'full' },
      header: filterLabels.status,
      width: columnWidth('status'),
      sortable: true,
      description: columnDescriptions.status,
      filter: {
        active: hasFilter('status'),
        onClick: (event) => openFilters('status', event.currentTarget),
      },
      render: (row) => (
        <StatusBadge
          tone={
            row.status === 'running' ? 'success' : row.status === 'error' ? 'danger' : 'neutral'
          }
        >
          {statuses[row.status]}
        </StatusBadge>
      ),
    },
    {
      id: 'cpu',
      tile: { emphasis: 'metric' },
      header: filterLabels.cpu,
      width: columnWidth('numeric'),
      filter: {
        active: hasFilter('cpu'),
        onClick: (event) => openFilters('cpu', event.currentTarget),
      },
      sortable: true,
      align: 'right',
      description: columnDescriptions.cpu,
      render: (row) => (
        <span className={`cpu-cell ${row.cpu >= 80 ? 'high' : ''}`}>
          <span className="cpu-track">
            <i style={{ width: `${row.cpu}%` }} />
          </span>
          <span>{row.status === 'running' ? `${row.cpu}%` : '—'}</span>
        </span>
      ),
    },
    {
      id: 'ram',
      tile: { emphasis: 'metric' },
      header: filterLabels.ram,
      width: columnWidth('numeric'),
      filter: {
        active: hasFilter('ram'),
        onClick: (event) => openFilters('ram', event.currentTarget),
      },
      sortable: true,
      align: 'right',
      description: columnDescriptions.ram,
      render: (row) => (
        <span className="numeric">
          {row.ram}
          <span className="unit"> GiB</span>
        </span>
      ),
    },
    {
      id: 'project',
      header: filterLabels.project,
      width: columnWidth('relation'),
      filter: {
        active: hasFilter('project'),
        onClick: (event) => openFilters('project', event.currentTarget),
      },
      sortable: true,
      description: columnDescriptions.project,
      render: (row) => <span className="project-cell">{row.project}</span>,
    },
    {
      id: 'ip',
      header: filterLabels.ip,
      width: columnWidth('address'),
      sortable: true,
      filter: {
        active: hasFilter('ip'),
        onClick: (event) => openFilters('ip', event.currentTarget),
      },
      description: columnDescriptions.ip,
      render: (row) => <code className="ip-cell">{row.ip}</code>,
    },
    {
      id: 'actions',
      utility: 'actions',
      header: 'Действия',
      pinned: 'end',
      width: columnWidth('actions'),
      render: (row) => (
        <div className="row-actions">
          <Menu
            compact
            label={`Действия с ${row.name}`}
            items={[
              {
                id: 'power',
                label: row.status === 'running' ? 'Выключить ВМ' : 'Запустить ВМ',
                icon: <Power />,
                disabled: pending !== null,
                onSelect: () => perform([row.id], row.status === 'running' ? 'off' : 'running'),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  const opened = rows.find((row) => row.id === openedId);
  if (opened)
    return (
      <>
        <a className="vm-name" href="#table">
          <ArrowLeft size={16} />
          Вернуться к таблице
        </a>
        <PageHeading
          category="Сценарий таблицы / Страница ресурса"
          title={opened.name}
          description="Ссылка в имени открывает страницу ресурса. Возврат сохраняет настройки таблицы и выбранные строки."
        />
        <div className="table-resource-example">
          <ResourceDetails resource={opened} />
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        category="Составной компонент / DataTable"
        title="Таблицы"
        description="Таблица и плитки — два вида одного реестра. Общие поля, настройки, выбор и действия."
      />
      <div className="table-context">
        <div>
          <span className="context-icon">
            <Cloud size={20} />
          </span>
          <div>
            <strong>Виртуальные машины</strong>
            <span>
              Общий реестр <i /> {rows.length} ресурсов
            </span>
          </div>
        </div>
        <span className="component-tag">
          <span />
          DataTable × Button
        </span>
      </div>
      <div className="table-scenario-control">
        <Select
          label="Состояние таблицы"
          value={scenario}
          onValueChange={changeScenario}
          options={[
            { value: 'ready', label: 'Данные загружены' },
            {
              value: 'loading',
              label: 'Первая загрузка',
              description: 'Скелетон в выбранном виде',
            },
            {
              value: 'refreshing',
              label: 'Обновление данных',
              description: 'Строки и выбор сохраняются',
            },
            { value: 'empty', label: 'Пустой реестр', description: 'Ресурсы ещё не созданы' },
            {
              value: 'filtered',
              label: 'Нет совпадений',
              description: 'Поиск или фильтры не дали результата',
            },
            { value: 'error', label: 'Ошибка загрузки', description: 'Данные ещё не получены' },
            {
              value: 'append-error',
              label: 'Ошибка подгрузки',
              description: 'Первая порция доступна. Повторный запрос успешен.',
            },
            {
              value: 'stale',
              label: 'Ошибка обновления',
              description: 'Последние данные доступны, можно повторить',
            },
          ]}
        />
        <p>
          Выберите состояние для изучения дизайна. Загрузка остаётся видимой до смены примера;
          кнопка обновления запускает живой переход.
        </p>
      </div>
      {applied.length > 0 && (
        <div className="applied-filters">
          <span>Условия</span>
          {filters.map((rule) => (
            <div className="applied-condition" key={rule.field}>
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => openFilters(rule.field, event.currentTarget)}
              >
                {formatFilter(rule)}
              </Button>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={`Убрать фильтр: ${filterLabels[rule.field]}`}
                icon={<X />}
                onClick={() => {
                  setFilters(filters.filter((item) => item.field !== rule.field));
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="table-showcase">
        <DataTable
          view={view}
          onViewChange={setView}
          pagination={{
            mode: paging,
            placement: navigationPlacement,
            onPlacementChange: setNavigationPlacement,
            page,
            pageSize,
            pageSizeOptions: [4, 8, 12, 24],
            onPageSizeChange: (size) => {
              setCurrentPage(
                paging === 'infinite' ? 1 : Math.floor(((page - 1) * pageSize) / size) + 1,
              );
              setPageSize(size);
            },
            total: ordered.length,
            resetKey: pagingKey,
            onModeChange: (mode) => {
              if (mode !== paging) {
                setPaging(mode);
                setCurrentPage(1);
              }
            },
            onPageChange: setCurrentPage,
            ...incremental,
          }}
          rows={displayRows}
          state={tableState}
          error={
            tableState === 'error' || tableState === 'stale'
              ? 'Сервис ресурсов временно недоступен. Повторите запрос.'
              : undefined
          }
          onRefresh={refreshTable}
          onRowActivate={(row, origin) => {
            setPreviewAnchor(origin);
            setPreviewId(row.id);
          }}
          previewRowId={previewId || undefined}
          loadingRows={pageSize}
          columnWidths={columnWidths}
          onColumnWidthsChange={setColumnWidths}
          onToolsOpen={(mode, anchor) => {
            setPanelAnchor(anchor);
            setPanel(mode);
          }}
          tools={
            <TableToolbarActions
              presets={{
                library: savedFilters,
                rules: filters,
                describe: describeSavedFilter,
                validate: validateSavedFilter,
                onApply: setFilters,
                onManage: (action, anchor) => {
                  openFilters(null, anchor);
                  setPresetAction(action);
                },
              }}
              primaryOnly
              view={view}
              filterCount={filterCount}
              sortCount={sorts.length}
              onOpen={(mode, anchor) => {
                if (mode === 'filters') openFilters(null, anchor);
                else {
                  setPanelAnchor(anchor);
                  setPanel(mode);
                }
              }}
            />
          }
          columns={columnOrder
            .map((id) => columns.find((column) => column.id === id)!)
            .filter((column) => !hidden.has(column.id))}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          caption="Виртуальные машины — пример композиции"
          selected={selected}
          onSelectionChange={setSelected}
          sorts={sorts}
          grouping={
            grouping
              ? {
                  ...groupConfig(grouping),
                  totalGroups: resultGroups.length,
                  totalCounts: new Map(resultGroups.map((group) => [group.key, group.rows.length])),
                }
              : undefined
          }
          onSortChange={changeSort}
          rowTone={(row) =>
            row.status === 'error' ? 'error' : row.cpu >= 80 ? 'warning' : undefined
          }
          toolbar={
            <>
              <Input
                className="table-search-field"
                size="sm"
                leadingIcon={<Search />}
                aria-label="Поиск виртуальных машин"
                placeholder="Имя, IP-адрес или проект"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                onClear={query ? () => setQuery('') : undefined}
              />
            </>
          }
          bulkToolbar={
            <>
              <div className="bulk-label">
                <span>{selected.size}</span>выбрано
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Снять выделение"
                  icon={<X />}
                  onClick={() => setSelected(new Set())}
                />
              </div>
              <div className="bulk-actions">
                <Button
                  size="sm"
                  variant="primary"
                  leadingIcon={<Power />}
                  loading={pending === 'running'}
                  tone="brand"
                  disabled={pending === 'off' || !startable.length}
                  onClick={() =>
                    perform(
                      startable.map((row) => row.id),
                      'running',
                    )
                  }
                >
                  Запустить{startable.length ? ` · ${startable.length}` : ''}
                </Button>
                <Button
                  size="sm"
                  leadingIcon={<Square />}
                  loading={pending === 'off'}
                  tone="neutral"
                  disabled={pending === 'running' || !stoppable.length}
                  onClick={() =>
                    perform(
                      stoppable.map((row) => row.id),
                      'off',
                    )
                  }
                >
                  Выключить{stoppable.length ? ` · ${stoppable.length}` : ''}
                </Button>
              </div>
              <span className="bulk-hint">
                {[...selected].some((id) => !displayRows.some((row) => row.id === id))
                  ? `${[...selected].filter((id) => !displayRows.some((row) => row.id === id)).length} вне результата`
                  : 'Действия для доступных ВМ'}
              </span>
            </>
          }
          empty={
            scenario === 'empty' ? (
              <TableEmptyState
                title="Виртуальных машин пока нет"
                description="После создания машины её состояние и ресурсы появятся здесь."
                action={
                  <Button onClick={() => changeScenario('ready')}>Показать пример с данными</Button>
                }
              />
            ) : (
              <TableEmptyState
                kind="filtered"
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      setFilters(blank);
                      changeScenario('ready');
                    }}
                  >
                    Сбросить поиск и фильтры
                  </Button>
                }
              />
            )
          }
        />
      </div>
      <div className="table-message" role="status">
        <Info size={14} />
        {message}
      </div>
      <section className="ds-section">
        <SectionHeading
          number="01"
          title="Проверяем в контексте"
          note="Поведению уделено столько же внимания, сколько виду"
        />
        <div className="table-principles">
          <article>
            <span>01</span>
            <h3>Геометрия сохраняется</h3>
            <p>
              Массовые действия занимают место поиска. Фильтры, сортировка и настройки остаются
              доступны, заголовок и строки не сдвигаются.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Состояния наследуются</h3>
            <p>Те же размеры, фокус, disabled и облачный загрузчик, что на странице кнопок.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Проблемы заметны</h3>
            <p>Мягкий фон ошибки и предупреждения. При выборе строки цветной маркер остаётся.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Связи видны в группах</h3>
            <p>
              Объедините ресурсы по проекту или статусу. Сворачивание сохраняет выбранные строки, а
              счётчики учитывают фильтры.
            </p>
          </article>
          <article>
            <span>05</span>
            <h3>Одно пояснение поля</h3>
            <p>
              Значок ⓘ появляется, если у колонки есть описание. Подсказка и настройки показывают
              один и тот же текст.
            </p>
          </article>
          <article>
            <span>06</span>
            <h3>Предсказуемый просмотр</h3>
            <p>
              Нажатие на строку, плитку или Enter / пробел открывает быстрый просмотр справа. Ссылка
              в имени ведёт на страницу ресурса, чекбокс выбирает строку, кнопки выполняют свои
              действия. После закрытия просмотра фокус возвращается к строке.
            </p>
          </article>
          <article>
            <span>07</span>
            <h3>Меняется только представление</h3>
            <p>
              Таблица помогает сравнивать значения по столбцам, плитки — читать каждый ресурс
              целиком. Поиск, фильтры, сортировка, группы, страница и выбор общие. Переключатель
              доступен и при массовых действиях.
            </p>
          </article>
          <article>
            <span>08</span>
            <h3>Поля под вашим контролем</h3>
            <p>
              Видимость и порядок общие для обоих видов. Имя и действия закреплены в шапке плитки.
              Пояснения берутся из описаний колонок, а числовые показатели используют второе
              семейство шрифта.
            </p>
          </article>
          <article>
            <span>09</span>
            <h3>Один навигатор в двух местах</h3>
            <p>
              Текущая страница и общее число страниц видны сразу в одну строку. Диапазон и общее
              количество записей находятся слева в подвале. Стрелки листают, счётчик открывает
              переход по номеру и выбор количества ресурсов. Блок одинаков в шапке и внизу. В меню
              представления выберите одно или оба расположения. При последовательной загрузке вместо
              страниц доступны прогресс и следующая порция.
            </p>
          </article>
          <article>
            <span>10</span>
            <h3>Управление шириной</h3>
            <p>
              Перетаскивайте правую границу заголовка. Чекбоксы и меню действий имеют фиксированную
              ширину. Двойное нажатие возвращает ширину колонки, а меню представления — всех
              колонок. С клавиатуры: ← / →, Shift увеличивает шаг, Home сбрасывает ширину, Escape
              отменяет жест.
            </p>
          </article>
          <article>
            <span>11</span>
            <h3>Настройки собраны вместе</h3>
            <p>
              Меню представления объединяет вид, загрузку, поля, группировку и расположение
              навигации. Размер страницы сохраняет положение в списке. Смена режима или размера
              порции при прокрутке начинает с первой порции, сохраняя фильтры и выбранные ресурсы.
            </p>
          </article>
          <article>
            <span>12</span>
            <h3>Выбор имеет границы</h3>
            <p>
              «Выбрать все» действует на текущую страницу или загруженные ресурсы. Новые порции не
              выбираются автоматически. Ошибка подгрузки оставляет список доступным и предлагает
              повторить запрос.
            </p>
          </article>
          <article>
            <span>13</span>
            <h3>Свои наборы фильтров</h3>
            <p>
              Сохраните условия под названием и применяйте их через стрелку у кнопки «Фильтры».
              Здесь же компактный флажок «Запомнить выбор» назначает фильтр по умолчанию. Поиск,
              сортировка, вид и выбор ресурсов сохраняются. В «Моих наборах» доступны поиск,
              переименование, копирование, обновление и удаление с отменой. Наборы хранятся в этом
              браузере.
            </p>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Параметры таблицы" note="Единая визуальная система" />
        <ComponentTokens component="table" />
      </section>
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Общие панели инструментов"
          note="Фильтры · сортировка · группировка · столбцы"
        />
        <p className="foundation-note">
          Фильтры, сортировка, группировка, столбцы и быстрый просмотр открываются в скруглённом
          окне справа с отступом 16 px от краёв экрана. Единая ширина 480 px, мягкое затемнение
          фона, неподвижные заголовок и действия. Прокручивается содержимое. Изменение токенов
          обновляет все эти окна и демонстрационное приложение.
        </p>
        <ComponentTokens component="context-panel" />
        <ComponentTokens component="table-tools" />
      </section>
      {panel && (
        <TableToolsPanel
          filterPresets={savedFilters}
          presetAction={presetAction}
          describeFilter={describeSavedFilter}
          view={view}
          mode={panel}
          field={panel === 'filters' ? filterField : null}
          anchor={panelAnchor}
          caption="Виртуальные машины"
          fields={toolFields}
          columns={toolColumns}
          value={{ filters, sorts, order: columnOrder, hidden, grouping }}
          countGroups={(rule) => {
            const config = groupConfig(rule);
            return groupTableRows(filtered, config.getValue, config.direction).length;
          }}
          defaultOrder={columnIds}
          validateFilter={filterError}
          countResults={(rules) =>
            rows.filter(
              (row) =>
                (row.name + ' ' + row.ip + ' ' + row.project)
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()) && filterMatches(row, rules),
            ).length
          }
          onApply={(next) => {
            if (panel === 'filters') {
              setFilters(next.filters);
            } else if (panel === 'sort') setSorts(next.sorts);
            else if (panel === 'group') setGrouping(next.grouping ?? null);
            else {
              setColumnOrder(next.order);
              setHidden(next.hidden);
            }
          }}
          onClose={() => {
            savedFilters.dismiss();
            setPanel(null);
          }}
        />
      )}
      <ContextPanel
        open={Boolean(preview)}
        anchor={previewAnchor}
        presentation="drawer"
        title={preview?.name || 'Виртуальная машина'}
        description="Быстрый просмотр"
        icon={<Server />}
        onClose={() => setPreviewId(null)}
        footer={
          <>
            <Button onClick={() => setPreviewId(null)}>Закрыть</Button>
            <Button
              variant={preview?.status === 'running' ? 'secondary' : 'primary'}
              tone={preview?.status === 'running' ? 'neutral' : 'brand'}
              leadingIcon={<Power />}
              loading={pending !== null}
              onClick={() =>
                preview && perform([preview.id], preview.status === 'running' ? 'off' : 'running')
              }
            >
              {preview?.status === 'running' ? 'Выключить ВМ' : 'Запустить ВМ'}
            </Button>
          </>
        }
      >
        {preview && <ResourceDetails resource={preview} />}
      </ContextPanel>
    </>
  );
}

function ResourceDetails({ resource: preview }: { resource: VM }) {
  return (
    <div className="preview-content">
      <StatusBadge
        tone={
          preview.status === 'running'
            ? 'success'
            : preview.status === 'error'
              ? 'danger'
              : 'neutral'
        }
      >
        {statuses[preview.status]}
      </StatusBadge>
      {preview.status === 'error' && (
        <Message tone="danger" title="Не удалось запустить">
          Недостаточно ресурсов на выбранном узле.
        </Message>
      )}
      {preview.cpu >= 80 && (
        <Message tone="warning" title="Высокая загрузка CPU">
          Проверьте текущие задачи.
        </Message>
      )}
      <dl>
        <div>
          <dt>Проект</dt>
          <dd>{preview.project}</dd>
        </div>
        <div>
          <dt>IP-адрес</dt>
          <dd>
            <code>{preview.ip}</code>
          </dd>
        </div>
        <div>
          <dt>Оперативная память</dt>
          <dd>{preview.ram} GiB</dd>
        </div>
        <div>
          <dt>Загрузка CPU</dt>
          <dd>{preview.status === 'running' ? `${preview.cpu}%` : 'Нет данных'}</dd>
        </div>
        <div>
          <dt>Идентификатор</dt>
          <dd>
            <code>{preview.id}</code>
          </dd>
        </div>
      </dl>
    </div>
  );
}

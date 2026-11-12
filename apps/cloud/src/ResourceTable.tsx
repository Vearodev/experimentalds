import { useContext, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  Button,
  Chip,
  DataTable,
  IconButton,
  Input,
  Tooltip,
  TableToolsPanel,
  TableToolbarActions,
  Tabs,
  TableEmptyState,
  groupTableRows,
  type SortState,
  type TableToolsMode,
  type TableGroupRule,
} from '@basis/ui';
import {
  defaultView,
  queryRows,
  restoreView,
  registryGrouping,
  ruleError,
  ruleLabel,
  type RegistryColumn,
  type RegistryView,
  type Rule,
} from './registry-model';
import { CloudContext } from './cloud-state';
import { useRegistryData, type RegistryLoader } from './useRegistryData';

export type RegistryPreset = {
  label: string;
  filters: Rule[];
};
export type ResourceTableProps<T extends { id: string; name?: string }> = {
  rows: T[];
  columns: RegistryColumn<T>[];
  caption: string;
  tableId: string;
  placeholder?: string;
  empty?: ReactNode;
  presets?: RegistryPreset[];
  initialSort?: SortState[];
  rowTone?: (row: T) => 'error' | 'warning' | undefined;
  onRowActivate?: (row: T, origin: HTMLTableRowElement) => void;
  previewRowId?: string;
  bulkActions?: (rows: T[]) => ReactNode;
  toolbar?: ReactNode;
  load?: RegistryLoader;
};

export function ResourceTable<T extends { id: string; name?: string }>(
  props: ResourceTableProps<T>,
) {
  return <Registry key={props.tableId} {...props} />;
}
function Registry<T extends { id: string; name?: string }>({
  rows: sourceRows,
  columns,
  caption,
  tableId,
  placeholder = 'Поиск по ресурсам…',
  empty,
  presets,
  initialSort = [],
  rowTone,
  onRowActivate,
  previewRowId,
  bulkActions,
  toolbar,
  load,
}: ResourceTableProps<T>) {
  const cloud = useContext(CloudContext);
  const requestState = useRegistryData(load ?? cloud?.loadRegistry, cloud?.data?.simulation.table);
  const rows = requestState.empty ? [] : sourceRows;
  const key = `basis.registry.v2:${tableId}`,
    defaults = defaultView(columns, initialSort);
  const [view, setView] = useState<RegistryView>(() => {
    try {
      return restoreView(sessionStorage.getItem(key), columns, defaults);
    } catch {
      return defaults;
    }
  });
  const [selection, setSelection] = useState(new Set<string>());
  useEffect(() => {
    if (requestState.state !== 'ready') return;
    const ids = new Set(rows.map((row) => row.id));
    setSelection((previous) =>
      [...previous].every((id) => ids.has(id))
        ? previous
        : new Set([...previous].filter((id) => ids.has(id))),
    );
  }, [rows, requestState.state]);
  const [panel, setPanel] = useState<{
    kind: TableToolsMode;
    anchor: HTMLElement;
    field?: string;
  } | null>(null);
  const fields = columns.filter((c) => c.value);
  const selectedRows = rows.filter((r) => selection.has(r.id)),
    selected = new Set(selectedRows.map((r) => r.id));
  const result = queryRows(rows, columns, view.query, view.filters, view.sorts),
    pages = Math.max(1, Math.ceil(result.length / 12)),
    page = Math.min(view.page, pages);
  const grouping = registryGrouping(columns, view.grouping);
  const groupsFor = (rule: TableGroupRule) => {
    const config = registryGrouping(columns, rule);
    return config ? groupTableRows(result, config.getValue, config.direction) : [];
  };
  const groups = view.grouping ? groupsFor(view.grouping) : [];
  const ordered = grouping ? groups.flatMap((group) => group.rows) : result;
  const visible = ordered.slice((page - 1) * 12, page * 12),
    offscreen = selectedRows.filter((r) => !visible.some((v) => v.id === r.id)).length;
  const change = (patch: Partial<RegistryView>) => setView((v) => ({ ...v, page: 1, ...patch }));
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(view));
    } catch {
      /* In-memory view remains usable. */
    }
  }, [key, view]);
  const openPanel = (kind: TableToolsMode, anchor: HTMLElement, field?: RegistryColumn<T>) => {
    setPanel({ kind, anchor, field: field?.id });
  };
  const displayed = [
    ...columns.filter((c) => c.pinned === 'start'),
    ...view.columns
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is RegistryColumn<T> => !!c && !c.pinned),
    ...columns.filter((c) => c.pinned === 'end'),
  ].map((c) => ({
    ...c,
    sortable: !!c.value,
    filter: c.value
      ? {
          active: view.filters.some((r) => r.field === c.id),
          onClick: (e: React.MouseEvent<HTMLButtonElement>) =>
            openPanel('filters', e.currentTarget, c),
        }
      : undefined,
  }));
  const views = [{ label: 'Все', filters: [] as Rule[] }, ...(presets || [])];
  const activePreset = views.findIndex(
    (preset) => JSON.stringify(view.filters) === JSON.stringify(preset.filters),
  );
  const liveStatus = (
    <span className="cloud-registry-live" data-state={requestState.state}>
      <i className="cloud-live-dot" />
      {requestState.state === 'loading'
        ? 'Загружаем ресурсы'
        : requestState.state === 'refreshing'
          ? 'Обновляем данные'
          : requestState.state === 'stale'
            ? 'Данные требуют обновления'
            : requestState.state === 'error'
              ? 'Данные недоступны'
              : 'Данные актуальны'}
    </span>
  );
  const table = (
    <DataTable
      state={requestState.state}
      error={requestState.error}
      onRefresh={requestState.refresh}
      loadingRows={12}
      rows={visible}
      columns={displayed}
      caption={caption}
      getRowId={(r) => r.id}
      getRowLabel={(r) => r.name || r.id}
      selected={selected}
      onSelectionChange={setSelection}
      selectionMode={bulkActions ? 'multiple' : 'none'}
      rowTone={rowTone}
      onRowActivate={onRowActivate}
      previewRowId={previewRowId}
      sorts={view.sorts}
      grouping={
        grouping
          ? {
              ...grouping,
              totalGroups: groups.length,
              totalCounts: new Map(groups.map((group) => [group.key, group.rows.length])),
              onClear: () => change({ grouping: null }),
            }
          : undefined
      }
      onSortChange={(sort, additive) =>
        change({
          sorts: additive ? [...view.sorts.filter((s) => s.column !== sort.column), sort] : [sort],
        })
      }
      toolbar={
        <div className="cloud-registry-tools">
          <Input
            leadingIcon={<Search />}
            aria-label={`Поиск: ${caption}`}
            placeholder={placeholder}
            value={view.query}
            onChange={(e) => change({ query: e.target.value })}
            onClear={view.query ? () => change({ query: '' }) : undefined}
          />
          <div className="cloud-registry-controls">
            {toolbar}
            <TableToolbarActions
              filterCount={view.filters.length}
              sortCount={view.sorts.length}
              groupLabel={grouping?.label}
              onOpen={(mode, anchor) => openPanel(mode, anchor)}
            />
          </div>
        </div>
      }
      bulkToolbar={
        <div className="cloud-registry-bulk">
          <span className="cloud-selected-count">{selectedRows.length}</span>
          <strong>Выбрано</strong>
          {offscreen > 0 && <span className="cloud-selection-note">{offscreen} вне страницы</span>}
          <span className="cloud-bulk-divider" />
          {bulkActions?.(selectedRows)}
          <Tooltip content="Снять выбор">
            <IconButton
              aria-label="Снять выбор строк"
              variant="ghost"
              icon={<X />}
              onClick={() => setSelection(new Set())}
            />
          </Tooltip>
        </div>
      }
      afterToolbar={
        view.filters.length > 0 ? (
          <div className="cloud-registry-chips">
            <SlidersHorizontal size={14} />
            {view.filters.map((rule, index) => (
              <Chip
                key={`${rule.field}-${index}`}
                onRemove={() => change({ filters: view.filters.filter((_, i) => i !== index) })}
              >
                {ruleLabel(
                  rule,
                  columns.find((c) => c.id === rule.field)!,
                )}
              </Chip>
            ))}
            <Button variant="ghost" size="sm" onClick={() => change({ filters: [] })}>
              Сбросить
            </Button>
          </div>
        ) : undefined
      }
      empty={
        view.query || view.filters.length ? (
          <TableEmptyState
            kind="filtered"
            action={
              <Button onClick={() => change({ query: '', filters: [] })}>
                Сбросить поиск и фильтры
              </Button>
            }
          />
        ) : (
          empty || <TableEmptyState />
        )
      }
      footer={
        <div className="cloud-registry-footer">
          <span>
            <strong>
              {result.length ? `${(page - 1) * 12 + 1}–${Math.min(page * 12, result.length)}` : '0'}
            </strong>{' '}
            из {result.length}
            {result.length !== rows.length && (
              <span className="cloud-muted"> · всего {rows.length}</span>
            )}
          </span>
          {!presets?.length && liveStatus}
          <span className="cloud-registry-sort-note">
            {view.sorts
              .map(
                (s) =>
                  `${columns.find((c) => c.id === s.column)?.header} ${s.direction === 'asc' ? '↑' : '↓'}`,
              )
              .join(' · ')}
          </span>
          <div className="basis-table-pagination">
            <IconButton
              size="lg"
              variant="secondary"
              aria-label="Предыдущая страница"
              icon={<ChevronLeft />}
              disabled={page === 1}
              onClick={() => change({ page: page - 1 })}
            />
            <span>
              {page} / {pages}
            </span>
            <IconButton
              size="lg"
              variant="secondary"
              aria-label="Следующая страница"
              icon={<ChevronRight />}
              disabled={page === pages}
              onClick={() => change({ page: page + 1 })}
            />
          </div>
        </div>
      }
    />
  );
  return (
    <section className="cloud-registry" aria-label={caption}>
      {presets?.length ? (
        <Tabs
          label={`Представления: ${caption}`}
          value={activePreset < 0 ? 'custom' : `preset-${activePreset}`}
          items={[
            ...views.map((preset, index) => ({
              id: `preset-${index}`,
              label: preset.label,
              count: queryRows(rows, columns, view.query, preset.filters).length,
            })),
            ...(activePreset < 0
              ? [{ id: 'custom', label: 'По условиям', count: result.length }]
              : []),
          ]}
          onValueChange={(id) => {
            const index = views.findIndex((_, i) => `preset-${i}` === id);
            if (index >= 0) change({ filters: views[index].filters });
          }}
          accessory={liveStatus}
        >
          {table}
        </Tabs>
      ) : (
        table
      )}
      {panel && (
        <TableToolsPanel
          mode={panel.kind}
          field={panel.field}
          anchor={panel.anchor}
          caption={caption}
          fields={fields.map((c) => ({
            id: c.id,
            label: c.header,
            description: c.description,
            groupable: c.groupable,
            kind: c.kind || 'text',
            unit: c.unit,
            min: c.min,
            max: c.max,
            options: (rules) =>
              (c.options || []).map((option) => ({
                ...option,
                description:
                  'Найдено: ' +
                  queryRows(
                    rows,
                    columns,
                    view.query,
                    rules.filter(
                      (r) =>
                        r.field !== c.id &&
                        !ruleError(
                          r,
                          columns.find((f) => f.id === r.field),
                        ),
                    ),
                  ).filter((r) => String(c.value!(r)) === option.value).length,
              })),
          }))}
          columns={columns.map((c) => ({
            id: c.id,
            label: c.header,
            description: c.description,
            locked: Boolean(c.pinned || c.required),
          }))}
          value={{
            filters: view.filters,
            sorts: view.sorts,
            order: view.columnOrder,
            hidden: new Set(columns.filter((c) => !view.columns.includes(c.id)).map((c) => c.id)),
            grouping: view.grouping,
          }}
          defaultOrder={defaults.columnOrder}
          defaultHidden={
            new Set(columns.filter((c) => c.hidden && !c.pinned && !c.required).map((c) => c.id))
          }
          validateFilter={(rule) =>
            ruleError(
              rule,
              columns.find((c) => c.id === rule.field),
            )
          }
          countResults={(rules) => queryRows(rows, columns, view.query, rules).length}
          countGroups={(rule) => groupsFor(rule).length}
          onApply={(next) => {
            if (panel.kind === 'filters') change({ filters: next.filters });
            else if (panel.kind === 'sort') change({ sorts: next.sorts });
            else if (panel.kind === 'group') change({ grouping: next.grouping ?? null });
            else
              change({
                columnOrder: next.order,
                columns: next.order.filter((id) => !next.hidden.has(id)),
              });
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </section>
  );
}

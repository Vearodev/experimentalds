import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Group,
  Info,
  ListFilter,
  X,
  CloudOff,
  Database,
  RefreshCw,
  SearchX,
} from 'lucide-react';
import { Button, IconButton } from './Button';
import { Tooltip } from './Tooltip';
import { Badge } from './Identity';
import { groupTableRows, type TableGrouping } from './table-grouping';
import { Skeleton } from './Feedback';
import { Message } from './Notifications';

export type DataTableState = 'ready' | 'loading' | 'refreshing' | 'error' | 'stale';

export function TableEmptyState({
  kind = 'empty',
  title,
  description,
  action,
}: {
  kind?: 'empty' | 'filtered' | 'error';
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = kind === 'error' ? CloudOff : kind === 'filtered' ? SearchX : Database;
  return (
    <div className="basis-table-empty" data-kind={kind}>
      <span className="basis-table-empty__symbol" aria-hidden="true">
        <Icon />
      </span>
      <h3>
        {title ||
          (kind === 'error'
            ? 'Не удалось загрузить данные'
            : kind === 'filtered'
              ? 'Нет совпадений'
              : 'Ресурсов пока нет')}
      </h3>
      <p>
        {description ||
          (kind === 'error'
            ? 'Повторите запрос. Настройки таблицы сохранены.'
            : kind === 'filtered'
              ? 'Измените запрос или уберите часть условий.'
              : 'Новые ресурсы появятся в этой таблице.')}
      </p>
      {action && <div className="basis-table-empty__action">{action}</div>}
    </div>
  );
}

export type SortState = { column: string; direction: 'asc' | 'desc' };
export type DataColumn<T> = {
  id: string;
  header: string;
  width: number;
  /** Compact, fixed-width utility cell; its heading stays available to screen readers. */
  utility?: 'actions';
  description?: string;
  sortable?: boolean;
  align?: 'left' | 'right';
  /** One leading data column and one trailing action column may be pinned. */
  pinned?: 'start' | 'end';
  render: (row: T) => ReactNode;
  filter?: { active?: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void };
};
export type DataTableProps<T> = {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  selected: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  selectionMode?: 'single' | 'multiple' | 'none';
  isRowSelectable?: (row: T) => boolean;
  replaceToolbarOnSelection?: boolean;
  selectOnRowClick?: boolean;
  /** Free row space opens its details; embedded controls keep their own actions. */
  onRowActivate?: (row: T, origin: HTMLTableRowElement) => void;
  previewRowId?: string;
  sort?: SortState;
  sorts?: SortState[];
  grouping?: TableGrouping<T>;
  state?: DataTableState;
  error?: string;
  onRefresh?: () => void;
  loadingRows?: number;
  onSortChange?: (sort: SortState, additive?: boolean) => void;
  rowTone?: (row: T) => 'error' | 'warning' | undefined;
  toolbar: ReactNode;
  bulkToolbar: ReactNode;
  afterToolbar?: ReactNode;
  caption: string;
  empty?: ReactNode;
  footer?: ReactNode;
};

/** Composition layer: every action and header control uses the shared Button. */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  selected,
  onSelectionChange,
  selectionMode = 'multiple',
  isRowSelectable = () => true,
  replaceToolbarOnSelection = true,
  selectOnRowClick = false,
  onRowActivate,
  previewRowId,
  sort,
  sorts,
  grouping,
  state = 'ready',
  error,
  onRefresh,
  loadingRows = 8,
  onSortChange,
  rowTone,
  toolbar,
  bulkToolbar,
  afterToolbar,
  caption,
  empty,
  footer,
}: DataTableProps<T>) {
  const busy = state === 'loading' || state === 'refreshing';
  const blocking = state === 'loading' || state === 'error';
  const refreshButton = useRef<HTMLButtonElement>(null);
  const tableRoot = useRef<HTMLDivElement>(null),
    requestNotice = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () =>
      tableRoot.current?.style.setProperty(
        '--table-request-notice-height',
        `${requestNotice.current?.getBoundingClientRect().height || 0}px`,
      );
    measure();
    if (!requestNotice.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(requestNotice.current);
    return () => observer.disconnect();
  }, [state]);
  const retry = () => {
    refreshButton.current?.focus({ preventScroll: true });
    onRefresh?.();
  };
  const orders = sorts || (sort ? [sort] : []);
  const columnWidths = columns.map((column) =>
    column.utility === 'actions'
      ? 'var(--basis-comp-table-column-actions-width)'
      : column.description && (column.sortable || column.filter)
        ? `max(${column.width}px, var(--basis-comp-table-header-min-width))`
        : `${column.width}px`,
  );
  const selectionGroup = useId(),
    rowActionHint = useId();
  const canActivateRow = Boolean(onRowActivate && !selectOnRowClick);
  const [folded, setFolded] = useState<{ field?: string; keys: Set<string> }>({ keys: new Set() });
  const groups = grouping ? groupTableRows(rows, grouping.getValue, grouping.direction) : [];
  useEffect(() => setFolded({ field: grouping?.id, keys: new Set() }), [grouping?.id]);
  const collapsed = folded.field === grouping?.id ? folded.keys : new Set<string>();
  const allCollapsed = groups.length > 0 && groups.every((group) => collapsed.has(group.key));
  const hiddenSelected = groups
    .filter((group) => collapsed.has(group.key))
    .reduce(
      (count, group) => count + group.rows.filter((row) => selected.has(getRowId(row))).length,
      0,
    );
  const toggleGroup = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFolded({ field: grouping?.id, keys: next });
  };
  const selectAll = useRef<HTMLInputElement>(null);
  const bulk = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (selected.size === 0 && bulk.current?.contains(document.activeElement))
      selectAll.current?.focus({ preventScroll: true });
  }, [selected.size]);
  const selectable = rows.filter(isRowSelectable);
  const visibleSelected = selectable.filter((row) => selected.has(getRowId(row))).length;
  const all = selectable.length > 0 && visibleSelected === selectable.length,
    some = visibleSelected > 0 && !all;
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = some;
  }, [some]);
  const toggleAll = () => {
    const next = new Set(selected);
    selectable.forEach((row) => (all ? next.delete(getRowId(row)) : next.add(getRowId(row))));
    onSelectionChange(next);
  };
  const toggleRow = (row: T) => {
    if (!isRowSelectable(row)) return;
    const id = getRowId(row);
    if (selectionMode === 'single') {
      onSelectionChange(new Set([id]));
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };
  const renderRow = (row: T) => {
    const id = getRowId(row),
      tone = rowTone?.(row);
    return (
      <tr
        key={id}
        data-row-id={id}
        data-tone={tone}
        data-selected={selected.has(id)}
        data-preview={id === previewRowId}
        data-selectable={selectOnRowClick && isRowSelectable(row)}
        data-activatable={canActivateRow}
        tabIndex={canActivateRow ? 0 : undefined}
        aria-describedby={canActivateRow ? rowActionHint : undefined}
        onClick={
          selectOnRowClick || canActivateRow
            ? (event) => {
                const target = event.target as Element;
                const control = target.closest(
                  'button,a,input,select,textarea,label,summary,[tabindex],[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="combobox"],[contenteditable]:not([contenteditable="false"]),[data-row-action-ignore]',
                );
                if (
                  event.defaultPrevented ||
                  !event.currentTarget.contains(target) ||
                  (control &&
                    control !== event.currentTarget &&
                    event.currentTarget.contains(control)) ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  window.getSelection()?.isCollapsed === false
                )
                  return;
                if (selectOnRowClick) toggleRow(row);
                else if (!target.closest('.basis-data-table__select')) {
                  event.currentTarget.focus({ preventScroll: true });
                  onRowActivate?.(row, event.currentTarget);
                }
              }
            : undefined
        }
        onKeyDown={
          canActivateRow
            ? (event) => {
                if (
                  event.target !== event.currentTarget ||
                  event.defaultPrevented ||
                  event.repeat ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  !['Enter', ' '].includes(event.key)
                )
                  return;
                event.preventDefault();
                onRowActivate?.(row, event.currentTarget);
              }
            : undefined
        }
      >
        {selectionMode !== 'none' && (
          <td className="basis-data-table__select">
            <input
              type={selectionMode === 'single' ? 'radio' : 'checkbox'}
              name={selectionMode === 'single' ? selectionGroup : undefined}
              disabled={!isRowSelectable(row)}
              aria-label={`Выбрать ${getRowLabel(row)}`}
              checked={selected.has(id)}
              onChange={() => toggleRow(row)}
            />
          </td>
        )}
        {columns.map((column) => (
          <td
            key={column.id}
            data-align={column.align}
            data-pinned={column.pinned}
            data-utility={column.utility}
          >
            {column.render(row)}
          </td>
        ))}
      </tr>
    );
  };
  return (
    <div
      ref={tableRoot}
      className="basis-data-table"
      data-selection={selectionMode}
      data-state={state}
    >
      {canActivateRow && (
        <span id={rowActionHint} className="basis-visually-hidden">
          Enter или пробел — быстрый просмотр. Ссылки открывают страницы, чекбоксы выбирают строки.
        </span>
      )}
      <span className="basis-visually-hidden" role="status" aria-live="polite">
        {state === 'loading'
          ? 'Загружаем данные таблицы'
          : state === 'refreshing'
            ? 'Обновляем данные. Показаны ранее загруженные строки.'
            : state === 'error' || state === 'stale'
              ? 'Не удалось получить данные таблицы'
              : ''}
      </span>
      <div
        className="basis-data-table__toolbar"
        data-refresh={Boolean(onRefresh)}
        data-selected={replaceToolbarOnSelection && selected.size > 0 && !blocking}
      >
        <div
          className="basis-data-table__normal"
          inert={replaceToolbarOnSelection && selected.size > 0 && !blocking}
        >
          {toolbar}
        </div>
        <div
          ref={bulk}
          className="basis-data-table__bulk"
          inert={!replaceToolbarOnSelection || selected.size === 0 || blocking}
        >
          {bulkToolbar}
        </div>
        {onRefresh && (
          <div className="basis-data-table__refresh">
            <Tooltip
              content={
                busy ? 'Получаем свежие данные' : 'Обновить данные · настройки и выбор сохранятся'
              }
            >
              <IconButton
                ref={refreshButton}
                size="sm"
                variant="ghost"
                icon={<RefreshCw />}
                aria-label="Обновить данные таблицы"
                loading={busy}
                onClick={onRefresh}
              />
            </Tooltip>
          </div>
        )}
      </div>
      {afterToolbar}
      {state === 'stale' && (
        <div ref={requestNotice} className="basis-data-table__request-notice">
          <Message
            tone="warning"
            compact
            title="Не удалось обновить данные"
            action={onRefresh ? { label: 'Повторить', onClick: retry } : undefined}
          >
            {error || 'Сервис временно недоступен.'} Показаны ранее загруженные данные.
          </Message>
        </div>
      )}
      {grouping && (
        <div className="basis-data-table__group-bar">
          <Group aria-hidden="true" />
          <span>
            Группировка: <strong>{grouping.label}</strong>
          </span>
          <span className="basis-data-table__group-total">
            Групп: {blocking ? '—' : (grouping.totalGroups ?? groups.length)}
          </span>
          {!blocking && hiddenSelected > 0 && <span>Выбрано в свёрнутых: {hiddenSelected}</span>}
          <div>
            <Button
              size="sm"
              variant="ghost"
              disabled={!groups.length || blocking}
              aria-label={`${allCollapsed ? 'Развернуть' : 'Свернуть'} все группы на странице`}
              onClick={() =>
                setFolded({
                  field: grouping.id,
                  keys: allCollapsed
                    ? new Set(
                        [...collapsed].filter((key) => !groups.some((group) => group.key === key)),
                      )
                    : new Set([...collapsed, ...groups.map((group) => group.key)]),
                })
              }
            >
              {allCollapsed ? 'Развернуть все' : 'Свернуть все'}
            </Button>
            {grouping.onClear && (
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X />}
                aria-label="Убрать группировку"
                onClick={grouping.onClear}
              />
            )}
          </div>
        </div>
      )}
      <div
        className="basis-data-table__scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
        aria-busy={busy}
      >
        <table
          style={{
            minWidth: `calc(${selectionMode === 'none' ? '0px' : 'var(--basis-sys-table-selection-width)'} + ${columnWidths.length ? columnWidths.join(' + ') : '0px'})`,
          }}
        >
          <caption className="basis-visually-hidden">{caption}</caption>
          <colgroup>
            {selectionMode !== 'none' && (
              <col style={{ width: 'var(--basis-sys-table-selection-width)' }} />
            )}
            {columns.map((column, index) => (
              <col
                key={column.id}
                style={{
                  width:
                    index === columns.findIndex((item) => !item.utility)
                      ? undefined
                      : columnWidths[index],
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {selectionMode !== 'none' && (
                <th className="basis-data-table__select">
                  {selectionMode === 'multiple' ? (
                    <input
                      ref={selectAll}
                      type="checkbox"
                      aria-label={
                        grouping ? 'Выбрать все строки на странице' : 'Выбрать все видимые строки'
                      }
                      checked={all}
                      disabled={selectable.length === 0 || blocking}
                      onChange={toggleAll}
                    />
                  ) : (
                    <span className="basis-visually-hidden">Выбор</span>
                  )}
                </th>
              )}
              {columns.map((column) => {
                const priority = orders.findIndex((rule) => rule.column === column.id);
                const currentSort = orders[priority];
                const heading = column.sortable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="basis-data-table__sort"
                    data-sorted={Boolean(currentSort)}
                    aria-label={`Сортировать: ${column.header}${priority >= 0 && orders.length > 1 ? ` · приоритет ${priority + 1}` : ''}`}
                    trailingIcon={
                      currentSort ? (
                        currentSort.direction === 'asc' ? (
                          <ArrowUp />
                        ) : (
                          <ArrowDown />
                        )
                      ) : (
                        <ArrowUpDown />
                      )
                    }
                    onClick={(event) =>
                      onSortChange?.(
                        {
                          column: column.id,
                          direction: currentSort?.direction === 'asc' ? 'desc' : 'asc',
                        },
                        event.shiftKey,
                      )
                    }
                  >
                    <span className="basis-data-table__header-label">{column.header}</span>
                    {priority >= 0 && orders.length > 1 && (
                      <sup className="basis-data-table__priority">{priority + 1}</sup>
                    )}
                  </Button>
                ) : (
                  <span className="basis-data-table__title">{column.header}</span>
                );
                return (
                  <th
                    key={column.id}
                    scope="col"
                    data-align={column.align}
                    data-pinned={column.pinned}
                    data-utility={column.utility}
                    aria-sort={
                      column.sortable
                        ? priority === 0
                          ? currentSort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                  >
                    {column.utility === 'actions' ? (
                      <span className="basis-visually-hidden">{column.header}</span>
                    ) : (
                      <div className="basis-data-table__heading">
                        {heading}
                        {column.description && (
                          <Tooltip content={column.description}>
                            <IconButton
                              size="sm"
                              variant="ghost"
                              aria-label={`О поле «${column.header}»`}
                              icon={<Info />}
                            />
                          </Tooltip>
                        )}
                        {column.filter && (
                          <Tooltip content={`Фильтр: ${column.header}`}>
                            <IconButton
                              size="sm"
                              variant="ghost"
                              aria-label={`Фильтр: ${column.header}`}
                              aria-pressed={column.filter.active || false}
                              icon={<ListFilter />}
                              onClick={column.filter.onClick}
                            />
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {state === 'loading' ? (
            <tbody aria-hidden="true" className="basis-data-table__skeleton">
              {Array.from({ length: Math.max(1, Math.min(20, loadingRows)) }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  {selectionMode !== 'none' && (
                    <td className="basis-data-table__select">
                      <Skeleton
                        shape="block"
                        width="var(--basis-comp-checkbox-size)"
                        height="var(--basis-comp-checkbox-size)"
                        className="basis-data-table__skeleton-check"
                      />
                    </td>
                  )}
                  {columns.map((column, index) => (
                    <td key={column.id} data-pinned={column.pinned} data-utility={column.utility}>
                      <Skeleton width={['72%', '48%', '62%'][(rowIndex + index) % 3]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : state === 'error' ? null : grouping ? (
            groups.map((group) => {
              const closed = collapsed.has(group.key);
              const total = grouping.totalCounts?.get(group.key) ?? group.rows.length;
              const groupSelectable = group.rows.filter(isRowSelectable);
              const checkedCount = groupSelectable.filter((row) =>
                selected.has(getRowId(row)),
              ).length;
              const checked = groupSelectable.length > 0 && checkedCount === groupSelectable.length;
              return (
                <tbody key={`${grouping.id}:${group.key}`} data-group-key={group.key}>
                  <tr className="basis-data-table__group-row">
                    <th
                      scope="rowgroup"
                      colSpan={columns.length + (selectionMode === 'none' ? 0 : 1)}
                    >
                      <div className="basis-data-table__group-heading">
                        {selectionMode === 'multiple' && (
                          <span className="basis-data-table__group-select">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!groupSelectable.length}
                              ref={(element) => {
                                if (element) element.indeterminate = checkedCount > 0 && !checked;
                              }}
                              aria-label={`Выбрать группу «${group.label}» на странице`}
                              onChange={() => {
                                const next = new Set(selected);
                                groupSelectable.forEach((row) =>
                                  checked ? next.delete(getRowId(row)) : next.add(getRowId(row)),
                                );
                                onSelectionChange(next);
                              }}
                            />
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={closed ? <ChevronRight /> : <ChevronDown />}
                          aria-label={`${closed ? 'Развернуть' : 'Свернуть'} группу «${group.label}»`}
                          aria-expanded={!closed}
                          onClick={() => toggleGroup(group.key)}
                        >
                          {group.label}
                        </Button>
                        <Badge
                          count={total}
                          max={Number.MAX_SAFE_INTEGER}
                          tone="neutral"
                          label={`Ресурсов в группе: ${total}`}
                        />
                        {group.rows.length < total && (
                          <span className="basis-data-table__group-partial">
                            На странице: {group.rows.length} из {total}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                  {!closed && group.rows.map(renderRow)}
                </tbody>
              );
            })
          ) : (
            <tbody>{rows.map(renderRow)}</tbody>
          )}
        </table>
        {state === 'error' ? (
          <div className="basis-data-table__empty">
            <TableEmptyState
              kind="error"
              description={error}
              action={
                onRefresh && (
                  <Button onClick={retry} leadingIcon={<RefreshCw />}>
                    Повторить загрузку
                  </Button>
                )
              }
            />
          </div>
        ) : !busy && rows.length === 0 ? (
          <div className="basis-data-table__empty">{empty || <TableEmptyState />}</div>
        ) : state === 'refreshing' && rows.length === 0 ? (
          <div className="basis-data-table__empty">{empty || <TableEmptyState />}</div>
        ) : null}
      </div>
      {footer && (
        <div className="basis-data-table__footer" data-blocked={blocking}>
          <div className="basis-data-table__footer-content" inert={blocking} aria-hidden={blocking}>
            {footer}
          </div>
          {blocking && (
            <span className="basis-data-table__footer-status">
              {state === 'loading' ? 'Загружаем ресурсы…' : 'Данные недоступны'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

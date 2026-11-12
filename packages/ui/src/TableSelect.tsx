import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Table2, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { Field, Input } from './Fields';
import { CloudLoader } from './CloudLoader';
import { DataTable, type DataColumn, type SortState } from './DataTable';

export type TableSelectProps<T> = {
  label: string;
  required?: boolean;
  title?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  rows: T[];
  columns: DataColumn<T>[];
  value: string[];
  onValueChange: (value: string[]) => void;
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  searchText: (row: T) => string;
  getSortValue?: (row: T, column: string) => string | number;
  isRowSelectable?: (row: T) => boolean;
  multiple?: boolean;
  emptyMessage?: string;
};
/** A resource picker: the same field, table and actions, with draft/commit selection. */
export function TableSelect<T>({
  label,
  required,
  title = 'Выбор ресурсов',
  hint,
  error,
  placeholder = 'Выберите ресурсы',
  disabled,
  loading,
  rows,
  columns,
  value,
  onValueChange,
  getRowId,
  getRowLabel,
  searchText,
  getSortValue,
  isRowSelectable = () => true,
  multiple = true,
  emptyMessage = 'Доступных ресурсов пока нет',
}: TableSelectProps<T>) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Set(value)),
    [query, setQuery] = useState(''),
    [onlySelected, setOnlySelected] = useState(false),
    [sort, setSort] = useState<SortState>({
      column: columns.find((column) => column.sortable)?.id || columns[0]?.id || '',
      direction: 'asc',
    });
  const chosen = rows.filter((row) => value.includes(getRowId(row))),
    hiddenSelections = [...draft].filter(
      (key) => !rows.some((row) => getRowId(row) === key),
    ).length;
  const show = () => {
    setDraft(new Set(value));
    setQuery('');
    setOnlySelected(false);
    setOpen(true);
  };
  const close = () => setOpen(false);
  useLayoutEffect(() => {
    const surface = dialog.current;
    if (!surface) return;
    if (!open) {
      if (surface.open) surface.close();
      return;
    }
    if (!surface.open) surface.showModal();
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const box = surface.getBoundingClientRect(),
        margin = 16,
        gap = 8;
      const below = innerHeight - anchor.bottom - margin,
        above = anchor.top - margin;
      const top =
        below >= box.height
          ? anchor.bottom + gap
          : above >= box.height
            ? anchor.top - box.height - gap
            : Math.max(margin, (innerHeight - box.height) / 2);
      surface.style.left = `${Math.max(margin, Math.min(anchor.left, innerWidth - box.width - margin))}px`;
      surface.style.top = `${top}px`;
    };
    place();
    search.current?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  const filtered = useMemo(() => {
    const result = rows.filter(
      (row) =>
        searchText(row).toLowerCase().includes(query.trim().toLowerCase()) &&
        (!onlySelected || draft.has(getRowId(row))),
    );
    if (getSortValue)
      result.sort((a, b) => {
        const first = getSortValue(a, sort.column),
          second = getSortValue(b, sort.column);
        return (
          (typeof first === 'number' && typeof second === 'number'
            ? first - second
            : String(first).localeCompare(String(second), 'ru', { numeric: true })) *
          (sort.direction === 'asc' ? 1 : -1)
        );
      });
    return result;
  }, [rows, query, onlySelected, draft, sort, getSortValue, searchText, getRowId]);
  const pick = (next: Set<string>) => {
    const allowed = new Set(
      [...next].filter((key) => rows.some((row) => getRowId(row) === key && isRowSelectable(row))),
    );
    setDraft(multiple ? allowed : new Set([...allowed].slice(-1)));
  };
  const empty =
    rows.length === 0
      ? emptyMessage
      : onlySelected
        ? 'В этой выборке нет выбранных ресурсов'
        : 'По этому запросу ресурсов нет';
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <div className="basis-table-select" data-invalid={Boolean(error)}>
        <Button
          ref={trigger}
          id={id}
          className="basis-table-select__trigger"
          fullWidth
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${id}-picker`}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          disabled={disabled || loading}
          leadingIcon={<Table2 />}
          trailingIcon={loading ? <CloudLoader /> : <ChevronDown />}
          onClick={show}
        >
          <span className={!value.length ? 'basis-table-select__placeholder' : ''}>
            {loading
              ? 'Получаем ресурсы…'
              : chosen.length
                ? chosen[0] && getRowLabel(chosen[0])
                : value.length
                  ? `Выбрано: ${value.length}`
                  : placeholder}
            {chosen.length > 1 && (
              <span className="basis-table-select__count">+{chosen.length - 1}</span>
            )}
          </span>
        </Button>
      </div>
      {createPortal(
        <dialog
          ref={dialog}
          id={`${id}-picker`}
          className="basis-table-select__dialog"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-guidance`}
          onCancel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }}
        >
          <div className="basis-table-select__header">
            <span className="basis-table-select__symbol">
              <Table2 />
            </span>
            <div>
              <h2 id={`${id}-title`}>{title}</h2>
              <p id={`${id}-guidance`}>
                {multiple ? 'Можно выбрать несколько ресурсов' : 'Выберите один ресурс'} · изменения
                до применения — черновик
              </p>
            </div>
            <IconButton
              size="sm"
              variant="ghost"
              icon={<X />}
              aria-label="Закрыть выбор ресурсов"
              onClick={close}
            />
          </div>
          <div className="basis-table-select__body">
            <DataTable
              rows={filtered}
              columns={columns}
              getRowId={getRowId}
              getRowLabel={getRowLabel}
              caption={title}
              selected={draft}
              onSelectionChange={pick}
              selectionMode={multiple ? 'multiple' : 'single'}
              isRowSelectable={isRowSelectable}
              selectOnRowClick
              replaceToolbarOnSelection={false}
              sort={sort}
              onSortChange={setSort}
              toolbar={
                <>
                  <Input
                    ref={search}
                    size="sm"
                    aria-label={`Поиск: ${title}`}
                    placeholder="Имя, тип или статус ресурса"
                    leadingIcon={<Search />}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onClear={() => setQuery('')}
                  />
                  <Button
                    size="sm"
                    variant={onlySelected ? 'tonal' : 'ghost'}
                    aria-pressed={onlySelected}
                    onClick={() => setOnlySelected(!onlySelected)}
                  >
                    Выбранные · {draft.size}
                  </Button>
                </>
              }
              bulkToolbar={null}
              empty={
                <>
                  <Search size={24} />
                  <strong>{empty}</strong>
                  {query && (
                    <Button size="sm" onClick={() => setQuery('')}>
                      Очистить поиск
                    </Button>
                  )}
                </>
              }
              footer={
                <span>
                  Показано {filtered.length} из {rows.length}
                  {hiddenSelections ? ` · недоступно выбранных: ${hiddenSelections}` : ''}
                </span>
              }
            />
          </div>
          <div className="basis-table-select__footer">
            <div>
              <strong>Выбрано: {draft.size}</strong>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft.size}
                onClick={() => setDraft(new Set())}
              >
                Снять выбор
              </Button>
            </div>
            <div>
              <Button onClick={close}>Отмена</Button>
              <Button
                variant="primary"
                onClick={() => {
                  onValueChange([...draft]);
                  close();
                }}
              >
                Применить{draft.size ? ` · ${draft.size}` : ''}
              </Button>
            </div>
          </div>
        </dialog>,
        document.body,
      )}
    </Field>
  );
}

import {
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import type { DataColumn } from './DataTable';

export function redistributeColumnWidths(
  widths: Record<string, number>,
  id: string,
  desired: number,
  neighbor: string | undefined,
  minimum: number,
  maximum: number,
  neighborMinimum: number,
) {
  const next = { ...widths };
  next[id] = Math.round(Math.max(minimum, Math.min(maximum, desired)));
  if (neighbor)
    next[neighbor] = Math.max(neighborMinimum, widths[neighbor] - (next[id] - widths[id]));
  return next;
}

export function useTableColumnResize<T>({
  columns,
  widths,
  onChange,
  viewport,
  selection,
  enabled,
}: {
  columns: DataColumn<T>[];
  widths: Record<string, number>;
  onChange?: (widths: Record<string, number>) => void;
  viewport: RefObject<HTMLDivElement | null>;
  selection: boolean;
  enabled: boolean;
}) {
  const [available, setAvailable] = useState(0);
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const active = useRef<{
    id: string;
    neighbor: string | undefined;
    startX: number;
    start: Record<string, number>;
    minimum: number;
    maximum: number;
    neighborMinimum: number;
    pointer: number;
    handle: HTMLElement;
  } | null>(null);
  const style = viewport.current ? getComputedStyle(viewport.current) : null;
  const metric = (name: string, fallback: number) =>
    parseFloat(style?.getPropertyValue(`--basis-${name}`) || '') || fallback;
  const baseMin = metric('comp-table-resize-min-width', 96),
    max = metric('comp-table-resize-max-width', 720),
    step = metric('comp-table-resize-keyboard-step', 16);
  const headerMin = metric('comp-table-header-min-width', 160),
    actionWidth = metric('comp-table-column-actions-width', 48),
    selectWidth = selection ? metric('sys-table-selection-width', 44) : 0;
  const minimum = (column: DataColumn<T>) =>
    Math.max(
      baseMin,
      column.minWidth || 0,
      column.description && (column.sortable || column.filter) ? headerMin : 0,
    );
  const maximum = (column: DataColumn<T>) =>
    Math.max(
      minimum(column),
      Math.min(
        column.maxWidth ?? max,
        column.pinned === 'start' && available
          ? available - selectWidth - actionWidth - baseMin
          : Infinity,
      ),
    );
  const dataColumns = columns.filter((c) => c.utility !== 'actions');
  const sizes = Object.fromEntries(
    dataColumns.map((c) => [c.id, Math.max(minimum(c), draft?.[c.id] ?? widths[c.id] ?? c.width)]),
  );
  const total = () =>
    Object.values(sizes).reduce(
      (a, b) => a + b,
      selectWidth + columns.filter((c) => c.utility === 'actions').length * actionWidth,
    );
  const flexible = Object.keys(widths).length ? dataColumns.at(-1) : dataColumns[0];
  if (flexible && total() < available) sizes[flexible.id] += available - total();
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setAvailable(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewport, enabled]);
  const cancel = () => {
    const gesture = active.current;
    active.current = null;
    setDraft(null);
    if (gesture?.handle.hasPointerCapture?.(gesture.pointer))
      gesture.handle.releasePointerCapture(gesture.pointer);
  };
  const identity = columns.map((c) => c.id).join('|');
  useLayoutEffect(() => {
    cancel();
    return () => {
      const gesture = active.current;
      active.current = null;
      if (gesture?.handle.hasPointerCapture?.(gesture.pointer))
        gesture.handle.releasePointerCapture(gesture.pointer);
    };
  }, [identity, enabled]);
  const transaction = (column: DataColumn<T>, handle: HTMLElement) => {
    const start = { ...sizes };
    viewport.current?.querySelectorAll<HTMLElement>('th[data-column-id]').forEach((cell) => {
      const id = cell.dataset.columnId!;
      if (id in start && cell.getBoundingClientRect().width)
        start[id] = cell.getBoundingClientRect().width;
    });
    const index = dataColumns.findIndex((c) => c.id === column.id);
    const neighbor: DataColumn<T> | undefined =
      dataColumns.at(index + 1) ?? (index > 0 ? dataColumns.at(index - 1) : undefined);
    return {
      id: column.id,
      start,
      neighbor: neighbor?.id,
      minimum: minimum(column),
      maximum: Math.max(maximum(column), start[column.id]),
      neighborMinimum: neighbor ? minimum(neighbor) : 0,
      handle,
    };
  };
  const apply = (gesture: ReturnType<typeof transaction>, desired: number) =>
    redistributeColumnWidths(
      gesture.start,
      gesture.id,
      desired,
      gesture.neighbor,
      gesture.minimum,
      gesture.maximum,
      gesture.neighborMinimum,
    );
  const commit = (next: Record<string, number>) => {
    active.current = null;
    setDraft(null);
    onChange?.({ ...widths, ...next });
  };
  const finish = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const gesture = active.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (Math.abs(event.clientX - gesture.startX) < 1) {
      cancel();
      return;
    }
    const next = apply(gesture, gesture.start[gesture.id] + event.clientX - gesture.startX);
    commit(next);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleProps = (column: DataColumn<T>) => ({
    role: 'separator' as const,
    tabIndex: enabled ? 0 : -1,
    'aria-orientation': 'vertical' as const,
    'aria-label': `Изменить ширину: ${column.header}`,
    'aria-valuemin': minimum(column),
    'aria-valuemax': Math.max(maximum(column), sizes[column.id]),
    'aria-valuenow': Math.round(sizes[column.id]),
    'aria-valuetext': `${Math.round(sizes[column.id])} пикселей`,
    onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (!enabled || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      active.current = {
        ...transaction(column, event.currentTarget),
        startX: event.clientX,
        pointer: event.pointerId,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraft(active.current.start);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => {
      const gesture = active.current;
      if (!gesture || gesture.pointer !== event.pointerId) return;
      setDraft(apply(gesture, gesture.start[gesture.id] + event.clientX - gesture.startX));
    },
    onPointerUp: finish,
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (active.current) cancel();
    },
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (enabled) commit(apply(transaction(column, event.currentTarget), column.width));
    },
    onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        return;
      }
      if (!enabled || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const current = transaction(column, event.currentTarget);
      commit(
        apply(
          current,
          event.key === 'Home'
            ? column.width
            : current.start[column.id] +
                (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 4 : 1),
        ),
      );
    },
  });
  return { sizes, tableWidth: total(), actionWidth, resizing: Boolean(draft), handleProps };
}

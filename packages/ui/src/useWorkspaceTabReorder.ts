import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';

type Item = { id: string; label: string };
type Session = {
  id: string;
  pointer: number;
  capture: HTMLElement;
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};
type DragView = {
  id: string;
  before: string | null;
  valid: boolean;
  marker: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function moveBefore(ids: string[], id: string, before: string | null) {
  const rest = ids.filter((value) => value !== id);
  const index = before === null ? rest.length : rest.indexOf(before);
  rest.splice(index < 0 ? rest.length : index, 0, id);
  return rest;
}

/** Pointer capture keeps a drag local to the strip, including mouse, pen and touch. */
export function useWorkspaceTabReorder(
  root: RefObject<HTMLDivElement | null>,
  items: Item[],
  onReorder?: (ids: string[]) => void,
) {
  const latest = useRef({ items, onReorder });
  latest.current = { items, onReorder };
  const session = useRef<Session | null>(null),
    frame = useRef(0),
    lastFrame = useRef(0);
  const suppressClick = useRef(false),
    focusAfterMove = useRef<string | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null),
    [announcement, setAnnouncement] = useState('');
  const canReorder = Boolean(onReorder && items.length > 1);
  const tabButtons = () =>
    Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    const button = tabButtons().find(
      (node) => node.dataset.workspaceTab === focusAfterMove.current,
    );
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    focusAfterMove.current = null;
  }, [items]);

  const destination = (s: Session): DragView => {
    const list = root.current!,
      bounds = list.getBoundingClientRect();
    const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-favorite-id]')).filter(
      (node) => node.dataset.favoriteId !== s.id,
    );
    const before = nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return s.x < rect.left + rect.width / 2;
    });
    const edge =
      before?.getBoundingClientRect().left ??
      nodes.at(-1)?.getBoundingClientRect().right ??
      bounds.left;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    return {
      id: s.id,
      before: before?.dataset.favoriteId ?? null,
      valid:
        s.x >= bounds.left - 12 &&
        s.x <= bounds.right + 12 &&
        s.y >= bounds.top - 12 &&
        s.y <= bounds.bottom + 12,
      marker: Math.max(
        2,
        Math.min(
          list.scrollWidth - 2,
          edge - bounds.left + list.scrollLeft + (before ? -gap / 2 : gap / 2),
        ),
      ),
      x: s.x - s.offsetX,
      y: s.y - s.offsetY - 4,
      width: s.width,
      height: s.height,
    };
  };
  const release = () => {
    const current = session.current;
    session.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (current?.capture.hasPointerCapture?.(current.pointer))
      current.capture.releasePointerCapture(current.pointer);
    return current;
  };
  const cancel = () => {
    const current = release();
    if (!current) return;
    if (current.active) {
      suppressClick.current = true;
      setAnnouncement('Перемещение отменено. Порядок вкладок сохранён.');
    }
    setDrag(null);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !session.current) return;
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current();
    };
    const blur = () => cancelRef.current();
    document.addEventListener('keydown', escape, true);
    window.addEventListener('blur', blur);
    return () => {
      release();
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    if (session.current && (!onReorder || !items.some((item) => item.id === session.current?.id)))
      cancelRef.current();
  }, [items, onReorder]);

  const commit = (id: string, order: string[]) => {
    const original = latest.current.items;
    if (order.every((key, index) => original[index]?.id === key)) return;
    focusAfterMove.current = id;
    latest.current.onReorder?.(order);
    setAnnouncement(
      `«${original.find((item) => item.id === id)?.label}»: позиция ${order.indexOf(id) + 1} из ${order.length}.`,
    );
  };
  const tick = (time: number) => {
    const s = session.current,
      list = root.current;
    if (!s?.active || !list) return;
    const bounds = list.getBoundingClientRect(),
      edge = Math.min(40, bounds.width / 4);
    const elapsed = Math.min(32, time - (lastFrame.current || time));
    lastFrame.current = time;
    if (
      s.y >= bounds.top - 12 &&
      s.y <= bounds.bottom + 12 &&
      s.x >= bounds.left - 12 &&
      s.x <= bounds.right + 12
    ) {
      const speed =
        s.x < bounds.left + edge
          ? -Math.min(1, (bounds.left + edge - s.x) / edge)
          : s.x > bounds.right - edge
            ? Math.min(1, (s.x - bounds.right + edge) / edge)
            : 0;
      list.scrollLeft += speed * elapsed * 0.65;
    }
    const next = destination(s);
    setDrag((previous) =>
      previous &&
      Object.keys(next).every(
        (key) => previous[key as keyof DragView] === next[key as keyof DragView],
      )
        ? previous
        : next,
    );
    frame.current = requestAnimationFrame(tick);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (!canReorder || event.button !== 0 || event.isPrimary === false) return;
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>('[data-favorite-id]');
    if (!tab || target.closest('[data-workspace-remove]')) return;
    const rect = tab.getBoundingClientRect();
    const capture = target.closest<HTMLElement>('[role="tab"]') || tab;
    session.current = {
      id: tab.dataset.favoriteId!,
      pointer: event.pointerId,
      capture,
      active: false,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    capture.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = session.current;
    if (!s || s.pointer !== event.pointerId) return;
    s.x = event.clientX;
    s.y = event.clientY;
    if (!s.active && Math.abs(s.x - s.originX) >= 6) {
      s.active = true;
      suppressClick.current = true;
      lastFrame.current = 0;
      setAnnouncement(
        `Перемещение «${latest.current.items.find((item) => item.id === s.id)?.label}». Escape — отмена.`,
      );
      setDrag(destination(s));
      frame.current = requestAnimationFrame(tick);
    }
    if (s.active) event.preventDefault();
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = session.current;
    if (!s || s.pointer !== event.pointerId) return;
    s.x = event.clientX;
    s.y = event.clientY;
    if (!s.active) {
      release();
      return;
    }
    event.preventDefault();
    const target = destination(s);
    release();
    setDrag(null);
    if (!target.valid) {
      setAnnouncement('Перемещение отменено. Порядок вкладок сохранён.');
      return;
    }
    commit(
      s.id,
      moveBefore(
        latest.current.items.map((item) => item.id),
        s.id,
        target.before,
      ),
    );
  };
  const moveWithKeyboard = (id: string, direction: -1 | 1) => {
    if (!canReorder) return;
    const order = latest.current.items.map((item) => item.id),
      index = order.indexOf(id),
      next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    commit(id, order);
  };
  return {
    drag,
    announcement,
    canReorder,
    suppressClick,
    pointerDown,
    pointerMove,
    pointerUp,
    cancel,
    moveWithKeyboard,
  };
}

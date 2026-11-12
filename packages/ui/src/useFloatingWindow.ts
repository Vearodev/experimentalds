import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';

export type WindowRect = { x: number; y: number; width: number; height: number };
export type WindowBounds = {
  width: number;
  height: number;
  inset: number;
  minWidth: number;
  minHeight: number;
};
export function clampWindow(rect: WindowRect, bounds: WindowBounds): WindowRect {
  const maxWidth = Math.max(1, bounds.width - bounds.inset * 2);
  const maxHeight = Math.max(1, bounds.height - bounds.inset * 2);
  const width = Math.min(maxWidth, Math.max(Math.min(bounds.minWidth, maxWidth), rect.width));
  const height = Math.min(maxHeight, Math.max(Math.min(bounds.minHeight, maxHeight), rect.height));
  return {
    width,
    height,
    x: Math.max(bounds.inset, Math.min(rect.x, bounds.width - width - bounds.inset)),
    y: Math.max(bounds.inset, Math.min(rect.y, bounds.height - height - bounds.inset)),
  };
}
export function resizeWindow(
  rect: WindowRect,
  dx: number,
  dy: number,
  edge: string,
  bounds: WindowBounds,
): WindowRect {
  if (edge === 'move') return clampWindow({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
  let left = rect.x,
    top = rect.y,
    right = rect.x + rect.width,
    bottom = rect.y + rect.height;
  const minWidth = Math.min(bounds.minWidth, bounds.width - bounds.inset * 2);
  const minHeight = Math.min(bounds.minHeight, bounds.height - bounds.inset * 2);
  if (edge.includes('e'))
    right = Math.min(bounds.width - bounds.inset, Math.max(left + minWidth, right + dx));
  if (edge.includes('s'))
    bottom = Math.min(bounds.height - bounds.inset, Math.max(top + minHeight, bottom + dy));
  if (edge.includes('w')) left = Math.max(bounds.inset, Math.min(right - minWidth, left + dx));
  if (edge.includes('n')) top = Math.max(bounds.inset, Math.min(bottom - minHeight, top + dy));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function useFloatingWindow(mode: 'hidden' | 'embedded' | 'floating' = 'floating') {
  const root = useRef<HTMLElement>(null);
  const [rect, setRect] = useState<WindowRect | null>(null),
    [maximized, setMaximized] = useState(false),
    [moving, setMoving] = useState(false),
    [measured, setMeasured] = useState({ width: 0, height: 0 });
  const gesture = useRef<{
    rect: WindowRect;
    x: number;
    y: number;
    edge: string;
    pointer: number;
  } | null>(null);
  const bounds = (): WindowBounds => {
    const css = root.current ? getComputedStyle(root.current) : null;
    const read = (name: string, fallback: number) =>
      parseFloat(css?.getPropertyValue(`--basis-comp-console-${name}`) || '') || fallback;
    return {
      width: innerWidth,
      height: innerHeight,
      inset: read('inset', 16),
      minWidth: read('min-width', 480),
      minHeight: read('min-height', 360),
    };
  };
  const measure = (): WindowRect => {
    const r = root.current!.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  useLayoutEffect(() => {
    if (mode === 'hidden' || !root.current) return;
    const update = () => {
      const r = root.current?.getBoundingClientRect();
      if (r) setMeasured({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    const observer = new ResizeObserver(update);
    observer.observe(root.current);
    update();
    return () => observer.disconnect();
  }, [mode]);
  const setPreset = (preset: 'compact' | 'default') => {
    if (!root.current) return;
    const current = measure(),
      css = getComputedStyle(root.current);
    const width =
      parseFloat(
        css.getPropertyValue(`--basis-comp-console-${preset === 'compact' ? 'compact-' : ''}width`),
      ) || (preset === 'compact' ? 640 : 800);
    const height =
      parseFloat(
        css.getPropertyValue(
          `--basis-comp-console-${preset === 'compact' ? 'compact-' : ''}height`,
        ),
      ) || (preset === 'compact' ? 400 : 480);
    setRect(
      clampWindow(
        {
          x: current.x + current.width - width,
          y: current.y + current.height - height,
          width,
          height,
        },
        bounds(),
      ),
    );
    setMaximized(false);
  };
  useEffect(() => {
    const update = () => setRect((value) => (value ? clampWindow(value, bounds()) : null));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const start = (event: PointerEvent<HTMLElement>, edge: string) => {
    if (maximized || event.button !== 0 || !root.current) return;
    if (edge === 'move' && (event.target as Element).closest('button,a,input')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      rect: measure(),
      x: event.clientX,
      y: event.clientY,
      edge,
      pointer: event.pointerId,
    };
    setMoving(true);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointer) return;
    setRect(resizeWindow(g.rect, event.clientX - g.x, event.clientY - g.y, g.edge, bounds()));
  };
  const end = () => {
    gesture.current = null;
    setMoving(false);
  };
  const cancel = () => {
    if (gesture.current) setRect(gesture.current.rect);
    end();
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, edge: string) => {
    if (event.target !== event.currentTarget || maximized || !root.current) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 8;
    setRect(
      resizeWindow(
        measure(),
        event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        edge,
        bounds(),
      ),
    );
  };
  return {
    root,
    rect,
    maximized,
    moving,
    measured,
    setPreset,
    toggleMaximize: () => {
      if (!maximized && root.current) setRect(measure());
      setMaximized(!maximized);
    },
    start,
    move,
    end,
    cancel,
    keyboard,
  };
}

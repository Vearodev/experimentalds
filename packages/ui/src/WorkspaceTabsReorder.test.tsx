import { useState } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceTabs, type WorkspaceTab } from './WorkspaceTabs';
const select = vi.fn(),
  removed = vi.fn(),
  reordered = vi.fn();
const initial: WorkspaceTab[] = [
  { id: 'a', label: 'Машины' },
  { id: 'b', label: 'Снимки' },
  { id: 'c', label: 'Сети', disabled: true },
];
function Harness() {
  const [items, setItems] = useState(initial);
  return (
    <WorkspaceTabs
      items={items}
      value="a"
      onSelect={select}
      onRemove={removed}
      onReorder={(ids) => {
        reordered(ids);
        setItems(ids.map((id) => items.find((item) => item.id === id)!));
      }}
    />
  );
}
const order = () => screen.getAllByRole('tab').map((tab) => tab.textContent?.trim());
const pointer = { button: 0, pointerId: 1, isPrimary: true, clientY: 20 };
let frame: FrameRequestCallback;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    },
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      frame = callback;
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const index = Array.from(document.querySelectorAll('[data-favorite-id]')).indexOf(this);
    const left = index >= 0 ? index * 104 : 0,
      width = index >= 0 ? 100 : 400;
    return {
      left,
      right: left + width,
      top: 0,
      bottom: 44,
      width,
      height: 44,
      x: left,
      y: 0,
      toJSON: () => ({}),
    };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('drags a tab past its neighbours without navigating and suppresses the release click', () => {
  render(<Harness />);
  const source = screen.getByRole('tab', { name: 'Машины' }),
    list = screen.getByRole('tablist');
  fireEvent.pointerDown(source, { ...pointer, clientX: 50 });
  fireEvent.pointerMove(source, { ...pointer, clientX: 310 });
  expect(document.querySelector('.basis-workspace-tabs__drop-marker')).toBeInTheDocument();
  expect(document.querySelector('[data-drag-source="true"]')).toHaveAttribute(
    'data-favorite-id',
    'a',
  );
  fireEvent.pointerUp(list, { ...pointer, clientX: 310 });
  fireEvent.click(source, { detail: 1 });
  expect(reordered).toHaveBeenCalledWith(['b', 'c', 'a']);
  expect(order()).toEqual(['Снимки', 'Сети', 'Машины']);
  expect(select).not.toHaveBeenCalled();
  expect(source).toHaveAttribute('aria-selected', 'true');
  expect(source).toHaveFocus();
  expect(document.querySelector('.basis-workspace-tabs__drag-preview')).not.toBeInTheDocument();
});
it('does not treat a normal click, a small movement or the remove button as a drag', () => {
  render(<Harness />);
  const source = screen.getByRole('tab', { name: 'Снимки' });
  fireEvent.pointerDown(source, { ...pointer, clientX: 150 });
  fireEvent.pointerMove(source, { ...pointer, clientX: 153 });
  fireEvent.pointerUp(source, { ...pointer, clientX: 153 });
  fireEvent.click(source, { detail: 1 });
  expect(select).toHaveBeenCalledWith('b');
  expect(reordered).not.toHaveBeenCalled();
  const close = screen.getByRole('button', { name: 'Убрать из избранного: Машины' });
  fireEvent.pointerDown(close, { ...pointer, clientX: 90 });
  fireEvent.pointerMove(close, { ...pointer, clientX: 300 });
  fireEvent.pointerUp(close, { ...pointer, clientX: 300 });
  fireEvent.click(close, { detail: 1 });
  expect(removed).toHaveBeenCalledWith('a');
  expect(reordered).not.toHaveBeenCalled();
});
it.each(['escape', 'outside', 'cancel', 'lost capture', 'blur'])(
  'cancels a drag on %s without persisting a partial order',
  (reason) => {
    render(<Harness />);
    const source = screen.getByRole('tab', { name: 'Машины' });
    fireEvent.pointerDown(source, { ...pointer, clientX: 50 });
    fireEvent.pointerMove(source, { ...pointer, clientX: 300 });
    if (reason === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
    if (reason === 'outside')
      fireEvent.pointerUp(source, { ...pointer, clientX: 300, clientY: 150 });
    if (reason === 'cancel') fireEvent.pointerCancel(source, pointer);
    if (reason === 'lost capture') fireEvent.lostPointerCapture(source, pointer);
    if (reason === 'blur') fireEvent.blur(window);
    expect(reordered).not.toHaveBeenCalled();
    expect(order()).toEqual(['Машины', 'Снимки', 'Сети']);
    expect(document.querySelector('.basis-workspace-tabs__drag-preview')).not.toBeInTheDocument();
  },
);
it('reorders with the keyboard while preserving the active page, focus and boundary order', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const source = screen.getByRole('tab', { name: 'Машины' });
  source.focus();
  await user.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
  expect(order()).toEqual(['Снимки', 'Машины', 'Сети']);
  expect(source).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('позиция 2 из 3');
  await user.keyboard('{Alt>}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}{/Alt}');
  expect(reordered).toHaveBeenCalledTimes(2);
  expect(source).toHaveAttribute('aria-selected', 'true');
});
it('scrolls at the strip edge, stops on release and can move an unavailable resource', () => {
  render(<Harness />);
  const list = screen.getByRole('tablist'),
    source = screen.getByRole('tab', { name: 'Сети' });
  Object.defineProperty(list, 'scrollWidth', { value: 900 });
  fireEvent.pointerDown(source, { ...pointer, clientX: 250 });
  fireEvent.pointerMove(source, { ...pointer, clientX: 395 });
  act(() => frame(16));
  act(() => frame(32));
  expect(list.scrollLeft).toBeGreaterThan(0);
  fireEvent.pointerMove(source, { ...pointer, clientX: 5 });
  fireEvent.pointerUp(source, { ...pointer, clientX: 5 });
  expect(reordered).toHaveBeenCalledWith(['c', 'a', 'b']);
  expect(select).not.toHaveBeenCalled();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

import { useState } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNavigation, type SidebarItem } from './SidebarNavigation';
import { WorkspaceTabs } from './WorkspaceTabs';
const items: SidebarItem[] = [
  { id: 'overview', label: 'Обзор', icon: null },
  {
    id: 'compute',
    label: 'Вычисления',
    icon: null,
    children: [
      { id: 'vms', label: 'Машины', icon: null },
      { id: 'clusters', label: 'Кластеры', icon: null },
    ],
  },
];
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('scrolls overflowing console tabs with an ordinary wheel while preserving native horizontal gestures and zoom', () => {
  render(
    <WorkspaceTabs
      items={[{ id: 'vm-1', label: 'Машина' }]}
      value="vm-1"
      label="Открытые консоли"
      scrollWithWheel
      onSelect={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
  const list = screen.getByRole('tablist', { name: 'Открытые консоли' });
  Object.defineProperties(list, {
    scrollWidth: { value: 900 },
    clientWidth: { value: 400, configurable: true },
  });
  const wheel = new WheelEvent('wheel', { deltaY: 72, bubbles: true, cancelable: true });
  fireEvent(list, wheel);
  expect(list.scrollLeft).toBe(72);
  expect(wheel.defaultPrevented).toBe(true);
  const horizontal = new WheelEvent('wheel', { deltaX: 30, cancelable: true });
  fireEvent(list, horizontal);
  const zoom = new WheelEvent('wheel', { deltaY: 40, ctrlKey: true, cancelable: true });
  fireEvent(list, zoom);
  expect(horizontal.defaultPrevented).toBe(false);
  expect(zoom.defaultPrevented).toBe(false);
  expect(list.scrollLeft).toBe(72);
  Object.defineProperty(list, 'clientWidth', { value: 900 });
  const noOverflow = new WheelEvent('wheel', { deltaY: 40, cancelable: true });
  fireEvent(list, noOverflow);
  expect(noOverflow.defaultPrevented).toBe(false);
});
it('reveals compact submenus on intentional hover without stealing focus and bridges the pointer gap', () => {
  vi.useFakeTimers();
  render(
    <>
      <input aria-label="Поиск ресурса" />
      <SidebarNavigation items={items} activeId="vms" compact onNavigate={vi.fn()} />
    </>,
  );
  const search = screen.getByRole('textbox', { name: 'Поиск ресурса' });
  search.focus();
  const trigger = screen.getByRole('button', { name: 'Вычисления' });
  expect(
    trigger.parentElement?.querySelector('.basis-sidebar-nav__submenu-indicator'),
  ).toBeInTheDocument();
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(100));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(80));
  expect(search).toHaveFocus();
  const popup = screen.getByRole('menu', { name: 'Вычисления' }).parentElement!;
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(120));
  fireEvent.pointerEnter(popup);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.pointerLeave(popup);
  act(() => vi.advanceTimersByTime(240));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(search).toHaveFocus();
});
it('cancels transient hover and dismisses a hover menu with Escape from the current focus', () => {
  vi.useFakeTimers();
  render(<SidebarNavigation items={items} activeId="vms" compact onNavigate={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Вычисления' });
  fireEvent.pointerEnter(trigger);
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(180));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('allows collapsing a group and reveals it when navigation enters a child', async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  const ui = render(<SidebarNavigation items={items} activeId="overview" onNavigate={navigate} />);
  await user.click(screen.getByRole('button', { name: 'Вычисления' }));
  expect(screen.queryByRole('link', { name: 'Машины' })).not.toBeInTheDocument();
  ui.rerender(<SidebarNavigation items={items} activeId="vms" onNavigate={navigate} />);
  expect(screen.getByRole('link', { name: 'Машины' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('link', { name: 'Кластеры' }));
  expect(navigate).toHaveBeenCalledWith(items[1].children![1]);
});
it('opens compact groups as keyboard menus and returns focus on Escape', async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  render(<SidebarNavigation items={items} activeId="vms" compact onNavigate={navigate} />);
  await user.click(screen.getByRole('button', { name: 'Вычисления' }));
  const menu = screen.getByRole('menu', { name: 'Вычисления' });
  await user.click(within(menu).getByRole('menuitem', { name: 'Кластеры' }));
  expect(navigate).toHaveBeenCalledWith(items[1].children![1]);
  await user.click(screen.getByRole('button', { name: 'Вычисления' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Вычисления' })).toHaveFocus();
});
it('switches saved tabs with the keyboard, skips unavailable resources and removes without navigation', async () => {
  const user = userEvent.setup(),
    select = vi.fn(),
    empty = vi.fn();
  function Harness() {
    const [tabs, setTabs] = useState([
      { id: 'a', label: 'Машины' },
      { id: 'x', label: 'Удалённый', disabled: true },
      { id: 'b', label: 'Сеть' },
    ]);
    const [value, setValue] = useState('a');
    return (
      <WorkspaceTabs
        items={tabs}
        value={value}
        onSelect={(id) => {
          select(id);
          setValue(id);
        }}
        onRemove={(id) => setTabs(tabs.filter((item) => item.id !== id))}
        onEmptyFocus={empty}
      />
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole('tab', { name: 'Машины' }));
  select.mockClear();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Сеть' })).toHaveFocus();
  expect(select).toHaveBeenLastCalledWith('b');
  select.mockClear();
  await user.keyboard('{Delete}');
  expect(screen.queryByRole('tab', { name: 'Сеть' })).not.toBeInTheDocument();
  expect(select).not.toHaveBeenCalled();
  expect(screen.getByRole('tab', { name: 'Машины' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Все избранные вкладки' }));
  expect(screen.getByRole('menuitem', { name: 'Удалённый' })).toBeDisabled();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Убрать из избранного: Удалённый' }));
  await user.click(screen.getByRole('button', { name: 'Убрать из избранного: Машины' }));
  expect(empty).toHaveBeenCalled();
});

import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNavigation, type SidebarItem } from './SidebarNavigation';
import { Menu } from './Disclosure';

const items: SidebarItem[] = [
  { id: 'overview', label: 'Обзор', icon: null },
  {
    id: 'compute',
    label: 'Вычисления',
    icon: null,
    children: [
      { id: 'vms', label: 'Виртуальные машины', keywords: ['ВМ', 'VM'], icon: null },
      { id: 'clusters', label: 'Кластеры', icon: null },
    ],
  },
  {
    id: 'tools',
    label: 'Инструменты',
    icon: null,
    children: [{ id: 'reports', label: 'Отчёты', icon: null }],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('finds aliases inside closed groups without changing saved expansion, and restores it on Escape', async () => {
  const user = userEvent.setup(),
    expanded = vi.fn();
  render(
    <SidebarNavigation
      items={items}
      activeId="overview"
      expanded={[]}
      onExpandedChange={expanded}
      onNavigate={vi.fn()}
      searchable
    />,
  );
  const input = screen.getByRole('searchbox', { name: 'Найти раздел' });
  expect(screen.queryByRole('link', { name: 'Виртуальные машины' })).not.toBeInTheDocument();
  await user.type(input, 'ВМ');
  expect(screen.getByRole('link', { name: 'Виртуальные машины' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Кластеры' })).not.toBeInTheDocument();
  expect(expanded).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Вычисления' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

it('matches parent groups and е/ё, shows an empty result and clears it without navigation', async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  render(<SidebarNavigation items={items} activeId="overview" onNavigate={navigate} searchable />);
  const input = screen.getByRole('searchbox', { name: 'Найти раздел' });
  await user.type(input, 'вычисления');
  expect(screen.getAllByRole('link')).toHaveLength(2);
  await user.clear(input);
  await user.type(input, 'отчеты');
  expect(screen.getByRole('link', { name: 'Отчёты' })).toBeVisible();
  await user.clear(input);
  await user.type(input, 'несуществующий');
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
  expect(input).toHaveFocus();
  expect(input).toHaveValue('');
  expect(navigate).not.toHaveBeenCalled();
});

it('navigates results with the keyboard and opens the selected parent group', async () => {
  const user = userEvent.setup();
  function Example() {
    const [active, setActive] = useState('overview');
    return (
      <SidebarNavigation
        items={items}
        activeId={active}
        onNavigate={(item) => setActive(item.id)}
        searchable
      />
    );
  }
  render(<Example />);
  const input = screen.getByRole('searchbox', { name: 'Найти раздел' });
  await user.type(input, 'вычисления');
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('link', { name: 'Виртуальные машины' })).toHaveFocus();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(input).toHaveValue('');
  expect(screen.getByRole('link', { name: 'Кластеры' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Кластеры' })).toHaveFocus();
});

it('searches compact navigation in an existing Dialog and restores focus on close', async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  render(
    <SidebarNavigation
      items={items}
      activeId="overview"
      onNavigate={navigate}
      compact
      searchable
    />,
  );
  const trigger = screen.getByRole('button', { name: 'Найти раздел' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Перейти в раздел' });
  const input = within(dialog).getByRole('searchbox', { name: 'Найти раздел' });
  expect(input).toHaveFocus();
  await user.type(input, 'vm');
  await user.keyboard('{ArrowDown}{Enter}');
  expect(navigate).toHaveBeenCalledWith(items[1].children![0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('never returns sections outside the supplied, permission-filtered tree', async () => {
  const user = userEvent.setup();
  render(
    <SidebarNavigation
      items={items.slice(0, 2)}
      activeId="overview"
      onNavigate={vi.fn()}
      searchable
    />,
  );
  await user.type(screen.getByRole('searchbox', { name: 'Найти раздел' }), 'отчеты');
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
});

it('shows only one compact group when moving between hover menus', () => {
  vi.useFakeTimers();
  render(<SidebarNavigation items={items} activeId="vms" compact onNavigate={vi.fn()} />);
  const compute = screen.getByRole('button', { name: 'Вычисления' });
  const tools = screen.getByRole('button', { name: 'Инструменты' });
  fireEvent.pointerEnter(compute);
  act(() => vi.advanceTimersByTime(180));
  expect(screen.getByRole('menu', { name: 'Вычисления' })).toBeVisible();
  fireEvent.pointerLeave(compute);
  fireEvent.pointerEnter(tools);
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByRole('menu', { name: 'Вычисления' })).not.toBeInTheDocument();
  expect(screen.getByRole('menu', { name: 'Инструменты' })).toBeVisible();
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  expect(compute).toHaveAttribute('aria-expanded', 'false');
  expect(tools).toHaveAttribute('aria-expanded', 'true');
});

it('supports right/left arrows and exposes the current destination in a compact submenu', async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  render(<SidebarNavigation items={items} activeId="vms" compact onNavigate={navigate} />);
  const compute = screen.getByRole('button', { name: 'Вычисления' });
  compute.focus();
  await user.keyboard('{ArrowRight}');
  const current = screen.getByRole('menuitem', { name: 'Виртуальные машины' });
  expect(current).toHaveAttribute('aria-current', 'page');
  expect(current).toHaveAccessibleDescription('Текущий раздел');
  expect(current).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(compute).toHaveFocus();
  expect(navigate).not.toHaveBeenCalled();
});

it('dismisses a compact submenu on navigation scrolling and when search opens', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <SidebarNavigation items={items} activeId="vms" compact searchable onNavigate={vi.fn()} />,
  );
  const compute = screen.getByRole('button', { name: 'Вычисления' });
  await user.click(compute);
  fireEvent.scroll(container.querySelector('.basis-sidebar-nav__scroll')!);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(compute);
  await user.click(screen.getByRole('button', { name: 'Найти раздел' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Перейти в раздел' })).toBeVisible();
  expect(screen.getByRole('searchbox', { name: 'Найти раздел' })).toHaveFocus();
});

it('does not open flyouts when scrolling moves different icons underneath the pointer', () => {
  vi.useFakeTimers();
  const { container } = render(
    <SidebarNavigation items={items} activeId="vms" compact onNavigate={vi.fn()} />,
  );
  fireEvent.pointerEnter(screen.getByRole('button', { name: 'Вычисления' }));
  fireEvent.scroll(container.querySelector('.basis-sidebar-nav__scroll')!);
  const tools = screen.getByRole('button', { name: 'Инструменты' });
  fireEvent.pointerEnter(tools);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.pointerLeave(tools);
  fireEvent.pointerEnter(tools);
  act(() => vi.advanceTimersByTime(180));
  expect(screen.getByRole('menu', { name: 'Инструменты' })).toBeVisible();
});

it('replaces an open utility menu when a navigation group opens on hover', () => {
  vi.useFakeTimers();
  render(
    <>
      <Menu compact label="Рабочая область" items={[{ id: 'all', label: 'Вся платформа' }]} />
      <SidebarNavigation items={items} activeId="vms" compact onNavigate={vi.fn()} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Рабочая область' }));
  expect(screen.getByRole('menu', { name: 'Рабочая область' })).toBeVisible();
  fireEvent.pointerEnter(screen.getByRole('button', { name: 'Вычисления' }));
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByRole('menu', { name: 'Рабочая область' })).not.toBeInTheDocument();
  expect(screen.getByRole('menu', { name: 'Вычисления' })).toBeVisible();
  expect(screen.getAllByRole('menu')).toHaveLength(1);
});

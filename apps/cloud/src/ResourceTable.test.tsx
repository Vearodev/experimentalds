import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceTable } from './ResourceTable';
import type { RegistryColumn } from './registry-model';
const rows = [
  { id: 'one', name: 'task-one', time: '2026-11-11T23:59:59' },
  { id: 'two', name: 'task-two', time: '2026-11-12T08:00:00' },
];
const columns: RegistryColumn<(typeof rows)[number]>[] = [
  {
    id: 'name',
    header: 'Имя',
    width: 200,
    pinned: 'start',
    value: (r) => r.name,
    render: (r) => r.name,
  },
  {
    id: 'time',
    header: 'Дата',
    width: 160,
    kind: 'date',
    value: (r) => r.time,
    render: (r) => r.time,
  },
];
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Registry filter transaction', () => {
  it('opens a resource from free row space and preserves selection and the route', async () => {
    const preview = vi.fn(),
      user = userEvent.setup(),
      route = location.hash;
    render(
      <ResourceTable
        rows={rows}
        columns={columns}
        caption="Ресурсы"
        tableId="row-preview"
        onRowActivate={preview}
        bulkActions={() => <span>Действия</span>}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать task-one' }));
    expect(preview).not.toHaveBeenCalled();
    const cell = screen.getByText(rows[1].time),
      row = cell.closest('tr')!;
    await user.click(cell);
    expect(preview).toHaveBeenCalledExactlyOnceWith(rows[1], row);
    expect(screen.getByRole('checkbox', { name: 'Выбрать task-one' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Выбрать task-two' })).not.toBeChecked();
    expect(location.hash).toBe(route);
  });
  it('loads the registry, keeps selection and rows during refresh, rejects duplicate requests and retries a stale result', async () => {
    const user = userEvent.setup();
    let resolve!: (result: { empty: boolean }) => void, reject!: (error: Error) => void;
    const load = vi.fn(
      () =>
        new Promise<{ empty: boolean }>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    render(
      <ResourceTable
        rows={rows}
        columns={columns}
        caption="Ресурсы"
        tableId="request"
        load={load}
        bulkActions={() => null}
      />,
    );
    expect(screen.queryByText('task-one')).not.toBeInTheDocument();
    await act(async () => resolve({ empty: false }));
    const row = screen.getByText('task-one').closest('tr');
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать task-one' }));
    const refresh = screen.getByRole('button', { name: 'Обновить данные таблицы' });
    await user.click(refresh);
    await user.click(refresh);
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('task-one').closest('tr')).toBe(row);
    await act(async () => reject(new Error('Нет связи')));
    expect(screen.getByText('Не удалось обновить данные')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Выбрать task-one' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    await act(async () => resolve({ empty: false }));
    await waitFor(() =>
      expect(screen.queryByText('Не удалось обновить данные')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'Выбрать task-one' })).toBeChecked();
    await user.click(refresh);
    await act(async () => resolve({ empty: true }));
    expect(screen.getByText('Ресурсов пока нет')).toBeInTheDocument();
    expect(screen.queryByText('task-one')).not.toBeInTheDocument();
  });
  it('groups before pagination, counts the filtered result, and restores a grouping by a hidden field', async () => {
    const user = userEvent.setup();
    const resources = Array.from({ length: 16 }, (_, index) => ({
      id: `r${index}`,
      name: `vm${String(index).padStart(2, '0')}`,
      project: index % 2 ? 'A' : 'B',
    }));
    const definitions: RegistryColumn<(typeof resources)[number]>[] = [
      {
        id: 'name',
        header: 'Имя',
        width: 220,
        pinned: 'start',
        value: (r) => r.name,
        render: (r) => r.name,
      },
      {
        id: 'project',
        header: 'Проект',
        width: 180,
        hidden: true,
        kind: 'enum',
        value: (r) => r.project,
        render: (r) => r.project,
        options: [
          { value: 'A', label: 'Alpha' },
          { value: 'B', label: 'Beta' },
        ],
      },
    ];
    const props = { rows: resources, columns: definitions, caption: 'Ресурсы', tableId: 'grouped' };
    const first = render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('button', { name: 'Настроить группировку' }));
    await user.click(screen.getByRole('combobox', { name: 'Группировать по' }));
    await user.click(screen.getByRole('option', { name: 'Проект' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(screen.queryByRole('button', { name: 'Сортировать: Проект' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть группу «Alpha»' })).toBeInTheDocument();
    expect(screen.getByText('На странице: 4 из 8')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('vm15')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('vm14')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(
      screen.queryByRole('button', { name: 'Свернуть группу «Alpha»' }),
    ).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('vm14')).toBeInTheDocument();
    first.unmount();
    render(<ResourceTable {...props} />);
    expect(screen.getByRole('button', { name: 'Настроить группировку' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(screen.getByRole('table')).getByText('vm14')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' }), 'vm1');
    expect(screen.getAllByLabelText('Ресурсов в группе: 3')).toHaveLength(2);
    expect(screen.queryByText(/На странице:/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Убрать группировку' }));
    expect(screen.queryByRole('button', { name: /Свернуть группу/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' })).toHaveValue('vm1');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(7);
  });
  it('switches shared tabs with the keyboard and keeps the search in preset counts', async () => {
    const user = userEvent.setup();
    render(
      <ResourceTable
        rows={rows}
        columns={columns}
        caption="Журнал"
        tableId="preset-test"
        presets={[
          {
            label: 'Первая задача',
            filters: [{ field: 'name', operator: 'equals', value: 'task-one', to: '', values: [] }],
          },
        ]}
      />,
    );
    const all = screen.getByRole('tab', { name: 'Все, 2' });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', all.getAttribute('aria-controls'));
    await user.click(all);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Первая задача, 1' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Первая задача, 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Поиск: Журнал' }), 'two');
    expect(screen.getByRole('tab', { name: 'Первая задача, 0' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('tab', { name: 'Все, 1' }));
    expect(within(screen.getByRole('table')).getByText('task-two')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Поиск: Журнал' })).toHaveValue('two');
  });
  it('labels manual filters as a custom view and restores all rows through the tab', async () => {
    const user = userEvent.setup();
    render(
      <ResourceTable
        rows={rows}
        columns={columns}
        caption="Журнал"
        tableId="custom-test"
        presets={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Фильтр: Имя' }));
    await user.type(screen.getByLabelText('Значение: Имя'), 'task-two');
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    const custom = screen.getByRole('tab', { name: 'По условиям, 1' });
    expect(custom).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('По условиям, 1');
    await user.click(custom);
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Все, 2' })).toHaveFocus();
    expect(screen.queryByRole('tab', { name: 'По условиям, 1' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });
  it('updates calendar input immediately, applies its date and restores the saved view', async () => {
    const user = userEvent.setup();
    const props = { rows, columns, caption: 'Журнал', tableId: 'date-test' };
    const first = render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('button', { name: 'Фильтр: Дата' }));
    fireEvent.input(screen.getByLabelText('Дата от'), { target: { value: '2026-11-12' } });
    fireEvent.input(screen.getByLabelText('Дата до'), { target: { value: '2026-11-12' } });
    expect(
      within(screen.getByRole('dialog')).getByText('1', { selector: 'strong' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(within(screen.getByRole('table')).queryByText('task-one')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('task-two')).toBeInTheDocument();
    first.unmount();
    render(<ResourceTable {...props} />);
    expect(within(screen.getByRole('table')).queryByText('task-one')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Фильтр: Дата' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('keeps the current result when a changed filter is cancelled', async () => {
    const user = userEvent.setup();
    render(<ResourceTable rows={rows} columns={columns} caption="Журнал" tableId="cancel-test" />);
    await user.click(screen.getByRole('button', { name: 'Фильтр: Имя' }));
    await user.type(screen.getByLabelText('Значение: Имя'), 'task-one');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Фильтр: Имя' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

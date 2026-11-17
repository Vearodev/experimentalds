import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceTable } from './ResourceTable';
import { defaultView, restoreView, type RegistryColumn } from './registry-model';
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
  localStorage.clear();
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
  it('uses one navigation interaction above and below, persists placement and keeps the current page', async () => {
    const user = userEvent.setup();
    const resources = Array.from({ length: 53 }, (_, i) => ({
      id: `vm${i}`,
      name: `vm-${i}`,
      time: rows[0].time,
    }));
    const props = { rows: resources, columns, caption: 'Ресурсы', tableId: 'navigator-placement' };
    const first = render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('button', { name: 'Следующая страница — сверху' }));
    for (const control of screen.getAllByRole('button', { name: /Навигация по данным/ })) {
      expect(control).toHaveTextContent('Стр. 2 из 5');
    }
    expect(screen.getByLabelText('Записи 13–24 из 53')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Навигация по данным' })).toHaveAccessibleDescription(
      'Страница 2 из 5, 12 на странице',
    );
    await user.click(screen.getByRole('button', { name: 'Навигация по данным' }));
    await user.click(screen.getByRole('button', { name: 'В конец' }));
    expect(
      screen.getByRole('button', { name: 'Навигация по данным — сверху' }),
    ).toHaveAccessibleDescription('Страница 5 из 5, 12 на странице');
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Расположение навигации' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Только в шапке' }));
    expect(screen.queryByRole('group', { name: 'Пагинация под таблицей' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Записи 49–53 из 53')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Навигация по данным — сверху' }),
    ).toHaveAccessibleDescription('Страница 5 из 5, 12 на странице');
    first.unmount();
    render(<ResourceTable {...props} />);
    expect(screen.queryByRole('group', { name: 'Пагинация под таблицей' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Расположение навигации' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Только внизу' }));
    expect(screen.queryByRole('group', { name: 'Пагинация над таблицей' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Навигация по данным' }));
    await user.click(screen.getByRole('button', { name: 'В начало' }));
    expect(screen.getByRole('button', { name: 'Навигация по данным' })).toHaveAccessibleDescription(
      'Страница 1 из 5, 12 на странице',
    );
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Расположение навигации' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'В шапке и внизу' }));
    expect(screen.getAllByRole('button', { name: /Навигация по данным/ })).toHaveLength(2);
  });
  it('returns focus after changing page size and does not commit an abandoned page draft', async () => {
    const user = userEvent.setup();
    render(
      <ResourceTable rows={rows} columns={columns} caption="Ресурсы" tableId="navigation-focus" />,
    );
    const trigger = screen.getByRole('button', { name: 'Навигация по данным — сверху' });
    await user.click(trigger);
    const input = screen.getByRole('textbox', { name: 'Номер страницы' });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, '9');
    await user.click(screen.getByRole('button', { name: 'Закрыть: Навигация по списку' }));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription('Страница 1 из 1, 12 на странице');
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '24 на странице' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription('Страница 1 из 1, 24 на странице');
  });
  it('opens with the explicit default over a temporary session filter and allows disabling the default without clearing current data', async () => {
    const user = userEvent.setup(),
      one = { field: 'name', operator: 'contains', value: 'one', to: '', values: [] };
    localStorage.setItem(
      'basis.filter-presets.v1:cloud:default-filter',
      JSON.stringify({
        version: 1,
        defaultId: 'one',
        items: [{ id: 'one', name: 'Первая задача', rules: [one], updatedAt: 1 }],
      }),
    );
    sessionStorage.setItem(
      'basis.registry.v2:default-filter',
      JSON.stringify({
        ...defaultView(columns),
        query: 'task',
        pageSize: 24,
        filters: [{ ...one, value: 'two' }],
      }),
    );
    const props = { rows, columns, caption: 'Ресурсы', tableId: 'default-filter' };
    const first = render(<ResourceTable {...props} />);
    expect(within(screen.getByRole('table')).getByText('task-one')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' })).toHaveValue('task');
    expect(screen.getByRole('button', { name: 'Навигация по данным — сверху' })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('24 на странице'),
    );
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(within(screen.getByRole('table')).getByText('task-two')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'Запомнить выбор' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    first.unmount();
    const again = render(<ResourceTable {...props} />);
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    let toggle = screen.getByRole('menuitemcheckbox', { name: 'Запомнить выбор' });
    expect(toggle).toBeChecked();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Удалить/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /Сохранить|Создать копию/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Управление наборами' }));
    await user.click(screen.getByRole('button', { name: 'Действия с набором «Первая задача»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Удалить набор' }));
    expect(
      screen.queryByRole('button', { name: 'Применить набор «Первая задача»' }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem('basis.filter-presets.v1:cloud:default-filter')!).defaultId,
    ).toBeNull();
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Отменить изменение' }));
    expect(
      screen.getByRole('button', { name: 'Применить набор «Первая задача»' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    toggle = screen.getByRole('menuitemcheckbox', { name: 'Запомнить выбор' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Сохранённые фильтры' })).toHaveFocus();
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    again.unmount();
    render(<ResourceTable {...props} />);
    expect(within(screen.getByRole('table')).getByText('task-two')).toBeInTheDocument();
  });
  it('enables the opening preference directly in the menu and creates an explicitly named copy', async () => {
    const user = userEvent.setup();
    const key = 'basis.filter-presets.v1:cloud:preset-copy';
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'one',
            name: 'Первая задача',
            updatedAt: 1,
            rules: [{ field: 'name', operator: 'contains', value: 'one', to: '', values: [] }],
          },
        ],
      }),
    );
    render(<ResourceTable rows={rows} columns={columns} caption="Ресурсы" tableId="preset-copy" />);
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'Запомнить выбор' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'Первая задача' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Запомнить выбор' });
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(JSON.parse(localStorage.getItem(key)!).defaultId).toBe('one');
    await user.keyboard(' ');
    expect(toggle).not.toBeChecked();
    await user.click(screen.getByRole('menuitem', { name: 'Управление наборами' }));
    await user.click(screen.getByRole('button', { name: 'Действия с набором «Первая задача»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Создать копию набора' }));
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Название копии набора' })).toHaveValue(
      'Первая задача · копия',
    );
    await user.click(screen.getByRole('button', { name: 'Создать копию' }));
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved.items.map((p: { name: string }) => p.name)).toEqual([
      'Первая задача · копия',
      'Первая задача',
    ]);
    expect(saved.items[0].rules).toEqual(saved.items[1].rules);
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Первая задача · копия' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(screen.getByRole('menuitemradio', { name: 'Первая задача · копия' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Первая задача' })).not.toBeChecked();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Запомнить выбор' }));
    expect(JSON.parse(localStorage.getItem(key)!).defaultId).toBe(saved.items[0].id);
    await user.click(screen.getByRole('menuitemradio', { name: 'Первая задача' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(screen.getByRole('menuitemradio', { name: 'Первая задача' })).toBeChecked();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Запомнить выбор' })).not.toBeChecked();
  });
  it('saves filters locally and reapplies them in two clicks without changing search, selection, sort or tile view', async () => {
    const user = userEvent.setup();
    const props = {
      rows,
      columns,
      caption: 'Ресурсы',
      tableId: 'presets',
      initialSort: [{ column: 'time', direction: 'desc' as const }],
      bulkActions: () => null,
    };
    const first = render(<ResourceTable {...props} />);
    await user.type(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' }), 'task');
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать task-two' }));
    await user.click(screen.getByRole('button', { name: 'Фильтр: Имя' }));
    await user.type(screen.getByLabelText('Значение: Имя'), 'one');
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    await user.click(screen.getByRole('menuitem', { name: 'Сохранить текущие условия' }));
    await user.type(screen.getByRole('textbox', { name: 'Название нового набора' }), 'Одна задача');
    await user.click(screen.getByRole('button', { name: 'Сохранить набор' }));
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Одна задача' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article')).toHaveTextContent('task-one');
    expect(screen.getByText('1 вне страницы')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('basis.registry.v2:presets')!)).toMatchObject({
      query: 'task',
      display: 'tiles',
      sorts: props.initialSort,
      filters: [expect.objectContaining({ value: 'one' })],
    });
    first.unmount();
    const restored = render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(screen.getByRole('menuitemradio', { name: 'Одна задача' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    restored.unmount();
    render(<ResourceTable {...props} tableId="separate" />);
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Одна задача' })).not.toBeInTheDocument();
  });
  it('keeps obsolete saved filters visible but prevents applying a partial or unavailable condition set', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'basis.filter-presets.v1:cloud:preset-invalid',
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'old',
            name: 'Устаревший набор',
            updatedAt: 1,
            rules: [{ field: 'missing', operator: 'contains', value: 'prod', to: '', values: [] }],
          },
        ],
      }),
    );
    render(
      <ResourceTable rows={rows} columns={columns} caption="Ресурсы" tableId="preset-invalid" />,
    );
    await user.click(screen.getByRole('button', { name: 'Сохранённые фильтры' }));
    expect(screen.getByRole('menuitemradio', { name: 'Устаревший набор' })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Управление наборами' }));
    expect(
      screen.getByRole('button', { name: 'Применить набор «Устаревший набор»' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Применить набор «Устаревший набор»' }),
    ).toHaveTextContent('Поля изменились. Создайте новый набор.');
  });
  it('jumps to a page, validates the number and preserves the visible anchor and selection when changing page size', async () => {
    const user = userEvent.setup();
    const resources = Array.from({ length: 53 }, (_, i) => ({
      id: `vm${i}`,
      name: `vm-${String(i).padStart(2, '0')}`,
      time: rows[0].time,
    }));
    render(
      <ResourceTable
        rows={resources}
        columns={columns}
        caption="Ресурсы"
        tableId="page-size"
        bulkActions={() => <span>Действия</span>}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Навигация по данным — сверху' }));
    let input = screen.getByRole('textbox', { name: 'Номер страницы' });
    await user.clear(input);
    await user.type(input, '3{Enter}');
    expect(
      screen
        .getAllByRole('button', { name: /Навигация по данным/ })
        .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 3 из 5,')),
    ).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать vm-24' }));
    await user.click(screen.getByRole('button', { name: 'Навигация по данным' }));
    input = screen.getByRole('textbox', { name: 'Номер страницы' });
    for (const value of ['0', '6', '1.5', 'abc']) {
      await user.clear(input);
      await user.type(input, `${value}{Enter}`);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Введите страницу от 1 до 5')).toBeVisible();
      expect(
        screen
          .getAllByRole('button', { name: /Навигация по данным/ })
          .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 3 из 5,')),
      ).toHaveLength(2);
    }
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: '24 на странице' }));
    expect(
      screen
        .getAllByRole('button', { name: /Навигация по данным/ })
        .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 2 из 3,')),
    ).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-24' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Навигация по данным' })).toHaveTextContent(
      'Стр. 2 из 3',
    );
    expect(screen.getByLabelText('Записи 25–48 из 53')).toBeVisible();
    expect(JSON.parse(sessionStorage.getItem('basis.registry.v2:page-size')!)).toMatchObject({
      page: 2,
      pageSize: 24,
    });
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    expect(
      within(screen.getByRole('group', { name: 'Отображение' })).getByRole('menuitemradio', {
        name: 'Таблица',
      }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      within(screen.getByRole('group', { name: 'Загрузка' })).getByRole('menuitemradio', {
        name: 'По страницам',
      }),
    ).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'При прокрутке' }));
    expect(screen.queryByRole('textbox', { name: 'Номер страницы' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Навигация по данным — сверху' }));
    expect(screen.getByRole('group', { name: 'Размер порции' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Закрыть: Навигация по списку' }));
    expect(screen.getByRole('button', { name: 'Фильтры' }).closest('[inert]')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Настроить сортировку' }).closest('[inert]'),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Фильтры' }));
    expect(screen.getByRole('dialog', { name: 'Фильтры' })).toBeVisible();
  });
  it('restores column widths and page size, resets widths and keeps utility columns fixed', async () => {
    const user = userEvent.setup();
    const definitions: RegistryColumn<(typeof rows)[number]>[] = [
      ...columns,
      {
        id: 'actions',
        header: 'Действия',
        width: 48,
        utility: 'actions',
        value: () => null,
        render: () => null,
      },
    ];
    const props = { rows, columns: definitions, caption: 'Ресурсы', tableId: 'saved-size' };
    const first = render(<ResourceTable {...props} />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Изменить ширину: Имя' }), {
      key: 'ArrowRight',
    });
    await user.click(screen.getByRole('button', { name: 'Навигация по данным — сверху' }));
    await user.click(screen.getByRole('button', { name: '24 на странице' }));
    first.unmount();
    render(<ResourceTable {...props} />);
    expect(screen.getByRole('separator', { name: 'Изменить ширину: Имя' })).toHaveAttribute(
      'aria-valuenow',
      '216',
    );
    expect(screen.getByRole('button', { name: 'Навигация по данным — сверху' })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('24 на странице'),
    );
    expect(
      screen.queryByRole('separator', { name: 'Изменить ширину: Действия' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Стандартная ширина колонок' }));
    expect(screen.getByRole('separator', { name: 'Изменить ширину: Имя' })).toHaveAttribute(
      'aria-valuenow',
      '200',
    );
    expect(JSON.parse(sessionStorage.getItem('basis.registry.v2:saved-size')!)).toMatchObject({
      pageSize: 24,
      columnWidths: {},
    });
  });
  it('disables direct page entry for an empty result', async () => {
    const user = userEvent.setup();
    render(<ResourceTable rows={[]} columns={columns} caption="Ресурсы" tableId="empty-pages" />);
    await user.click(screen.getByRole('button', { name: 'Навигация по данным' }));
    expect(screen.getByRole('textbox', { name: 'Номер страницы' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();
  });
  it('shares top/footer pagination, appends batches in both views and selects only loaded resources', async () => {
    const user = userEvent.setup();
    const resources = Array.from({ length: 27 }, (_, i) => ({
      id: `vm${i}`,
      name: `vm-${String(i).padStart(2, '0')}`,
      time: '2026-11-11T23:59:59',
    }));
    let complete!: (value: { empty: boolean }) => void;
    const load = vi.fn().mockResolvedValue({ empty: false });
    sessionStorage.setItem(
      'basis.registry.v2:paging',
      JSON.stringify({ ...defaultView(columns), grouping: { field: 'time', direction: 'asc' } }),
    );
    const result = render(
      <ResourceTable
        rows={resources}
        columns={columns}
        caption="Ресурсы"
        tableId="paging"
        load={load}
        bulkActions={() => <span>Действия</span>}
      />,
    );
    await screen.findByRole('checkbox', { name: 'Выбрать vm-00' });
    await user.click(screen.getByRole('button', { name: 'Следующая страница — сверху' }));
    expect(
      screen
        .getAllByRole('button', { name: /Навигация по данным/ })
        .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 2 из 3,')),
    ).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: 'Выбрать vm-00' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'При прокрутке' }));
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать все загруженные строки' }));
    expect(screen.getByText('Загружено: 12 из 27')).toBeVisible();
    expect(result.container.querySelectorAll('[data-row-id][data-selected="true"]')).toHaveLength(
      12,
    );
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
    expect(result.container.querySelectorAll('[data-row-id]')).toHaveLength(12);
    expect(screen.getByText('Загружаем следующую порцию…')).toBeVisible();
    await act(async () => complete({ empty: false }));
    expect(result.container.querySelectorAll('[data-row-id]')).toHaveLength(24);
    expect(result.container.querySelectorAll('tbody[data-group-key]')).toHaveLength(1);
    expect(screen.getByText('Загружено: 24 из 27')).toBeVisible();
    expect(result.container.querySelectorAll('[data-row-id][data-selected="true"]')).toHaveLength(
      12,
    );
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать все загруженные строки' }),
    ).toBePartiallyChecked();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    expect(screen.getAllByRole('article')).toHaveLength(24);
    load.mockRejectedValueOnce(new Error('Нет связи'));
    await user.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи');
    expect(screen.getAllByRole('article')).toHaveLength(24);
    await user.click(screen.getByRole('button', { name: 'Повторить подгрузку' }));
    expect(screen.getAllByRole('article')).toHaveLength(27);
    expect(screen.getByText('Все ресурсы загружены · 27')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Загрузить ещё' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Снять выбор строк' }));
    await user.type(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' }), 'vm-26');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(JSON.parse(sessionStorage.getItem('basis.registry.v2:paging')!)).toMatchObject({
      paging: 'infinite',
      display: 'tiles',
      page: 1,
    });
  });
  it('switches the same filtered, sorted, grouped page to tiles without losing cross-page selection and restores that view', async () => {
    const user = userEvent.setup();
    const resources = Array.from({ length: 30 }, (_, index) => ({
      id: `r${index}`,
      name: `vm-${String(index).padStart(2, '0')}`,
      group: index < 15 ? 'Alpha' : 'Beta',
      cpu: index,
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
        id: 'group',
        header: 'Проект',
        width: 180,
        kind: 'text',
        value: (r) => r.group,
        render: (r) => r.group,
      },
      {
        id: 'cpu',
        header: 'vCPU',
        width: 160,
        kind: 'number',
        value: (r) => r.cpu,
        render: (r) => r.cpu,
      },
    ];
    const defaults = defaultView(definitions);
    const saved = {
      ...defaults,
      query: 'vm',
      filters: [{ field: 'cpu', operator: 'gte', value: '5', to: '', values: [] }],
      sorts: [{ column: 'cpu', direction: 'desc' }],
      grouping: { field: 'group', direction: 'asc' },
      columns: ['name', 'cpu'],
      columnOrder: ['name', 'cpu', 'group'],
    };
    sessionStorage.setItem('basis.registry.v2:view-contract', JSON.stringify(saved));
    const props = {
      rows: resources,
      columns: definitions,
      caption: 'Ресурсы',
      tableId: 'view-contract',
      bulkActions: (selected: typeof resources) => (
        <span>{selected.map((r) => r.name).join(' + ')}</span>
      ),
    };
    const first = render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать vm-14' }));
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    const idsBefore = Array.from(first.container.querySelectorAll('tr[data-row-id]')).map((el) =>
      el.getAttribute('data-row-id'),
    );
    expect(idsBefore).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    expect(
      screen
        .getAllByRole('button', { name: /Навигация по данным/ })
        .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 2 из 3,')),
    ).toHaveLength(2);
    expect(screen.getByText('1 вне страницы')).toBeVisible();
    expect(
      Array.from(first.container.querySelectorAll('article[data-row-id]')).map((el) =>
        el.getAttribute('data-row-id'),
      ),
    ).toEqual(idsBefore);
    expect(screen.getByRole('button', { name: 'Свернуть группу «Beta»' })).toBeInTheDocument();
    const tile = screen.getAllByRole('article')[0];
    expect(within(tile).queryByText('Проект')).not.toBeInTheDocument();
    expect(within(tile).getByText('vCPU')).toBeVisible();
    await user.click(within(tile).getByRole('checkbox'));
    expect(screen.getByText('vm-14 + vm-27')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Таблица' }));
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-27' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    const restored = restoreView(
      sessionStorage.getItem('basis.registry.v2:view-contract'),
      definitions,
      defaults,
    );
    expect(restored).toMatchObject({ ...saved, display: 'tiles', page: 2 });
    first.unmount();
    render(<ResourceTable {...props} />);
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    expect(screen.getByRole('menuitemradio', { name: 'Плитки' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(
      screen
        .getAllByRole('button', { name: /Навигация по данным/ })
        .filter((el) => el.getAttribute('aria-description')?.startsWith('Страница 2 из 3,')),
    ).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Поиск: Ресурсы' })).toHaveValue('vm');
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Поля плиток' }));
    expect(screen.getByRole('dialog', { name: 'Поля плиток' })).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Проект' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(within(screen.getAllByRole('article')[0]).getByText('Проект')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Таблица' }));
    expect(screen.getByRole('button', { name: 'Сортировать: Проект' })).toBeVisible();
  });

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
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitem', { name: 'Группировка' }));
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
    expect(screen.getByRole('button', { name: 'Свернуть группу «Beta»' })).toBeInTheDocument();
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
        presets={[
          {
            label: 'Первая задача',
            filters: [{ field: 'name', operator: 'equals', value: 'task-one', to: '', values: [] }],
          },
        ]}
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
  it('cancels and resets filters without introducing tabs when no presets are available', async () => {
    const user = userEvent.setup();
    render(
      <ResourceTable
        rows={rows}
        columns={columns}
        caption="Журнал"
        tableId="cancel-test"
        presets={[]}
      />,
    );
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Фильтр: Имя' }));
    await user.type(screen.getByLabelText('Значение: Имя'), 'task-one');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Фильтр: Имя' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Фильтр: Имя' }));
    await user.type(screen.getByLabelText('Значение: Имя'), 'task-one');
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('task-two')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });
});

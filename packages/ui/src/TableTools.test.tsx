import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableToolsPanel, type TableToolsPanelProps, type TableToolsValue } from './TableTools';

beforeEach(() => {
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
const nameRule = {
  field: 'name',
  operator: 'contains' as const,
  value: 'prod',
  to: '',
  values: [],
};
const initial: TableToolsValue = {
  filters: [nameRule],
  sorts: [{ column: 'name', direction: 'asc' }],
  order: ['name', 'ram', 'ip', 'actions'],
  hidden: new Set(['ip']),
};
function props(
  mode: TableToolsPanelProps['mode'],
  patch: Partial<TableToolsPanelProps> = {},
): TableToolsPanelProps {
  return {
    mode,
    caption: 'Виртуальные машины',
    anchor: null,
    fields: [
      { id: 'name', label: 'Имя', kind: 'text' },
      { id: 'ram', label: 'RAM', kind: 'number', unit: 'GiB', min: 0 },
      { id: 'ip', label: 'IP-адрес', kind: 'ip' },
    ],
    columns: [
      { id: 'name', label: 'Имя', locked: true },
      { id: 'ram', label: 'RAM', description: 'Выделенная память' },
      { id: 'ip', label: 'IP-адрес', description: 'Основной адрес' },
      { id: 'actions', label: 'Действия', locked: true },
    ],
    value: initial,
    defaultOrder: initial.order,
    defaultHidden: initial.hidden,
    validateFilter: (rule) => {
      if (!rule.value && !rule.to && !rule.values.length) return 'Укажите значение';
      if (
        rule.operator === 'between' &&
        rule.value &&
        rule.to &&
        Number(rule.value) > Number(rule.to)
      )
        return 'Начало диапазона больше конца';
      return '';
    },
    countResults: () => 3,
    onApply: vi.fn(),
    onClose: vi.fn(),
    ...patch,
  };
}
describe('Shared table tool transactions', () => {
  it('edits grouping as a draft, supports hidden fields, and resets without disturbing other settings', async () => {
    const user = userEvent.setup(),
      config = props('group', { countGroups: () => 2 });
    config.fields.push({ id: 'tags', label: 'Метки', kind: 'text', groupable: false });
    const view = render(<TableToolsPanel {...config} />);
    await user.click(screen.getByRole('combobox', { name: 'Группировать по' }));
    expect(screen.queryByRole('option', { name: 'Метки' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'IP-адрес' }));
    expect(
      screen.getByText('Столбец скрыт. Его значение останется видно в заголовке группы.'),
    ).toBeInTheDocument();
    expect(config.onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(config.onApply).not.toHaveBeenCalled();
    view.unmount();
    const next = render(
      <TableToolsPanel
        {...config}
        value={{ ...initial, grouping: { field: 'ram', direction: 'asc' } }}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Порядок групп' }));
    await user.click(screen.getByRole('option', { name: 'От большего к меньшему' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith({
      ...initial,
      grouping: { field: 'ram', direction: 'desc' },
    });
    next.unmount();
    render(
      <TableToolsPanel
        {...config}
        value={{ ...initial, grouping: { field: 'ram', direction: 'desc' } }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenLastCalledWith({ ...initial, grouping: null });
  });

  it('keeps the description visible even for a locked column', () => {
    const config = props('columns');
    config.columns[0].description = 'Имя внутри проекта.';
    render(<TableToolsPanel {...config} />);
    expect(screen.getByText('Имя внутри проекта.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Имя/ })).toBeDisabled();
  });
  it('edits one column without exposing or discarding other conditions, validates a range and retains both units', async () => {
    const user = userEvent.setup(),
      config = props('filters', { field: 'ram' });
    render(<TableToolsPanel {...config} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Фильтр · RAM');
    expect(screen.queryByRole('combobox', { name: 'Поле' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Значение: Имя')).not.toBeInTheDocument();
    expect(screen.getAllByText('GiB')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled();
    await user.type(screen.getByLabelText('RAM от'), '32');
    await user.type(screen.getByLabelText('RAM до'), '16');
    expect(screen.getByRole('alert')).toHaveTextContent('Начало диапазона больше конца');
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled();
    await user.clear(screen.getByLabelText('RAM до'));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [nameRule, { field: 'ram', operator: 'between', value: '32', to: '', values: [] }],
      }),
    );
    expect(initial.filters).toEqual([nameRule]);
  });
  it('reset in a column filter removes only that column; cancel never commits', async () => {
    const user = userEvent.setup(),
      config = props('filters', { field: 'ram' });
    const view = render(<TableToolsPanel {...config} />);
    await user.type(screen.getByLabelText('RAM от'), '8');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(config.onApply).not.toHaveBeenCalled();
    expect(config.onClose).toHaveBeenCalledOnce();
    view.unmount();
    render(<TableToolsPanel {...config} />);
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith(expect.objectContaining({ filters: [nameRule] }));
  });
  it('searches column descriptions, moves hidden columns, respects fixed edges and preserves filters', async () => {
    const user = userEvent.setup(),
      config = props('columns');
    render(<TableToolsPanel {...config} />);
    expect(screen.getByRole('checkbox', { name: 'Имя' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Действия' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Найти столбец' }), 'адрес');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Переместить влево: IP-адрес' }));
    expect(screen.getByRole('button', { name: 'Переместить влево: IP-адрес' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /IP-адрес/ }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        order: ['name', 'ip', 'ram', 'actions'],
        hidden: new Set(),
        filters: [nameRule],
      }),
    );
    expect(initial.hidden.has('ip')).toBe(true);
  });
  it('chooses an explicit sort field, changes priority, and identifies a hidden sort column', async () => {
    const user = userEvent.setup(),
      config = props('sort');
    render(<TableToolsPanel {...config} />);
    await user.click(screen.getByRole('combobox', { name: 'Добавить уровень' }));
    await user.click(screen.getByRole('option', { name: 'IP-адрес' }));
    expect(screen.getByText('Столбец скрыт, но участвует в сортировке.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повысить приоритет: IP-адрес' }));
    expect(screen.getByRole('combobox', { name: 'Поле сортировки 1' })).toHaveTextContent(
      'IP-адрес',
    );
    await user.click(screen.getByRole('combobox', { name: 'Порядок сортировки 1' }));
    await user.click(screen.getByRole('option', { name: 'По убыванию' }));
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        sorts: [
          { column: 'ip', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      }),
    );
  });
  it('uses typed field controls and keeps multi-select choices in the draft until Apply', async () => {
    const user = userEvent.setup(),
      config = props('filters');
    config.fields.push({
      id: 'status',
      label: 'Состояние',
      kind: 'enum',
      options: [
        { value: 'on', label: 'Работает' },
        { value: 'off', label: 'Выключена' },
      ],
    });
    render(<TableToolsPanel {...config} />);
    await user.click(screen.getByRole('button', { name: 'Состояние' }));
    await user.click(screen.getByRole('combobox', { name: 'Значения: Состояние' }));
    await user.click(screen.getByRole('option', { name: 'Работает' }));
    await user.click(screen.getByRole('option', { name: 'Выключена' }));
    expect(
      within(screen.getByRole('listbox')).getAllByRole('option', { selected: true }),
    ).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    expect(config.onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(config.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          nameRule,
          { field: 'status', operator: 'in', value: '', to: '', values: ['on', 'off'] },
        ],
      }),
    );
  });
});

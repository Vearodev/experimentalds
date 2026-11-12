import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type SortState } from './DataTable';
import { Button } from './Button';
import { tableGroupValue } from './table-grouping';

const rows = [
  { id: 'one', name: 'vm-01' },
  { id: 'two', name: 'vm-02' },
];
function Example({ onChange = () => {} }: { onChange?: (selected: Set<string>) => void }) {
  const [selected, setSelected] = useState(new Set<string>()),
    [sort, setSort] = useState<SortState>();
  return (
    <DataTable
      rows={rows}
      columns={[
        { id: 'name', header: 'Имя', width: 220, sortable: true, render: (row) => row.name },
      ]}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      selected={selected}
      onSelectionChange={(value) => {
        setSelected(value);
        onChange(value);
      }}
      sort={sort}
      onSortChange={setSort}
      caption="Тестовая таблица"
      toolbar={<Button>Фильтры</Button>}
      bulkToolbar={<Button onClick={() => setSelected(new Set())}>Снять выделение</Button>}
    />
  );
}

describe('DataTable composition', () => {
  function PreviewTable({
    onPreview,
    onSelect = vi.fn(),
    onNavigate = vi.fn(),
    selectOnRowClick = false,
  }: {
    onPreview: (row: (typeof rows)[number], origin: HTMLTableRowElement) => void;
    onSelect?: (selected: Set<string>) => void;
    onNavigate?: (row: (typeof rows)[number]) => void;
    selectOnRowClick?: boolean;
  }) {
    return (
      <DataTable
        rows={rows}
        columns={[
          {
            id: 'name',
            header: 'Имя',
            width: 200,
            render: (row) => (
              <a
                href={`#vm/${row.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(row);
                }}
              >
                <span>{row.name}</span>
              </a>
            ),
          },
          { id: 'cpu', header: 'vCPU', width: 120, render: () => <span>8 vCPU</span> },
          {
            id: 'actions',
            header: 'Действия',
            width: 160,
            render: (row) => (
              <>
                <Button aria-label={`Действия ${row.name}`}>Действия</Button>
                <Button disabled aria-label={`Недоступно ${row.name}`}>
                  Удалить
                </Button>
                <input aria-label={`Метка ${row.name}`} />
              </>
            ),
          },
        ]}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        selected={new Set()}
        onSelectionChange={onSelect}
        onRowActivate={onPreview}
        selectOnRowClick={selectOnRowClick}
        toolbar={null}
        bulkToolbar={null}
        caption="Просмотр ресурсов"
      />
    );
  }

  it('opens a row preview without selecting it and leaves links, checkboxes, fields and actions independent', async () => {
    const preview = vi.fn(),
      select = vi.fn(),
      navigate = vi.fn(),
      user = userEvent.setup();
    render(<PreviewTable onPreview={preview} onSelect={select} onNavigate={navigate} />);
    const row = screen.getByRole('link', { name: 'vm-01' }).closest('tr')!;
    await user.click(within(row).getByText('8 vCPU'));
    expect(preview).toHaveBeenCalledExactlyOnceWith(rows[0], row);
    expect(row).toHaveFocus();
    expect(select).not.toHaveBeenCalled();
    preview.mockClear();
    await user.click(screen.getByRole('link', { name: 'vm-01' }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith(rows[0]);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать vm-01' }));
    expect(select).toHaveBeenCalledExactlyOnceWith(new Set(['one']));
    await user.click(screen.getByRole('button', { name: 'Действия vm-01' }));
    await user.click(screen.getByRole('button', { name: 'Недоступно vm-01' }));
    await user.type(screen.getByRole('textbox', { name: 'Метка vm-01' }), 'test');
    expect(preview).not.toHaveBeenCalled();
  });

  it('opens a focused row with Enter or Space without intercepting nested keyboard actions or text selection', async () => {
    const preview = vi.fn(),
      navigate = vi.fn(),
      user = userEvent.setup();
    render(<PreviewTable onPreview={preview} onNavigate={navigate} />);
    const link = screen.getByRole('link', { name: 'vm-01' }),
      row = link.closest('tr')!;
    row.focus();
    expect(row).toHaveAccessibleDescription(/Enter или пробел/);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(preview).toHaveBeenCalledTimes(2);
    preview.mockClear();
    link.focus();
    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledOnce();
    const content = within(row).getByText('8 vCPU');
    const range = document.createRange();
    range.selectNodeContents(content);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(content);
    window.getSelection()!.removeAllRanges();
    fireEvent.click(content, { ctrlKey: true });
    fireEvent.keyDown(row, { key: 'Enter', repeat: true });
    expect(preview).not.toHaveBeenCalled();
  });

  it('preserves row selection behavior for table selects instead of activating a preview', async () => {
    const preview = vi.fn(),
      select = vi.fn(),
      user = userEvent.setup();
    render(<PreviewTable onPreview={preview} onSelect={select} selectOnRowClick />);
    const row = screen.getByRole('link', { name: 'vm-01' }).closest('tr')!;
    await user.click(within(row).getByText('8 vCPU'));
    expect(select).toHaveBeenCalledExactlyOnceWith(new Set(['one']));
    expect(preview).not.toHaveBeenCalled();
    expect(row).not.toHaveAttribute('tabindex');
  });

  it('keeps the grid during loading, distinguishes load errors from an empty result, and retains rows during refresh', () => {
    const props = {
      rows,
      columns: [
        { id: 'name', header: 'Имя', width: 220, render: (r: (typeof rows)[number]) => r.name },
      ],
      getRowId: (r: (typeof rows)[number]) => r.id,
      getRowLabel: (r: (typeof rows)[number]) => r.name,
      selected: new Set(['one']),
      onSelectionChange: vi.fn(),
      onRefresh: vi.fn(),
      toolbar: <Button>Поиск</Button>,
      bulkToolbar: <Button>Массовые действия</Button>,
      caption: 'Ресурсы',
    };
    const view = render(<DataTable {...props} state="loading" />);
    expect(screen.getByRole('region', { name: 'Ресурсы' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('vm-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Ресурсов пока нет')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить данные таблицы' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    view.rerender(<DataTable {...props} state="error" error="Нет соединения" />);
    expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку' })).toBeEnabled();
    view.rerender(<DataTable {...props} state="ready" />);
    const row = screen.getByText('vm-01').closest('tr');
    view.rerender(<DataTable {...props} state="refreshing" />);
    expect(screen.getByText('vm-01').closest('tr')).toBe(row);
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-01' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Обновить данные таблицы' }).closest('[inert]'),
    ).toBeNull();
    view.rerender(<DataTable {...props} rows={[]} selected={new Set()} state="ready" />);
    expect(screen.getByText('Ресурсов пока нет')).toBeInTheDocument();
  });
  it('shows optional description buttons independently of sorting and preserves the full description', async () => {
    const onSort = vi.fn(),
      user = userEvent.setup();
    render(
      <DataTable
        rows={rows}
        columns={[
          {
            id: 'name',
            header: 'Имя',
            width: 220,
            sortable: true,
            description: 'Имя внутри проекта.',
            render: (r) => r.name,
          },
          {
            id: 'id',
            header: 'ID',
            width: 160,
            description: 'Идентификатор ресурса.',
            render: (r) => r.id,
          },
          { id: 'actions', header: 'Действия', width: 96, render: () => '—' },
        ]}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        selected={new Set()}
        onSelectionChange={() => {}}
        onSortChange={onSort}
        toolbar={null}
        bulkToolbar={null}
        caption="Пояснения"
      />,
    );
    expect(screen.getAllByRole('button', { name: /^О поле/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'О поле «Действия»' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'О поле «Имя»' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Имя внутри проекта.');
    expect(screen.getByRole('button', { name: 'О поле «Имя»' })).toHaveAccessibleDescription(
      'Имя внутри проекта.',
    );
    expect(onSort).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сортировать: Имя' }));
    expect(onSort).toHaveBeenCalledWith({ column: 'name', direction: 'asc' }, false);
  });

  it('selects only eligible page rows in a group and preserves selection while groups are collapsed', async () => {
    const changed = vi.fn(),
      user = userEvent.setup();
    function Grouped() {
      const [selected, setSelected] = useState(new Set(['off-page']));
      const groupedRows = [
        { id: 'a1', group: 'A' },
        { id: 'a2', group: 'A' },
        { id: 'blocked', group: 'A' },
        { id: 'b1', group: 'B' },
      ];
      return (
        <DataTable
          rows={groupedRows}
          columns={[{ id: 'id', header: 'ID', width: 200, render: (r) => r.id }]}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.id}
          selected={selected}
          onSelectionChange={(value) => {
            setSelected(value);
            changed(value);
          }}
          isRowSelectable={(r) => r.id !== 'blocked'}
          toolbar={null}
          bulkToolbar={null}
          caption="Группы"
          grouping={{
            id: 'group',
            label: 'Проект',
            direction: 'asc',
            getValue: (r) => tableGroupValue(r.group),
            totalCounts: new Map([
              ['string:A', 5],
              ['string:B', 1],
            ]),
          }}
        />
      );
    }
    render(<Grouped />);
    expect(screen.getByText('На странице: 3 из 5')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать a1' }));
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать группу «A» на странице' }),
    ).toBePartiallyChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать группу «A» на странице' }));
    expect(changed).toHaveBeenLastCalledWith(new Set(['off-page', 'a1', 'a2']));
    await user.click(screen.getByRole('button', { name: 'Свернуть все группы на странице' }));
    expect(screen.queryByRole('checkbox', { name: 'Выбрать a1' })).not.toBeInTheDocument();
    expect(screen.getByText('Выбрано в свёрнутых: 2')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать все строки на странице' }));
    expect(changed).toHaveBeenLastCalledWith(new Set(['off-page', 'a1', 'a2', 'b1']));
    await user.click(screen.getByRole('button', { name: 'Развернуть группу «A»' }));
    expect(screen.getByRole('checkbox', { name: 'Выбрать a2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Выбрать blocked' })).not.toBeChecked();
  });
  it('preserves row nodes and focus when selection changes', async () => {
    render(<Example />);
    const user = userEvent.setup();
    const checkbox = screen.getByRole('checkbox', { name: 'Выбрать vm-01' });
    const row = checkbox.closest('tr');
    await user.click(checkbox);
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-01' }).closest('tr')).toBe(row);
    expect(checkbox).toHaveFocus();
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать все видимые строки' }),
    ).toBePartiallyChecked();
    expect(screen.getByRole('button', { name: 'Снять выделение' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Фильтры' }).closest('[inert]')).not.toBeNull();
  });

  it('selects and clears the visible rows through the header checkbox', async () => {
    const changed = vi.fn();
    render(<Example onChange={changed} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать все видимые строки' }));
    expect(changed).toHaveBeenLastCalledWith(new Set(['one', 'two']));
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать все видимые строки' }));
    expect(changed).toHaveBeenLastCalledWith(new Set());
  });

  it('announces the sort direction on the column header', async () => {
    render(<Example />);
    const user = userEvent.setup();
    const sortButton = screen.getByRole('button', { name: 'Сортировать: Имя' });
    await user.click(sortButton);
    expect(sortButton.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(sortButton);
    expect(sortButton.closest('th')).toHaveAttribute('aria-sort', 'descending');
  });
});

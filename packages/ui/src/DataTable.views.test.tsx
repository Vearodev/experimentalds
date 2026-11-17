import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable, type DataColumn, type DataTableProps, type DataTableView } from './DataTable';
import { Button } from './Button';
import { tableGroupValue } from './table-grouping';

const rows = [
  { id: 'one', name: 'vm-01', group: 'Production', cpu: 8 },
  { id: 'two', name: 'vm-02', group: 'Production', cpu: 4 },
  { id: 'three', name: 'vm-03', group: 'Development', cpu: 2 },
];
type Row = (typeof rows)[number];
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
const columns: DataColumn<Row>[] = [
  {
    id: 'name',
    header: 'Имя',
    width: 200,
    pinned: 'start',
    render: (r) => <a href={`#vm/${r.id}`}>{r.name}</a>,
  },
  {
    id: 'cpu',
    header: 'vCPU',
    width: 160,
    description: 'Выделенные виртуальные процессоры.',
    tile: { emphasis: 'metric' },
    render: (r) => r.cpu,
  },
  { id: 'group', header: 'Проект', width: 160, render: (r) => r.group },
  {
    id: 'actions',
    header: 'Действия',
    width: 48,
    utility: 'actions',
    pinned: 'end',
    render: (r) => <Button aria-label={`Действия ${r.name}`}>Действия</Button>,
  },
];
function Example(props: Partial<DataTableProps<Row>>) {
  const [view, setView] = useState<DataTableView>(props.view ?? 'table');
  const [selected, setSelected] = useState(new Set<string>());
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      getRowLabel={(r) => r.name}
      selected={selected}
      onSelectionChange={setSelected}
      view={view}
      onViewChange={setView}
      caption="Ресурсы"
      toolbar={<Button>Фильтры</Button>}
      bulkToolbar={
        <>
          <span>{selected.size} выбрано</span>
          <Button onClick={() => setSelected(new Set())}>Снять выбор</Button>
        </>
      }
      {...props}
    />
  );
}

describe('Shared table and tile views', () => {
  it('keeps the switch and refresh outside the bulk toolbar and preserves partial selection in both directions', async () => {
    const user = userEvent.setup();
    render(<Example onRefresh={vi.fn()} />);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать vm-01' }));
    const switcher = screen.getByRole('button', { name: 'Представление списка' });
    expect(switcher.closest('[inert]')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Обновить данные таблицы' }).closest('[inert]'),
    ).toBeNull();
    await user.click(switcher);
    expect(screen.getByRole('menuitemradio', { name: 'Таблица' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    expect(switcher).toHaveFocus();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-01' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать все видимые строки' }),
    ).toBePartiallyChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать vm-02' }));
    await user.click(switcher);
    await user.click(screen.getByRole('menuitemradio', { name: 'Таблица' }));
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-02' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать все видимые строки' }),
    ).toBePartiallyChecked();
    expect(screen.getByText('2 выбрано')).toBeVisible();
  });

  it('retains collapsed groups while switching and selects only eligible resources of the current group', async () => {
    const user = userEvent.setup();
    render(
      <Example
        isRowSelectable={(r) => r.id !== 'two'}
        grouping={{
          id: 'group',
          label: 'Проект',
          direction: 'asc',
          getValue: (r) => tableGroupValue(r.group),
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Свернуть группу «Production»' }));
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Плитки' }));
    expect(screen.queryByRole('article', { name: 'vm-01' })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('checkbox', { name: 'Выбрать группу «Production» на странице' }),
    );
    expect(screen.getByText('Выбрано в свёрнутых: 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Развернуть группу «Production»' }));
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-01' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-02' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-03' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Представление списка' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Таблица' }));
    expect(
      screen.getByRole('checkbox', { name: 'Выбрать группу «Production» на странице' }),
    ).toBeChecked();
  });

  it('opens preview from tile space or keyboard, isolates links and controls, and uses the same field descriptions', async () => {
    const user = userEvent.setup(),
      preview = vi.fn();
    render(
      <Example
        view="tiles"
        onRowActivate={preview}
        previewRowId="one"
        rowTone={(r) => (r.id === 'one' ? 'warning' : undefined)}
      />,
    );
    const tile = screen.getByRole('article', { name: 'vm-01' });
    expect(tile).toHaveAttribute('data-preview', 'true');
    expect(tile).toHaveAttribute('data-tone', 'warning');
    await user.click(within(tile).getByText('8'));
    expect(preview).toHaveBeenCalledExactlyOnceWith(rows[0], tile);
    expect(tile).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(preview).toHaveBeenCalledTimes(3);
    preview.mockClear();
    await user.click(within(tile).getByRole('link'));
    await user.click(within(tile).getByRole('checkbox'));
    await user.click(within(tile).getByRole('button', { name: 'Действия vm-01' }));
    await user.click(within(tile).getByLabelText('О поле «vCPU»'));
    expect(screen.getByRole('tooltip')).toHaveTextContent(columns[1].description!);
    expect(preview).not.toHaveBeenCalled();
    fireEvent.click(tile, { ctrlKey: true });
    fireEvent.keyDown(tile, { key: 'Enter', repeat: true });
    expect(preview).not.toHaveBeenCalled();
    expect(tile).toHaveAttribute('data-selected', 'true');
  });

  it('renders only visible fields, in their supplied order, with identity and actions in the header', () => {
    const result = render(
      <Example view="tiles" columns={[columns[0], columns[2], columns[1], columns[3]]} />,
    );
    let tile = screen.getByRole('article', { name: 'vm-01' });
    expect(
      within(tile)
        .getAllByRole('term')
        .map((el) => el.textContent),
    ).toEqual(['Проект', 'vCPU']);
    expect(within(tile).getByRole('button')).toHaveAccessibleName('Действия vm-01');
    result.rerender(<Example view="tiles" columns={[columns[0], columns[1], columns[3]]} />);
    tile = screen.getByRole('article', { name: 'vm-01' });
    expect(within(tile).queryByText('Проект')).not.toBeInTheDocument();
    expect(within(tile).getAllByRole('term')).toHaveLength(1);
  });

  it('shows tile skeletons, load errors and empty data separately, preserving tiles and selection through refresh failures', async () => {
    const user = userEvent.setup(),
      refresh = vi.fn();
    const props: Partial<DataTableProps<Row>> = {
      view: 'tiles',
      selected: new Set(['one']),
      onRefresh: refresh,
    };
    const result = render(<Example {...props} state="loading" />);
    expect(screen.getByRole('region', { name: 'Ресурсы' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      result.container.querySelectorAll('.basis-data-table__tiles .basis-skeleton').length,
    ).toBeGreaterThan(0);
    result.rerender(<Example {...props} state="error" />);
    expect(screen.getByText('Не удалось загрузить данные')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(refresh).toHaveBeenCalledOnce();
    result.rerender(<Example {...props} state="ready" />);
    const tile = screen.getByRole('article', { name: 'vm-01' });
    result.rerender(<Example {...props} state="refreshing" />);
    expect(screen.getByRole('article', { name: 'vm-01' })).toBe(tile);
    result.rerender(<Example {...props} state="stale" />);
    expect(screen.getByRole('article', { name: 'vm-01' })).toBe(tile);
    expect(screen.getByRole('checkbox', { name: 'Выбрать vm-01' })).toBeChecked();
    expect(screen.getByText('Не удалось обновить данные')).toBeVisible();
    result.rerender(<Example {...props} state="ready" rows={[]} />);
    expect(screen.getByText('Ресурсов пока нет')).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { DataTable, type DataColumn } from './DataTable';

const order = vi.fn();
const columns: DataColumn<{ id: string }>[] = [
  { id: 'name', header: 'Имя', width: 200, sortable: true, pinned: 'start', render: (r) => r.id },
  {
    id: 'cpu',
    header: 'vCPU',
    width: 200,
    description: 'Процессоры',
    sortable: true,
    render: () => 4,
  },
  {
    id: 'actions',
    header: 'Действия',
    width: 48,
    utility: 'actions',
    pinned: 'end',
    render: () => null,
  },
];
function Example() {
  const [widths, setWidths] = useState<Record<string, number>>({});
  return (
    <>
      <DataTable
        rows={[{ id: 'one' }]}
        columns={columns}
        columnWidths={widths}
        onColumnWidthsChange={setWidths}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.id}
        selected={new Set()}
        onSelectionChange={() => {}}
        toolbar={null}
        bulkToolbar={null}
        onSortChange={order}
        caption="Ресурсы"
      />
      <output aria-label="Сохранённые размеры">{JSON.stringify(widths)}</output>
    </>
  );
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId: number;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 1;
      }
    },
  );
  order.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
describe('DataTable column sizing', () => {
  it('resizes data columns with the keyboard, protects utilities and restores one column without sorting', () => {
    render(<Example />);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(screen.queryByRole('separator', { name: /Действия|Выбор/ })).not.toBeInTheDocument();
    const name = screen.getByRole('separator', { name: 'Изменить ширину: Имя' });
    fireEvent.keyDown(name, { key: 'ArrowRight' });
    expect(name).toHaveAttribute('aria-valuenow', '216');
    expect(screen.getByRole('separator', { name: 'Изменить ширину: vCPU' })).toHaveAttribute(
      'aria-valuenow',
      '184',
    );
    fireEvent.keyDown(name, { key: 'ArrowRight', shiftKey: true });
    expect(name).toHaveAttribute('aria-valuenow', '280');
    expect(screen.getByRole('separator', { name: 'Изменить ширину: vCPU' })).toHaveAttribute(
      'aria-valuenow',
      '160',
    );
    fireEvent.doubleClick(name);
    expect(name).toHaveAttribute('aria-valuenow', '200');
    expect(order).not.toHaveBeenCalled();
    expect(
      screen.getByRole('columnheader', { name: 'Действия' }).querySelector('[role="separator"]'),
    ).toBeNull();
  });
  it('previews pointer changes, commits on release, respects limits and cancels without persistence', () => {
    render(<Example />);
    const name = screen.getByRole('separator', { name: 'Изменить ширину: Имя' });
    fireEvent.pointerDown(name, { clientX: 200, button: 0, pointerId: 1 });
    fireEvent.pointerMove(name, { clientX: 260, pointerId: 1 });
    expect(name).toHaveAttribute('aria-valuenow', '260');
    expect(screen.getByLabelText('Сохранённые размеры')).toHaveTextContent('{}');
    fireEvent.pointerUp(name, { clientX: 260, pointerId: 1 });
    const saved = screen.getByLabelText('Сохранённые размеры').textContent;
    expect(JSON.parse(saved!)).toEqual({ name: 260, cpu: 160 });
    fireEvent.pointerDown(name, { clientX: 260, button: 0, pointerId: 2 });
    fireEvent.pointerMove(name, { clientX: -1000, pointerId: 2 });
    expect(name).toHaveAttribute('aria-valuenow', '96');
    fireEvent.keyDown(name, { key: 'Escape' });
    expect(name).toHaveAttribute('aria-valuenow', '260');
    expect(screen.getByLabelText('Сохранённые размеры').textContent).toBe(saved);
    fireEvent.pointerDown(name, { clientX: 260, button: 0, pointerId: 3 });
    fireEvent.pointerMove(name, { clientX: 10000, pointerId: 3 });
    expect(name).toHaveAttribute('aria-valuenow', '720');
    fireEvent.pointerCancel(name, { pointerId: 3 });
    expect(name).toHaveAttribute('aria-valuenow', '260');
    expect(order).not.toHaveBeenCalled();
  });
});

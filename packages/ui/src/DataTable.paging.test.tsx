import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import type { DataTablePagination } from './table-paging';

afterEach(() => vi.unstubAllGlobals());
describe('DataTable incremental viewport', () => {
  it('loads at its own viewport edge, pauses during requests/errors, exposes retry and stops at the end', () => {
    const watches: {
      callback: IntersectionObserverCallback;
      root: Element | Document | null | undefined;
      disconnect: ReturnType<typeof vi.fn>;
    }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          watches.push({ callback, root: options?.root, disconnect: this.disconnect });
        }
        observe() {}
      },
    );
    const onLoadMore = vi.fn();
    const pagination: DataTablePagination = {
      mode: 'infinite',
      page: 1,
      pageSize: 12,
      total: 30,
      resetKey: 'A',
      onPageChange: vi.fn(),
      onModeChange: vi.fn(),
      onLoadMore,
    };
    const props = {
      rows: [{ id: 'one' }],
      columns: [{ id: 'name', header: 'Имя', width: 200, render: () => 'vm-01' }],
      getRowId: (row: { id: string }) => row.id,
      getRowLabel: () => 'vm-01',
      selected: new Set<string>(),
      onSelectionChange: vi.fn(),
      toolbar: null,
      bulkToolbar: null,
      caption: 'Ресурсы',
    };
    const result = render(<DataTable {...props} pagination={pagination} />);
    expect(watches).toHaveLength(1);
    expect(watches[0].root).toBe(screen.getByRole('region', { name: 'Ресурсы' }));
    act(() =>
      watches[0].callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(onLoadMore).not.toHaveBeenCalled();
    act(() =>
      watches[0].callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    result.rerender(<DataTable {...props} pagination={{ ...pagination, loadingMore: true }} />);
    expect(watches[0].disconnect).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Загрузить ещё' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    result.rerender(
      <DataTable {...props} pagination={{ ...pagination, loadMoreError: 'Нет связи' }} />,
    );
    expect(watches).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить подгрузку' }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    result.rerender(<DataTable {...props} pagination={{ ...pagination, page: 3 }} />);
    expect(screen.getByText('Все ресурсы загружены · 30')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Загрузить ещё' })).not.toBeInTheDocument();
    expect(watches).toHaveLength(1);
  });
});

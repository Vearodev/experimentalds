import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useIncrementalPages } from './table-paging';

const deferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};
describe('Incremental pages', () => {
  it('deduplicates observer notifications and advances only after a successful response', async () => {
    const request = deferred();
    const loadPage = vi.fn(() => request.promise),
      onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useIncrementalPages({
        mode: 'infinite',
        page: 1,
        pages: 3,
        resetKey: 'A',
        disabled: false,
        loadPage,
        onPageChange,
      }),
    );
    act(() => {
      void result.current.onLoadMore();
      void result.current.onLoadMore();
    });
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(result.current.loadingMore).toBe(true);
    expect(onPageChange).not.toHaveBeenCalled();
    await act(async () => {
      request.resolve();
      await request.promise;
    });
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(result.current.loadingMore).toBe(false);
  });
  it('retains the current page after a failure and allows an explicit retry', async () => {
    const loadPage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Нет связи'))
      .mockResolvedValueOnce({});
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useIncrementalPages({
        mode: 'infinite',
        page: 1,
        pages: 2,
        resetKey: 'A',
        disabled: false,
        loadPage,
        onPageChange,
      }),
    );
    await act(async () => {
      await result.current.onLoadMore();
    });
    expect(result.current.loadMoreError).toBe('Нет связи');
    expect(onPageChange).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.onLoadMore();
    });
    expect(result.current.loadMoreError).toBe('');
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });
  it.each(['query', 'mode', 'refresh', 'unmount'])(
    'ignores a response invalidated by %s',
    async (reason) => {
      const request = deferred(),
        onPageChange = vi.fn();
      const initial = {
        mode: 'infinite' as 'infinite' | 'pages',
        page: 1,
        pages: 2,
        resetKey: 'A',
        disabled: false,
        loadPage: () => request.promise,
        onPageChange,
      };
      const { result, rerender, unmount } = renderHook((props) => useIncrementalPages(props), {
        initialProps: initial,
      });
      act(() => {
        void result.current.onLoadMore();
      });
      if (reason === 'unmount') unmount();
      else
        rerender({
          ...initial,
          ...(reason === 'query'
            ? { resetKey: 'B' }
            : reason === 'mode'
              ? { mode: 'pages' as const }
              : { disabled: true }),
        });
      await act(async () => {
        request.resolve();
        await request.promise;
      });
      expect(onPageChange).not.toHaveBeenCalled();
    },
  );
  it.each([
    { mode: 'pages' as const, page: 1, disabled: false },
    { mode: 'infinite' as const, page: 2, disabled: false },
    { mode: 'infinite' as const, page: 1, disabled: true },
  ])('does not load when unavailable: %o', async (settings) => {
    const loadPage = vi.fn(),
      onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useIncrementalPages({ ...settings, pages: 2, resetKey: 'A', loadPage, onPageChange }),
    );
    await act(async () => {
      await result.current.onLoadMore();
    });
    expect(loadPage).not.toHaveBeenCalled();
  });
});

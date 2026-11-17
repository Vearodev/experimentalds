import { useLayoutEffect, useRef, useState } from 'react';

export type TablePagingMode = 'pages' | 'infinite';
export type TableNavigationPlacement = 'top' | 'bottom' | 'both';
export type DataTablePagination = {
  mode: TablePagingMode;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  placement?: TableNavigationPlacement;
  onPlacementChange?: (placement: TableNavigationPlacement) => void;
  total: number;
  /** Changes when the result set or request generation changes. */
  resetKey: string;
  onModeChange: (mode: TablePagingMode) => void;
  onPageChange: (page: number) => void;
  onLoadMore: () => void;
  loadingMore?: boolean;
  loadMoreError?: string;
};

/** One request per batch; obsolete responses cannot append to a different result set. */
export function useIncrementalPages(options: {
  mode: TablePagingMode;
  page: number;
  pages: number;
  resetKey: string;
  disabled: boolean;
  loadPage: () => Promise<unknown>;
  onPageChange: (page: number) => void;
}) {
  const latest = useRef(options);
  const ticket = useRef(0);
  const pending = useRef(false);
  const [state, setState] = useState({ loadingMore: false, loadMoreError: '' });
  useLayoutEffect(() => {
    latest.current = options;
  });
  useLayoutEffect(() => {
    ticket.current++;
    pending.current = false;
    setState({ loadingMore: false, loadMoreError: '' });
    return () => {
      ticket.current++;
      pending.current = false;
    };
  }, [options.resetKey, options.mode, options.disabled]);
  const onLoadMore = async () => {
    const current = latest.current;
    if (
      pending.current ||
      current.disabled ||
      current.mode !== 'infinite' ||
      current.page >= current.pages
    )
      return;
    pending.current = true;
    const request = ++ticket.current;
    setState({ loadingMore: true, loadMoreError: '' });
    try {
      await current.loadPage();
      if (request !== ticket.current) return;
      current.onPageChange(current.page + 1);
      setState({ loadingMore: false, loadMoreError: '' });
    } catch (error) {
      if (request !== ticket.current) return;
      setState({
        loadingMore: false,
        loadMoreError:
          error instanceof Error ? error.message : 'Не удалось загрузить следующую страницу.',
      });
    } finally {
      if (request === ticket.current) pending.current = false;
    }
  };
  return { ...state, onLoadMore };
}

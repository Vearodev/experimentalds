import { scopeExists, platformState, groupAccountId } from '../platform-model';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastRegion, type StatusTone, type ToastItem } from '@basis/ui';
import { request, ApiError } from './api';
import type { CloudState } from '../domain';
import { CloudContext } from './cloud-state';
export function CloudProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CloudState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(0),
    [scope, updateScope] = useState(() => {
      try {
        return sessionStorage.getItem('basis-cloud-scope') || 'all';
      } catch {
        return 'all';
      }
    }),
    [toasts, setToasts] = useState<ToastItem[]>([]);
  const live = useRef<CloudState | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    try {
      sessionStorage.setItem('basis-cloud-scope', scope);
    } catch {
      /* Optional persistence. */
    }
  }, [scope]);
  const notify = useCallback(
    (title: string, tone: StatusTone = 'success', description?: string) =>
      setToasts((list) => [...list, { id: crypto.randomUUID(), title, tone, description }]),
    [],
  );
  const accept = useCallback((next: CloudState) => {
    if (!mounted.current || (live.current && live.current.updatedAt > next.updatedAt)) return;
    const previous = live.current;
    if (previous && next.profile.notifications)
      for (const task of next.tasks) {
        if (
          task.status !== 'running' &&
          previous.tasks.some((t) => t.id === task.id && t.status === 'running')
        ) {
          setToasts((list) => [
            ...list,
            {
              id: crypto.randomUUID(),
              title: task.status === 'success' ? `${task.name}: готово` : `${task.name}: ошибка`,
              tone: task.status === 'success' ? 'success' : 'danger',
              description: task.status === 'success' ? task.resource : task.error,
              action:
                task.status === 'error'
                  ? {
                      label: 'Открыть журнал',
                      onClick: () => {
                        location.hash = '#cloud/tasks';
                      },
                    }
                  : undefined,
            },
          ]);
        }
      }
    live.current = next;
    setData(next);
    setError('');
    updateScope((current) =>
      !scopeExists(next, current) ||
      (platformState(next).mode !== 'admin' &&
        current !== 'all' &&
        current !== platformState(next).accountId &&
        groupAccountId(next, current) !== platformState(next).accountId)
        ? 'all'
        : current,
    );
  }, []);
  const refresh = useCallback(
    async (skeleton = false) => {
      if (skeleton) setLoading(true);
      try {
        accept((await request('/state')).state);
      } catch (e) {
        if (mounted.current)
          setError(e instanceof Error ? e.message : 'Не удалось получить данные.');
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [accept],
  );
  useEffect(() => {
    mounted.current = true;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (
        !document.hidden ||
        !live.current ||
        live.current.tasks.some((task) => task.status === 'running')
      )
        await refresh();
      if (active)
        timer = setTimeout(
          poll,
          live.current?.tasks.some((t) => t.status === 'running') ? 1100 : 6000,
        );
    };
    void poll();
    return () => {
      mounted.current = false;
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  const loadRegistry = useCallback(async () => {
    const result = await request('/registry');
    accept(result.state);
    return { empty: result.registry?.empty ?? false };
  }, [accept]);
  const mutate = useCallback(
    async (path: string, body?: unknown, message?: string, method = 'POST') => {
      setPending((n) => n + 1);
      try {
        const result = await request(path, method, body);
        accept(result.state);
        if (message)
          notify(
            message,
            result.taskId ? 'info' : 'success',
            result.taskId ? 'Ход операции доступен в журнале задач.' : undefined,
          );
        return result;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) setError(e.message);
        throw e;
      } finally {
        setPending((n) => Math.max(0, n - 1));
      }
    },
    [accept, notify],
  );
  return (
    <CloudContext.Provider
      value={{
        data,
        loading,
        error,
        working: pending > 0,
        scope,
        setScope: updateScope,
        refresh,
        loadRegistry,
        mutate,
        notify,
      }}
    >
      {children}
      <ToastRegion
        items={toasts}
        onDismiss={(id) => setToasts((list) => list.filter((item) => item.id !== id))}
      />
    </CloudContext.Provider>
  );
}

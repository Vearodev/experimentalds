import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataTableState } from '@basis/ui';

export type RegistryLoader = () => Promise<{ empty: boolean }>;

/** Each table owns its request lifecycle. Late responses from a departed view are ignored. */
export function useRegistryData(load?: RegistryLoader, scenario = 'normal') {
  const [state, setState] = useState<DataTableState>(load ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [empty, setEmpty] = useState(false);
  const sequence = useRef(0),
    pending = useRef(false),
    loaded = useRef(false);
  const run = useCallback(
    async (reset = false) => {
      if (!load) return;
      const current = ++sequence.current;
      pending.current = true;
      if (reset) loaded.current = false;
      setState(loaded.current ? 'refreshing' : 'loading');
      setError('');
      try {
        const result = await load();
        if (sequence.current !== current) return;
        loaded.current = true;
        setEmpty(result.empty);
        setState('ready');
      } catch (cause) {
        if (sequence.current !== current) return;
        setError(cause instanceof Error ? cause.message : 'Сервис временно недоступен.');
        setState(loaded.current ? 'stale' : 'error');
      } finally {
        if (sequence.current === current) pending.current = false;
      }
    },
    [load],
  );
  useEffect(() => {
    void run(true);
    return () => {
      sequence.current++;
      pending.current = false;
    };
  }, [run, scenario]);
  return {
    state,
    error,
    empty,
    refresh: load
      ? () => {
          if (!pending.current) void run();
        }
      : undefined,
  };
}

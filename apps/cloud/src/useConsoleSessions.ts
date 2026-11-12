import { useEffect, useReducer, useRef } from 'react';
import type { ConsoleResource } from '@basis/ui';
import { consoleReducer, emptyConsoles } from './console-model';

/** Local demo transport. No commands are evaluated and no secrets enter state or storage. */
export function useConsoleSessions(resources: ConsoleResource[]) {
  const [state, dispatch] = useReducer(consoleReducer, emptyConsoles);
  const pending = useRef(
    new Map<string, { generation: number; timer: ReturnType<typeof setTimeout> }>(),
  );
  const resourceKey = JSON.stringify(resources);
  useEffect(() => {
    dispatch({ type: 'sync', resources });
  }, [resourceKey]);
  useEffect(() => {
    for (const [id, task] of pending.current) {
      const s = state.sessions.find((session) => session.resource.id === id);
      if (!s || s.status !== 'connecting' || s.generation !== task.generation) {
        clearTimeout(task.timer);
        pending.current.delete(id);
      }
    }
    for (const s of state.sessions) {
      if (s.status !== 'connecting' || pending.current.has(s.resource.id)) continue;
      const id = s.resource.id,
        generation = s.generation;
      const timer = setTimeout(() => {
        pending.current.delete(id);
        dispatch({ type: 'status', id, generation, status: 'connected' });
      }, 700);
      pending.current.set(id, { generation, timer });
    }
  }, [state.sessions]);
  useEffect(
    () => () => {
      pending.current.forEach((task) => clearTimeout(task.timer));
      pending.current.clear();
    },
    [],
  );
  return {
    state,
    dispatch,
    open: (resource: ConsoleResource) => dispatch({ type: 'open', resource }),
    props: {
      sessions: state.sessions,
      activeId: state.activeId,
      activation: state.activation,
      resources,
      onSelect: (id: string) => dispatch({ type: 'select', id }),
      onCloseSession: (id: string) => dispatch({ type: 'close', id }),
      onClose: () => dispatch({ type: 'clear' }),
      onOpenResource: (resource: ConsoleResource) => dispatch({ type: 'open', resource }),
      onReorder: (ids: string[]) => dispatch({ type: 'reorder', ids }),
      onCommand: (id: string, command: string) => dispatch({ type: 'command', id, command }),
      onPassword: (id: string, _value: string, enter: boolean) =>
        dispatch({ type: 'password', id, enter }),
      onSignal: (id: string, signal: string) => dispatch({ type: 'signal', id, signal }),
      onReconnect: (id: string) => dispatch({ type: 'reconnect', id }),
      onDisconnect: (id: string) => dispatch({ type: 'status', id, status: 'disconnected' }),
    },
  };
}

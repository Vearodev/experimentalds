import { describe, expect, it } from 'vitest';
import { consoleReducer as reduce, emptyConsoles } from './console-model';
import type { ConsoleResource } from '@basis/ui';
const a: ConsoleResource = {
  id: 'a',
  name: 'api-01',
  project: 'Production',
  host: 'host-01',
  address: '10.0.0.1',
  system: 'Ubuntu',
  cpu: 4,
  memory: 8,
  available: true,
};
const b = { ...a, id: 'b', name: 'db-01' };
const connected = () =>
  reduce(reduce(emptyConsoles, { type: 'open', resource: a }), {
    type: 'status',
    id: 'a',
    status: 'connected',
  });
describe('demo console sessions', () => {
  it('deduplicates machines and keeps each command history when switching', () => {
    let state = reduce(connected(), { type: 'command', id: 'a', command: 'hostname' });
    state = reduce(state, { type: 'open', resource: b });
    state = reduce(state, { type: 'open', resource: a });
    expect(state.sessions).toHaveLength(2);
    expect(state.activeId).toBe('a');
    expect(state.sessions[0].history).toEqual(['hostname']);
    expect(state.sessions[1].history).toEqual([]);
  });
  it('ignores a stale connection result after disconnect or close', () => {
    let state = reduce(emptyConsoles, { type: 'open', resource: a });
    const generation = state.sessions[0].generation;
    state = reduce(state, { type: 'status', id: 'a', status: 'disconnected' });
    state = reduce(state, { type: 'status', id: 'a', status: 'connected', generation });
    expect(state.sessions[0].status).toBe('disconnected');
    state = reduce(state, { type: 'close', id: 'a' });
    state = reduce(state, { type: 'status', id: 'a', status: 'connected', generation });
    expect(state.sessions).toHaveLength(0);
  });
  it('reorders, closes to a neighbour and restores without changing sessions', () => {
    let state = reduce(connected(), { type: 'open', resource: b });
    state = reduce(state, { type: 'reorder', ids: ['b', 'a'] });
    expect(state.sessions.map((s) => s.resource.id)).toEqual(['b', 'a']);
    const before = state.sessions;
    state = reduce(state, { type: 'restore' });
    expect(state.sessions).toBe(before);
    state = reduce(state, { type: 'close', id: 'b' });
    expect(state.activeId).toBe('a');
    expect(reduce(state, { type: 'clear' }).sessions).toEqual([]);
  });
  it('does not run disconnected or stopped commands and reflects resource power changes', () => {
    const state = reduce(connected(), { type: 'sync', resources: [{ ...a, available: false }] });
    expect(state.sessions[0].status).toBe('stopped');
    expect(
      reduce(state, { type: 'command', id: 'a', command: 'hostname' }).sessions[0].history,
    ).toEqual([]);
    expect(reduce(state, { type: 'reconnect', id: 'a' }).sessions[0].status).toBe('stopped');
    expect(reduce(state, { type: 'sync', resources: [] }).sessions[0].status).toBe('error');
    expect(reduce(state, { type: 'sync', resources: [a] }).sessions[0].status).toBe('disconnected');
  });
  it('password transport creates only a fixed acknowledgement, without command history', () => {
    const state = reduce(connected(), { type: 'password', id: 'a', enter: true });
    expect(state.sessions[0].history).toEqual([]);
    expect(state.sessions[0].lines.at(-1)?.text).toContain('Пароль передан в api-01');
  });
  it('bounds output and keeps clear separate from command history', () => {
    let state = connected();
    for (let i = 0; i < 120; i++)
      state = reduce(state, { type: 'command', id: 'a', command: `unknown ${i}` });
    expect(state.sessions[0].lines).toHaveLength(200);
    expect(state.sessions[0].history).toHaveLength(50);
    state = reduce(state, { type: 'command', id: 'a', command: 'clear' });
    expect(state.sessions[0].lines).toEqual([]);
    expect(state.sessions[0].history.at(-1)).toBe('clear');
  });
});

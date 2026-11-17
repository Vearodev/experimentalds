import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  filterPresetKey,
  parseFilterPresets,
  useTableFilterPresets,
  loadDefaultFilterRules,
} from './table-filter-presets';
import type { TableFilterRule } from './TableTools';

const rule: TableFilterRule = {
  field: 'name',
  operator: 'contains',
  value: 'prod',
  to: '',
  values: [],
};
const validate = (r: TableFilterRule) =>
  r.field === 'name' && r.value.trim() ? '' : 'Неверное условие';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('Browser-local filter libraries', () => {
  it('keeps one default per table, restores its rules and restores the default when undoing deletion', () => {
    const hook = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      hook.result.current.save('A', [rule]);
    });
    const a = hook.result.current.items[0].id;
    act(() => {
      hook.result.current.save('B', [{ ...rule, value: 'dev' }]);
    });
    const b = hook.result.current.items[0].id;
    act(() => {
      hook.result.current.setDefault(a);
    });
    expect(loadDefaultFilterRules('vm', validate)).toEqual([rule]);
    expect(loadDefaultFilterRules('disks', validate)).toBeNull();
    act(() => {
      hook.result.current.setDefault(b);
    });
    expect(hook.result.current.defaultId).toBe(b);
    expect(loadDefaultFilterRules('vm', validate)?.[0].value).toBe('dev');
    act(() => hook.result.current.remove(b));
    expect(hook.result.current.defaultId).toBeNull();
    expect(loadDefaultFilterRules('vm', validate)).toBeNull();
    act(() => hook.result.current.undo());
    expect(hook.result.current.defaultId).toBe(b);
    expect(loadDefaultFilterRules('vm', validate)?.[0].value).toBe('dev');
    act(() => {
      hook.result.current.setDefault(null);
    });
    expect(loadDefaultFilterRules('vm', validate)).toBeNull();
  });
  it('never applies an unavailable default as a partial set', () => {
    localStorage.setItem(
      'vm',
      JSON.stringify({
        version: 1,
        defaultId: 'old',
        items: [
          { id: 'old', name: 'Old', updatedAt: 1, rules: [rule, { ...rule, field: 'removed' }] },
        ],
      }),
    );
    expect(loadDefaultFilterRules('vm', validate)).toBeNull();
    const hook = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      expect(hook.result.current.setDefault('old').ok).toBe(false);
    });
    expect(hook.result.current.items).toHaveLength(1);
  });
  it('does not partially restore a malformed set or mix unsupported versions', () => {
    const item = { id: 'one', name: 'Production', rules: [rule], updatedAt: 1 };
    expect(parseFilterPresets('{broken')).toEqual([]);
    expect(parseFilterPresets(JSON.stringify({ version: 2, items: [item] }))).toEqual([]);
    expect(
      parseFilterPresets(
        JSON.stringify({
          version: 1,
          items: [
            item,
            { ...item, id: 'two', name: 'Broken', rules: [rule, { field: 5 }] },
            { ...item, id: 'three', name: 'production' },
          ],
        }),
      ),
    ).toEqual([item]);
  });
  it('matches equivalent sets regardless of rule and enum order or inactive range values', () => {
    const multi: TableFilterRule = {
      ...rule,
      field: 'status',
      operator: 'in',
      values: ['off', 'running'],
    };
    expect(filterPresetKey([rule, multi])).toBe(
      filterPresetKey([
        { ...multi, value: 'stale', values: ['running', 'off'] },
        { ...rule, to: 'unused' },
      ]),
    );
    expect(filterPresetKey([rule])).not.toBe(filterPresetKey([{ ...rule, value: 'dev' }]));
  });
  it('saves copies, rejects duplicate names and restores a separate scope on remount', () => {
    const first = renderHook(() => useTableFilterPresets('vm', validate));
    const input = { ...rule, values: [] };
    act(() => {
      expect(first.result.current.save('  Production  ', [input]).ok).toBe(true);
    });
    input.value = 'changed';
    expect(first.result.current.items[0].rules[0].value).toBe('prod');
    act(() => {
      expect(first.result.current.save('production', [rule]).ok).toBe(false);
    });
    expect(first.result.current.items).toHaveLength(1);
    first.unmount();
    const restored = renderHook(({ key }) => useTableFilterPresets(key, validate), {
      initialProps: { key: 'vm' },
    });
    expect(restored.result.current.items[0].name).toBe('Production');
    restored.rerender({ key: 'disks' });
    expect(restored.result.current.items).toEqual([]);
    restored.rerender({ key: 'vm' });
    expect(restored.result.current.items).toHaveLength(1);
  });
  it('renames, replaces, removes and undoes without mutating applied rule objects', () => {
    const hook = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      hook.result.current.save('Production', [rule]);
    });
    const id = hook.result.current.items[0].id,
      applied = hook.result.current.items[0].rules;
    act(() => {
      hook.result.current.rename(id, 'Рабочие');
    });
    expect(hook.result.current.items[0].name).toBe('Рабочие');
    act(() => {
      hook.result.current.save('Рабочие', [{ ...rule, value: 'dev' }], id);
    });
    expect(applied).toEqual([rule]);
    act(() => hook.result.current.undo());
    expect(hook.result.current.items[0].rules).toEqual([rule]);
    act(() => hook.result.current.remove(id));
    expect(hook.result.current.items).toEqual([]);
    act(() => hook.result.current.undo());
    expect(hook.result.current.items[0]).toMatchObject({ id, name: 'Рабочие', rules: [rule] });
  });
  it('synchronizes same-page instances and browser storage updates without dropping other saves', () => {
    const a = renderHook(() => useTableFilterPresets('vm', validate)),
      b = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      a.result.current.save('A', [rule]);
    });
    expect(b.result.current.items).toHaveLength(1);
    act(() => {
      b.result.current.save('B', [{ ...rule, value: 'dev' }]);
    });
    expect(a.result.current.items).toHaveLength(2);
    act(() => {
      localStorage.setItem(
        'vm',
        JSON.stringify({
          version: 1,
          items: [{ id: 'external', name: 'External', rules: [rule], updatedAt: 3 }],
        }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'vm' }));
    });
    expect(a.result.current.items[0].name).toBe('External');
    expect(b.result.current.items[0].name).toBe('External');
  });
  it('reports a denied write without pretending the new set was persisted', () => {
    const hook = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      hook.result.current.save('A', [rule]);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    act(() => {
      expect(hook.result.current.save('B', [rule]).ok).toBe(false);
    });
    expect(hook.result.current.items).toHaveLength(1);
    expect(hook.result.current.notice?.error).toBe(true);
  });
  it('rejects blank names, blank or invalid rules and an update of a removed set', () => {
    const hook = renderHook(() => useTableFilterPresets('vm', validate));
    act(() => {
      expect(hook.result.current.save(' ', [rule]).ok).toBe(false);
      expect(hook.result.current.save('A', []).ok).toBe(false);
      expect(hook.result.current.save('A', [{ ...rule, value: '' }]).ok).toBe(false);
      expect(hook.result.current.save('A', [rule], 'removed').ok).toBe(false);
    });
    expect(hook.result.current.items).toEqual([]);
  });
});

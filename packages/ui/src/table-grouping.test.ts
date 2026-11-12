import { describe, expect, it } from 'vitest';
import { groupTableRows, tableGroupValue } from './table-grouping';

describe('Table grouping contract', () => {
  it('sorts numeric groups naturally, keeps zero and missing values distinct, and leaves missing values last', () => {
    const rows = [null, 10, 0, 2, undefined, 10];
    expect(groupTableRows(rows, tableGroupValue).map((g) => [g.label, g.rows.length])).toEqual([
      ['0', 1],
      ['2', 1],
      ['10', 2],
      ['Не задано', 2],
    ]);
    expect(groupTableRows(rows, tableGroupValue, 'desc').map((g) => g.label)).toEqual([
      '10',
      '2',
      '0',
      'Не задано',
    ]);
  });

  it('preserves row ordering and separates different source values with identical display labels', () => {
    const rows = [
      { id: 3, project: 'p2' },
      { id: 2, project: 'p1' },
      { id: 1, project: 'p1' },
    ];
    const groups = groupTableRows(rows, (row) => tableGroupValue(row.project, { label: 'Общий' }));
    expect(groups.map((g) => g.rows.map((row) => row.id))).toEqual([[2, 1], [3]]);
    expect(rows.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(tableGroupValue(0).key).not.toBe(tableGroupValue('0').key);
  });

  it('groups timestamps by local calendar day and sends invalid dates to the missing group', () => {
    const values = ['2026-11-12T00:00:00', '2026-11-11T23:59:59', '2026-11-11T00:00:00', 'invalid'];
    const groups = groupTableRows(values, (value) => tableGroupValue(value, { kind: 'date' }));
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([
      ['date:2026-11-11', 2],
      ['date:2026-11-12', 1],
      ['empty:', 1],
    ]);
    expect(tableGroupValue(8, { unit: 'GiB' }).label).toBe('8 GiB');
  });
});

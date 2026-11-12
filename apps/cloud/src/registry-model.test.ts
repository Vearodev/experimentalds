import { describe, expect, it } from 'vitest';
import {
  defaultView,
  newRule,
  queryRows,
  restoreView,
  ruleError,
  type RegistryColumn,
  type Rule,
} from './registry-model';

const rows = [
  {
    id: 'one',
    name: 'prod-a',
    vlan: 9,
    project: 'p1',
    ip: '10.0.0.2',
    created: new Date('2026-11-11T00:00:00').getTime(),
  },
  {
    id: 'two',
    name: 'prod-b',
    vlan: 100,
    project: 'p2',
    ip: '10.0.0.10',
    created: new Date('2026-11-11T23:59:59.999').getTime(),
  },
  {
    id: 'three',
    name: 'dev-a',
    vlan: 200,
    project: 'p1',
    ip: null,
    created: new Date('2026-11-12T00:00:00').getTime(),
  },
];
type Row = (typeof rows)[number];
const columns: RegistryColumn<Row>[] = [
  {
    id: 'name',
    header: 'Имя',
    width: 200,
    pinned: 'start',
    value: (r) => r.name,
    render: (r) => r.name,
  },
  {
    id: 'vlan',
    header: 'VLAN',
    width: 100,
    kind: 'number',
    min: 1,
    max: 4094,
    value: (r) => r.vlan,
    render: (r) => r.vlan,
  },
  {
    id: 'project',
    header: 'Проект',
    width: 160,
    kind: 'enum',
    value: (r) => r.project,
    options: [
      { value: 'p1', label: 'Production' },
      { value: 'p2', label: 'Development' },
    ],
    render: (r) => r.project,
  },
  { id: 'ip', header: 'Адрес', width: 140, kind: 'ip', value: (r) => r.ip, render: (r) => r.ip },
  {
    id: 'created',
    header: 'Создан',
    width: 180,
    kind: 'date',
    hidden: true,
    value: (r) => r.created,
    render: (r) => r.created,
  },
];
const rule = (field: string, patch: Partial<Rule>) => ({
  ...newRule(columns.find((c) => c.id === field)!),
  ...patch,
});
const ids = (result: Row[]) => result.map((r) => r.id);
describe('Registry query contract for every resource type', () => {
  it('migrates older views without grouping and discards unavailable grouping fields', () => {
    const fallback = defaultView(columns);
    expect(restoreView(JSON.stringify({ query: 'prod' }), columns, fallback).grouping).toBeNull();
    for (const grouping of [
      { field: 'missing', direction: 'asc' },
      { field: 'name', direction: 'sideways' },
    ]) {
      expect(restoreView(JSON.stringify({ grouping }), columns, fallback).grouping).toBeNull();
    }
    const restricted = columns.map((c) => ({ ...c, groupable: c.id !== 'name' }));
    expect(
      restoreView(
        JSON.stringify({ grouping: { field: 'name', direction: 'asc' } }),
        restricted,
        fallback,
      ).grouping,
    ).toBeNull();
    expect(
      restoreView(
        JSON.stringify({ grouping: { field: 'created', direction: 'desc' } }),
        columns,
        fallback,
      ).grouping,
    ).toEqual({ field: 'created', direction: 'desc' });
  });
  it('combines a localized relation search, a numeric range and a set exclusion', () => {
    expect(
      ids(
        queryRows(rows, columns, 'prod', [
          rule('vlan', { value: '1', to: '150' }),
          rule('project', { operator: 'notIn', values: ['p2'] }),
        ]),
      ),
    ).toEqual(['one']);
    expect(ids(queryRows(rows, columns, 'Development', []))).toEqual(['two']);
  });
  it('supports open ranges without treating an empty bound as zero', () => {
    expect(ids(queryRows(rows, columns, '', [rule('vlan', { to: '100' })]))).toEqual([
      'one',
      'two',
    ]);
    expect(ids(queryRows(rows, columns, '', [rule('vlan', { value: '100' })]))).toEqual([
      'two',
      'three',
    ]);
  });
  it('rejects empty, reversed, nonfinite and out-of-domain ranges', () => {
    const c = columns[1];
    for (const patch of [
      {},
      { value: '200', to: '100' },
      { value: 'Infinity' },
      { value: '0' },
      { value: '4095' },
    ])
      expect(ruleError(rule('vlan', patch), c)).not.toBe('');
    expect(ruleError(rule('vlan', { value: '120', to: '122' }), c)).toBe('');
  });
  it('treats a calendar date as the whole local day, including its last millisecond', () => {
    expect(ruleError(rule('created', { value: '2026-02-30' }), columns[4])).not.toBe('');
    expect(
      ids(
        queryRows(rows, columns, '', [
          rule('created', { operator: 'equals', value: '2026-11-11' }),
        ]),
      ),
    ).toEqual(['one', 'two']);
    expect(
      ids(
        queryRows(rows, columns, '', [rule('created', { operator: 'between', to: '2026-11-11' })]),
      ),
    ).toEqual(['one', 'two']);
    expect(
      ids(
        queryRows(rows, columns, '', [rule('created', { operator: 'gte', value: '2026-11-12' })]),
      ),
    ).toEqual(['three']);
  });
  it('orders numbers and IPv4 addresses by value and keeps missing values last', () => {
    expect(ids(queryRows(rows, columns, '', [], [{ column: 'vlan', direction: 'asc' }]))).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(ids(queryRows(rows, columns, '', [], [{ column: 'ip', direction: 'desc' }]))).toEqual([
      'two',
      'one',
      'three',
    ]);
  });
  it('sorts relation labels and then the next priority without mutating source rows', () => {
    const result = queryRows(
      rows,
      columns,
      '',
      [],
      [
        { column: 'project', direction: 'asc' },
        { column: 'vlan', direction: 'desc' },
      ],
    );
    expect(ids(result)).toEqual(['two', 'three', 'one']);
    expect(ids(rows)).toEqual(['one', 'two', 'three']);
  });
  it('allows filtering a hidden field and includes exact IP matches only', () => {
    expect(
      ids(queryRows(rows, columns, '', [rule('ip', { operator: 'equals', value: '10.0.0.2' })])),
    ).toEqual(['one']);
    expect(ids(queryRows(rows, columns, '', [rule('created', { value: '2026-11-12' })]))).toEqual([
      'three',
    ]);
  });
  it('recovers safely from obsolete or malformed saved views and retains the identity column', () => {
    const fallback = defaultView(columns);
    expect(restoreView('{broken', columns, fallback)).toEqual(fallback);
    const restored = restoreView(
      JSON.stringify({
        query: 13,
        columns: ['gone', 'vlan', 'vlan'],
        page: -1,
        filters: [{ field: 'gone' }, rule('vlan', { value: 'bad' })],
        sorts: [{ column: 'gone', direction: 'asc' }],
      }),
      columns,
      fallback,
    );
    expect(restored).toEqual({
      query: '',
      columns: ['vlan', 'name'],
      columnOrder: ['name', 'vlan', 'project', 'ip', 'created'],
      page: 1,
      filters: [],
      sorts: [],
      grouping: null,
    });
  });
  it('retains the order of hidden columns across a reload and sanitizes obsolete entries', () => {
    const fallback = defaultView(columns);
    const restored = restoreView(
      JSON.stringify({
        ...fallback,
        columns: ['name', 'project'],
        columnOrder: ['gone', 'name', 'created', 'ip', 'project', 'vlan', 'ip'],
      }),
      columns,
      fallback,
    );
    expect(restored.columnOrder).toEqual(['name', 'created', 'ip', 'project', 'vlan']);
    expect(restored.columns).toEqual(['name', 'project']);
    expect(restoreView(JSON.stringify(restored), columns, fallback)).toEqual(restored);
  });
  it('ignores an inactive range boundary when switching to an exact numeric or date condition', () => {
    expect(
      ruleError(
        rule('vlan', { operator: 'equals', value: '200', to: '100' }),
        columns.find((c) => c.id === 'vlan'),
      ),
    ).toBe('');
    expect(
      ruleError(
        rule('created', { operator: 'equals', value: '2026-11-12', to: '2026-11-11' }),
        columns.find((c) => c.id === 'created'),
      ),
    ).toBe('');
  });
});

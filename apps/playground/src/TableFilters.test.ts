import { expect, it } from 'vitest';
import { activeFilters, filterError, filterMatches, newFilter, sortResources } from './table-model';
const row = {
  name: 'prod-api-01',
  status: 'running',
  project: 'Production',
  cpu: 42,
  ram: 16,
  ip: '10.20.1.14',
};
it('combines fields with AND and selected values with OR', () => {
  expect(
    filterMatches(row, [
      { ...newFilter('name'), value: 'API' },
      { ...newFilter('project'), values: ['Production', 'Staging'] },
      { ...newFilter('status'), values: ['off', 'running'] },
      { ...newFilter('cpu'), value: '40', to: '50' },
    ]),
  ).toBe(true);
  expect(filterMatches(row, [{ ...newFilter('project'), values: ['Staging'] }])).toBe(false);
  expect(filterMatches(row, [{ ...newFilter('ram'), to: '8' }])).toBe(false);
});
it('does not treat absent CPU measurements as zero', () => {
  const stopped = { ...row, status: 'off', cpu: 0 };
  expect(filterMatches(stopped, [])).toBe(true);
  expect(filterMatches(stopped, [{ ...newFilter('cpu'), value: '0' }])).toBe(false);
  expect(
    activeFilters([
      { ...newFilter('cpu'), to: '0' },
      { ...newFilter('ram'), value: '0' },
      newFilter('name'),
    ]),
  ).toEqual(['cpu', 'ram']);
});
it('validates typed operators, ranges, empty values and inclusive boundaries', () => {
  expect(filterError({ ...newFilter('cpu'), value: '90', to: '80' })).toBeTruthy();
  expect(filterError({ ...newFilter('cpu'), value: '101' })).toBeTruthy();
  expect(filterError({ ...newFilter('name'), operator: 'gte', value: '42' })).toBeTruthy();
  expect(filterError(newFilter('status'))).toBeTruthy();
  expect(filterMatches(row, [{ ...newFilter('ram'), operator: 'equals', value: '16' }])).toBe(true);
  expect(
    filterMatches(row, [{ ...newFilter('name'), operator: 'notContains', value: 'API' }]),
  ).toBe(false);
  expect(
    filterMatches(row, [{ ...newFilter('status'), operator: 'notIn', values: ['off', 'error'] }]),
  ).toBe(true);
});
it('sorts by priority, compares IP octets and keeps missing measurements last in either direction', () => {
  const rows = [
    { ...row, name: 'b', cpu: 40, ip: '10.2.0.2' },
    { ...row, name: 'a', cpu: 40, ip: '10.10.0.1' },
    { ...row, name: 'c', status: 'off', cpu: 0 },
  ];
  expect(
    sortResources(rows, [
      { column: 'cpu', direction: 'desc' },
      { column: 'name', direction: 'asc' },
    ]).map((r) => r.name),
  ).toEqual(['a', 'b', 'c']);
  expect(sortResources(rows, [{ column: 'cpu', direction: 'asc' }]).at(-1)?.name).toBe('c');
  expect(
    sortResources(rows.slice(0, 2), [{ column: 'ip', direction: 'asc' }]).map((r) => r.name),
  ).toEqual(['b', 'a']);
});

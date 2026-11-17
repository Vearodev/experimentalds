import { platformState, listPlatformRecords } from '../platform-model';
import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress } from '@basis/ui';
import { seedState } from '../domain';
import { platformEntities, platformEntity } from '../platform-catalog';
import {
  resourceFieldGroups,
  resourceHighlights,
  relatedResourceRows,
  resourceContextFields,
} from './resource-presentation';
import { PlatformValueView, ResourceOverview } from './ResourceDetails';
import { CloudContext, type CloudContextValue } from './cloud-state';
import type { PlatformField, PlatformValue } from '../platform-types';

describe('Resource information hierarchy', () => {
  it('keeps every non-secret domain field exactly once across all entity types', () => {
    for (const entity of platformEntities) {
      const keys = resourceFieldGroups(entity).flatMap((group) => group.fields.map((f) => f.key));
      const expected = entity.fields
        .filter(
          (f) =>
            f.kind !== 'password' &&
            !['description', 'id', 'name', 'status', 'createdAt'].includes(f.key),
        )
        .map((f) => f.key);
      expect([...keys].sort(), entity.id).toEqual([...expected].sort());
      expect(new Set(keys).size, entity.id).toBe(keys.length);
    }
  });
  it('only promotes existing public fields into the summary', () => {
    for (const [id, highlights] of Object.entries(resourceHighlights)) {
      const entity = platformEntity(id)!;
      for (const highlight of highlights) {
        expect(
          entity.fields.find((f) => f.key === highlight.key),
          `${id}.${highlight.key}`,
        ).toBeDefined();
        expect(entity.fields.find((f) => f.key === highlight.key)?.kind).not.toBe('password');
        expect(
          resourceFieldGroups(
            entity,
            highlights.map((h) => h.key),
          )
            .flatMap((g) => g.fields)
            .some((f) => f.key === highlight.key),
        ).toBe(false);
      }
    }
  });
  it('uses one permission-aware relation selection for counts and linked registries', () => {
    const state = seedState(1800000000000);
    const platform = platformState(state);
    const machines = listPlatformRecords(state, 'vms');
    const row = {
      id: 'collection',
      name: 'Collection',
      status: 'READY',
      ids: machines.map((vm) => vm.id),
    };
    const tab = { id: 'machines', label: 'Машины', entity: 'vms', idsField: 'ids' };
    expect(relatedResourceRows(state, row, tab)).toHaveLength(machines.length);
    platform.mode = 'reader';
    platform.accountId = 'account-200';
    const visible = relatedResourceRows(state, row, tab);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((vm) => vm.accountId === 'account-200')).toBe(true);
    expect(visible.length).toBeLessThan(machines.length);
  });
  it('does not describe an SDN traffic policy as storage', () => {
    const groups = resourceFieldGroups(platformEntity('sdn-rules')!);
    expect(
      groups.find((g) => g.id === 'storage')?.fields.some((f) => f.key === 'policyId'),
    ).not.toBe(true);
    expect(groups.flatMap((g) => g.fields).some((f) => f.key === 'policyId')).toBe(true);
  });
  it('separates ownership from technical configuration without losing or duplicating fields', () => {
    for (const entity of platformEntities) {
      const context = resourceContextFields(entity);
      expect(
        context.every((field) => Boolean(field.reference)),
        entity.id,
      ).toBe(true);
      const remaining = resourceFieldGroups(
        entity,
        context.map((field) => field.key),
      );
      const keys = [...context, ...remaining.flatMap((group) => group.fields)].map(
        (field) => field.key,
      );
      const expected = resourceFieldGroups(entity).flatMap((group) =>
        group.fields.map((field) => field.key),
      );
      expect([...keys].sort(), entity.id).toEqual([...expected].sort());
      expect(new Set(keys).size, entity.id).toBe(keys.length);
    }
    expect(
      resourceContextFields(platformEntity('sdn-rules')!).some((field) => field.key === 'policyId'),
    ).toBe(false);
    expect(resourceContextFields(platformEntity('accounts')!)).toEqual([]);
    expect(resourceContextFields(platformEntity('projects')!)).toEqual([]);
  });
});

const state = seedState(1800000000000);
it('renders the seeded detail families with populated sections and valid resource links', () => {
  const context: CloudContextValue = {
    data: state,
    loading: false,
    error: '',
    working: false,
    scope: 'all',
    setScope: () => {},
    refresh: async () => {},
    loadRegistry: async () => ({ empty: false }),
    mutate: async () => ({ state }),
    notify: () => {},
  };
  for (const entity of platformEntities.filter((item) => !item.specialized)) {
    const row = listPlatformRecords(state, entity.id)[0];
    if (!row) continue;
    const html = renderToStaticMarkup(
      <CloudContext.Provider value={context}>
        <ResourceOverview entity={entity} row={row} />
      </CloudContext.Provider>,
    );
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(
      root.querySelector('.resource-detail-main')?.textContent?.trim().length,
      entity.id,
    ).toBeGreaterThan(0);
    for (const section of root.querySelectorAll('.cloud-panel-body')) {
      expect(section.textContent?.trim().length, entity.id).toBeGreaterThan(0);
    }
    for (const link of root.querySelectorAll('a')) {
      expect(link.getAttribute('href'), entity.id).not.toMatch(/undefined|null/);
    }
  }
});
const show = (field: PlatformField, value: PlatformValue | undefined) =>
  renderToStaticMarkup(<PlatformValueView state={state} field={field} value={value} />);
describe('Unambiguous resource values', () => {
  it('distinguishes unset, false and a numeric zero', () => {
    const boolean: PlatformField = {
      key: 'locked',
      label: 'Блокировка',
      description: '',
      kind: 'boolean',
    };
    expect(show(boolean, false)).toContain('Нет');
    expect(show(boolean, undefined)).toContain('Не задано');
    expect(show({ ...boolean, kind: 'number', key: 'freeIps' }, 0)).toContain('>0<');
  });
  it('explains zero I/O limits without changing zero capacity', () => {
    const field: PlatformField = {
      key: 'readIops',
      kind: 'number',
      label: 'IOPS',
      description: '',
    };
    expect(show(field, 0)).toBe('Без ограничения');
    expect(show({ ...field, key: 'size', unit: 'GiB' }, 0)).toContain('>0<');
  });
  it('uses field-specific enum meanings before global status labels', () => {
    const disk = platformEntity('volumes')!;
    expect(
      show(
        disk.fields.find((f) => f.key === 'replication')!,
        'NONE',
      ),
    ).toContain('Выключена');
    expect(
      show(
        disk.fields.find((f) => f.key === 'role')!,
        'BOOT',
      ),
    ).toContain('Загрузочный');
  });
  it('keeps the progress label and value accessible in a metric composition', () => {
    render(<Progress label="Выделено процессоров" value={50} compact hideLabel />);
    expect(screen.getByRole('progressbar', { name: 'Выделено процессоров' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    cleanup();
  });
});

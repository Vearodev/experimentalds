import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MockEngine } from './mock-engine';
import { seedState } from './domain';
import { platformEntities, topLevelEntities } from './platform-catalog';
import {
  listPlatformRecords,
  platformState,
  resourceDependencies,
  scopeContains,
  visiblePlatformRecords,
} from './platform-model';
import { canonicalWorkspaceRoute } from './src/workspace-navigation';

const clock = 1800000000000;
function setup() {
  let now = clock;
  const engine = new MockEngine(seedState(now), () => now);
  return {
    engine,
    finish: () => {
      now += 8000;
      engine.settle();
    },
  };
}
const disk = {
  name: 'qa-data',
  accountId: 'account-100',
  policyId: 'policy-1',
  sepId: 'sep-1',
  size: 128,
  shareable: false,
};

describe('Platform reference and relationships', () => {
  it('maps every advertised create, delete and lifecycle action to a real source API method', () => {
    const source = JSON.parse(readFileSync('design/reference/apiserver-inventory.json', 'utf8'));
    const paths = new Set(source.operations.map((op: { path: string }) => op.path));
    expect(source.operations.length).toBe(1200);
    for (const entity of platformEntities) {
      for (const action of [entity.create, entity.delete].filter(Boolean))
        expect(paths.has(`/restmachine/${entity.api}/${action}`), entity.id).toBe(true);
      for (const action of entity.actions || [])
        expect(paths.has(`/restmachine/${action.api}`), entity.id).toBe(true);
    }
  });
  it('resolves seed references and keeps every entity tab addressable in saved workspaces', () => {
    const { engine } = setup();
    for (const entity of platformEntities) {
      expect(canonicalWorkspaceRoute(entity.id)).toBe(entity.id);
      for (const tab of entity.tabs || [])
        expect(canonicalWorkspaceRoute(`${entity.id}/resource-1/${tab.id}`)).toBe(
          `${entity.id}/resource-1/${tab.id}`,
        );
      for (const row of listPlatformRecords(engine.state, entity.id))
        for (const field of entity.fields) {
          if (field.reference && row[field.key])
            expect(
              listPlatformRecords(engine.state, field.reference).some(
                (parent) => parent.id === row[field.key],
              ),
              `${entity.id}/${row.id} → ${field.reference}/${row[field.key]}`,
            ).toBe(true);
        }
    }
    expect(topLevelEntities.length).toBeGreaterThan(40);
    const rows = (entity: string) => listPlatformRecords(engine.state, entity);
    const find = (entity: string, id: unknown) => rows(entity).find((r) => r.id === id)!;
    for (const vm of rows('vms')) {
      expect(vm.numa).toBe('none');
      expect(vm.cpuPin).toBe(false);
      expect(vm.hugepages).toBe(false);
      expect(find('security-groups', vm.securityGroupId).accountId).toBe(vm.accountId);
      const grid = find('projects', vm.rgId).gridId;
      expect(find('nodes', vm.nodeId).gridId).toBe(grid);
      expect(find('clusters', find('networks', vm.vinsId).zoneId).gridId).toBe(grid);
      expect(find('seps', find('storage-policies', vm.policyId).sepId).gridId).toBe(grid);
    }
  });
  it('upgrades preview metadata without resetting resources or custom settings', () => {
    const { engine } = setup();
    const p = platformState(engine.state);
    p.revision = 1;
    const vm = p.records.vms[0];
    delete vm.numa;
    delete vm.cpuPin;
    vm.numaAffinity = 'strict';
    vm.cpuPinning = true;
    p.records.nodes.find((r) => r.id === 'h4')!.gridId = 'grid-2';
    const before = engine.state.vms.length;
    platformState(engine.state);
    expect(p.revision).toBe(2);
    expect(vm.numa).toBe('strict');
    expect(vm.cpuPin).toBe(true);
    expect(p.records.nodes.find((r) => r.id === 'h4')?.gridId).toBe('grid-1');
    expect(engine.state.vms).toHaveLength(before);
    const upgraded = JSON.stringify(p);
    platformState(engine.state);
    expect(JSON.stringify(p)).toBe(upgraded);
  });
  it('supports account and RG context with the same scope rules, without leaking other accounts', () => {
    const { engine } = setup();
    expect(scopeContains(engine.state, 'account-100', 'prod')).toBe(true);
    expect(scopeContains(engine.state, 'account-100', 'dev')).toBe(false);
    engine.dispatch('POST', '/platform/mode', { mode: 'user' });
    expect(visiblePlatformRecords(engine.state, 'accounts').map((r) => r.id)).toEqual([
      'account-100',
    ]);
    expect(visiblePlatformRecords(engine.state, 'nodes')).toHaveLength(0);
    expect(
      visiblePlatformRecords(engine.state, 'vms').every((r) => r.accountId === 'account-100'),
    ).toBe(true);
    expect(() => engine.dispatch('PATCH', '/vms/vm-11', { description: 'forbidden' })).toThrow();
    engine.dispatch('POST', '/platform/mode', { mode: 'reader' });
    expect(() => engine.dispatch('POST', '/platform/volumes', disk)).toThrow(/просмотр/);
    expect(() =>
      engine.dispatch('POST', '/vms/actions', { ids: ['vm-1'], action: 'snapshot' }),
    ).toThrow(/просмотр/);
  });
});
describe('Platform workflows', () => {
  it('creates an account-owned disk asynchronously, audits it and restores it from the recycle bin', () => {
    const { engine, finish } = setup();
    const result = engine.dispatch('POST', '/platform/volumes', disk);
    expect(listPlatformRecords(engine.state, 'volumes').some((r) => r.id === result.id)).toBe(
      false,
    );
    finish();
    const row = listPlatformRecords(engine.state, 'volumes').find((r) => r.id === result.id)!;
    expect(row).toMatchObject({ accountId: 'account-100', status: 'AVAILABLE', size: 128 });
    expect(listPlatformRecords(engine.state, 'audits').some((r) => r.resourceId === row.id)).toBe(
      true,
    );
    engine.dispatch('DELETE', `/platform/volumes/${row.id}`, {});
    finish();
    expect(engine.state.volumes.some((r) => r.id === row.id)).toBe(false);
    expect(
      listPlatformRecords(engine.state, 'recycle-bin').some((r) => r.originalId === row.id),
    ).toBe(true);
    engine.dispatch('POST', `/platform/volumes/${row.id}/restore`, {});
    finish();
    expect(engine.state.volumes.find((r) => r.id === row.id)?.size).toBe(128);
  });
  it('allows disk attachment across resource groups inside an account, and rejects another account', () => {
    const { engine, finish } = setup();
    const id = engine.dispatch('POST', '/platform/volumes', disk).id!;
    finish();
    const target = engine.state.vms.find((r) => r.projectId === 'dr')!;
    engine.dispatch('POST', `/vms/${target.id}/volumes`, { ids: [id] });
    expect(engine.state.volumes.find((r) => r.id === id)?.vmId).toBe(target.id);
    const otherId = engine.dispatch('POST', '/platform/volumes', {
      ...disk,
      name: 'qa-other',
      accountId: 'account-200',
    }).id!;
    finish();
    expect(() =>
      engine.dispatch('POST', `/vms/${target.id}/volumes`, { ids: [otherId] }),
    ).toThrow();
  });
  it('rejects mixed bulk transitions before scheduling any work and blocks concurrent changes', () => {
    const { engine, finish } = setup();
    const policies = platformState(engine.state).records['storage-policies'];
    policies[1].status = 'DISABLED';
    const count = engine.state.tasks.length;
    expect(() =>
      engine.dispatch('POST', '/platform/storage-policies/actions', {
        ids: [policies[0].id, policies[1].id],
        action: 'disable',
      }),
    ).toThrow(/Состояние/);
    expect(engine.state.tasks).toHaveLength(count);
    policies[1].status = 'ENABLED';
    engine.dispatch('POST', '/platform/storage-policies/actions', {
      ids: [policies[0].id, policies[1].id],
      action: 'disable',
    });
    expect(() =>
      engine.dispatch('PATCH', `/platform/storage-policies/${policies[0].id}`, policies[0]),
    ).toThrow(/выполняется/);
    finish();
    expect(
      platformState(engine.state)
        .records['storage-policies'].slice(0, 2)
        .every((r) => r.status === 'DISABLED'),
    ).toBe(true);
  });
  it('keeps deletion atomic when a dependency appears after a bulk task was queued', () => {
    const { engine, finish } = setup();
    const first = engine.dispatch('POST', '/platform/volumes', disk).id!;
    const second = engine.dispatch('POST', '/platform/volumes', { ...disk, name: 'qa-second' }).id!;
    finish();
    const task = engine.dispatch('POST', '/platform/volumes/actions', {
      ids: [first, second],
      action: 'delete',
    }).taskId;
    platformState(engine.state).records['disk-snapshots'] ||= [];
    platformState(engine.state).records['disk-snapshots'].push({
      id: 'new-snapshot',
      name: 'late snapshot',
      status: 'ENABLED',
      diskId: second,
    });
    finish();
    expect(engine.state.tasks.find((t) => t.id === task)?.status).toBe('error');
    expect(engine.state.volumes.filter((r) => [first, second].includes(r.id))).toHaveLength(2);
  });
  it('protects dependent resources and rechecks references before committing a create', () => {
    const { engine, finish } = setup();
    expect(resourceDependencies(engine.state, 'accounts', 'account-100').length).toBeGreaterThan(0);
    expect(() => engine.dispatch('DELETE', '/platform/accounts/account-100', {})).toThrow(
      /связанные/,
    );
    const task = engine.dispatch('POST', '/platform/volumes', disk);
    platformState(engine.state).records['storage-policies'] = platformState(engine.state).records[
      'storage-policies'
    ].filter((r) => r.id !== 'policy-1');
    finish();
    expect(engine.state.tasks.find((t) => t.id === task.taskId)?.status).toBe('error');
    expect(engine.state.volumes.some((r) => r.id === task.id)).toBe(false);
  });
  it('retries a failed platform task without producing a ghost VM task', () => {
    const { engine, finish } = setup();
    engine.state.simulation.fault = 'task';
    const task = engine.dispatch('POST', '/platform/volumes', disk);
    finish();
    expect(engine.state.tasks.find((t) => t.id === task.taskId)?.status).toBe('error');
    const retry = engine.dispatch('POST', `/tasks/${task.taskId}/retry`, {});
    finish();
    expect(engine.state.tasks.find((t) => t.id === retry.taskId)?.status).toBe('success');
    expect(
      listPlatformRecords(engine.state, 'volumes').filter((r) => r.name === disk.name),
    ).toHaveLength(1);
  });
  it('validates CIDR and port semantics, including IPv6 and a gateway outside the routed destination', () => {
    const { engine, finish } = setup();
    const rule = {
      name: 'https-qa',
      securityGroupId: 'sg-web',
      direction: 'inbound',
      ethertype: 'IPv6',
      protocol: 'tcp',
      portMin: 443,
      portMax: 443,
      cidr: ':::/64',
    };
    expect(() => engine.dispatch('POST', '/platform/security-rules', rule)).toThrow();
    engine.dispatch('POST', '/platform/security-rules', { ...rule, cidr: '2001:db8::/64' });
    finish();
    expect(() =>
      engine.dispatch('POST', '/platform/security-rules', {
        ...rule,
        name: 'invalid-range',
        cidr: '2001:db8::/64',
        portMin: 443,
        portMax: 80,
      }),
    ).toThrow();
    expect(() =>
      engine.dispatch('POST', '/platform/static-routes', {
        name: 'route-qa',
        vinsId: 'net-prod',
        cidr: '10.99.0.0/24',
        gateway: '10.20.0.1',
        metric: 100,
      }),
    ).not.toThrow();
  });
  it('checks Kubernetes configuration limits and creates the initial worker group', () => {
    const { engine, finish } = setup();
    const existing = listPlatformRecords(engine.state, 'kubernetes')[0];
    expect(() =>
      engine.dispatch('POST', '/platform/kubernetes', {
        ...existing,
        name: 'qa-invalid',
        networkPlugin: 'unsupported',
      }),
    ).toThrow();
    const result = engine.dispatch('POST', '/platform/kubernetes', {
      ...existing,
      name: 'qa-k8s',
      workerGroupName: 'workers-qa',
      workerCount: 2,
    });
    finish();
    expect(
      listPlatformRecords(engine.state, 'worker-groups').find((r) => r.clusterId === result.id)
        ?.count,
    ).toBe(2);
    const workers = listPlatformRecords(engine.state, 'worker-groups').find(
      (r) => r.clusterId === result.id,
    )!;
    engine.dispatch('DELETE', `/platform/worker-groups/${workers.id}`, {});
    finish();
    expect(
      listPlatformRecords(engine.state, 'kubernetes').find((r) => r.id === result.id)?.workerCount,
    ).toBe(0);
    engine.dispatch('POST', `/platform/worker-groups/${workers.id}/restore`, {});
    finish();
    expect(
      listPlatformRecords(engine.state, 'kubernetes').find((r) => r.id === result.id)?.workerCount,
    ).toBe(2);
  });
  it('reserves disk quota for pending creates and does not allow reducing quotas below usage', () => {
    const { engine } = setup();
    const account = platformState(engine.state).records.accounts.find(
      (r) => r.id === 'account-300',
    )!;
    account.diskQuota = 100;
    engine.dispatch('POST', '/platform/volumes', { ...disk, accountId: account.id, size: 80 });
    expect(() =>
      engine.dispatch('POST', '/platform/volumes', {
        ...disk,
        name: 'over-quota',
        accountId: account.id,
        size: 80,
      }),
    ).toThrow();
    const prod = listPlatformRecords(engine.state, 'accounts').find((r) => r.id === 'account-100')!;
    expect(() =>
      engine.dispatch('PATCH', '/platform/accounts/account-100', { ...prod, cpuQuota: 1 }),
    ).toThrow();
  });
  it('keeps SDN membership inside its owning account', () => {
    const { engine, finish } = setup();
    const member = {
      name: 'SDN reviewer',
      userId: 'user-3',
      accessGroupId: 'sdn-access-1',
      role: 'R',
    };
    expect(() =>
      engine.dispatch('POST', '/platform/members', { ...member, accountId: 'account-200' }),
    ).toThrow();
    expect(() =>
      engine.dispatch('POST', '/platform/members', { ...member, rgId: 'prod' }),
    ).toThrow();
    const created = engine.dispatch('POST', '/platform/members', member);
    finish();
    expect(
      listPlatformRecords(engine.state, 'members').find((r) => r.id === created.id),
    ).toMatchObject({ accessGroupId: 'sdn-access-1', accountId: 'account-100' });
  });
  it('never persists passwords in records, queued tasks, audits or jobs', () => {
    const { engine, finish } = setup();
    const password = 'demo-secret-never-persist';
    engine.dispatch('POST', '/platform/users', {
      name: 'qa-user',
      email: 'qa@example.invalid',
      provider: 'bvs',
      apiAccessId: 'role-reader',
      password,
    });
    expect(JSON.stringify(engine.state)).not.toContain(password);
    finish();
    expect(JSON.stringify(engine.state)).not.toContain(password);
  });
  it('pauses and resumes a VM while preserving the administrative state', () => {
    const { engine, finish } = setup();
    const vm = engine.state.vms.find((r) => r.status === 'running')!;
    engine.dispatch('POST', `/platform/vms/${vm.id}/pause`, {});
    finish();
    expect(engine.state.vms.find((r) => r.id === vm.id)?.status).toBe('paused');
    expect(
      listPlatformRecords(engine.state, 'vms').find((r) => r.id === vm.id)?.administrativeStatus,
    ).toBe('ENABLED');
    engine.dispatch('POST', `/platform/vms/${vm.id}/resume`, {});
    finish();
    expect(engine.state.vms.find((r) => r.id === vm.id)?.status).toBe('running');
  });
  it('restores a deleted VM with its boot disk and rejects deleting an attached disk', () => {
    const { engine, finish } = setup();
    const vm = engine.state.vms.find((r) => r.status === 'stopped')!;
    const boot = engine.state.volumes.find((r) => r.vmId === vm.id && r.boot)!;
    expect(() => engine.dispatch('DELETE', `/platform/volumes/${boot.id}`, {})).toThrow(
      /связанные/,
    );
    engine.dispatch('POST', '/vms/actions', { ids: [vm.id], action: 'delete', code: '642180' });
    finish();
    expect(engine.state.vms.some((r) => r.id === vm.id)).toBe(false);
    engine.dispatch('POST', `/platform/vms/${vm.id}/restore`, {});
    finish();
    expect(engine.state.vms.find((r) => r.id === vm.id)?.status).toBe('stopped');
    expect(engine.state.volumes.find((r) => r.id === boot.id)?.vmId).toBe(vm.id);
  });
  it('persists disk limits and replica configuration, and validates API permissions', () => {
    const { engine, finish } = setup();
    const id = engine.dispatch('POST', '/platform/volumes', disk).id!;
    finish();
    const row = listPlatformRecords(engine.state, 'volumes').find((r) => r.id === id)!;
    engine.dispatch('PATCH', `/platform/volumes/${id}`, {
      ...row,
      readIops: 5000,
      writeIops: 2000,
      replicaPolicyId: 'policy-3',
    });
    finish();
    expect(listPlatformRecords(engine.state, 'volumes').find((r) => r.id === id)).toMatchObject({
      readIops: 5000,
      writeIops: 2000,
      replication: 'SYNCED',
    });
    expect(() =>
      engine.dispatch('POST', '/platform/api-access/role-owner/permissions', { methods: ['fake'] }),
    ).toThrow();
    const method = 'POST /restmachine/cloudapi/compute/get';
    engine.dispatch('POST', '/platform/api-access/role-owner/permissions', { methods: [method] });
    expect(
      platformState(engine.state).records['api-access'].find((r) => r.id === 'role-owner')
        ?.allowedMethods,
    ).toEqual([method]);
    expect(() =>
      engine.dispatch('POST', '/platform/api-access/role-admin/permissions', { methods: [method] }),
    ).toThrow(/защищ/);
  });
});

import { describe, expect, it } from 'vitest';
import { ApiError, MockEngine } from './mock-engine';
import { inSubnet, seedState, validCidr, validateVm, type VmDraft } from './domain';

const now = 1800000000000;

describe('Registry request simulation', () => {
  it('returns an empty view without deleting resources and keeps background reads independent', () => {
    const engine = new MockEngine(seedState(now));
    const count = engine.state.vms.length;
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'none', table: 'empty' });
    expect(engine.dispatch('GET', '/registry').registry?.empty).toBe(true);
    expect(engine.dispatch('GET', '/state').state.vms).toHaveLength(count);
  });
  it('fails exactly one manual refresh, or keeps initial loads unavailable until the scenario is changed', () => {
    const engine = new MockEngine(seedState(now));
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'read', table: 'normal' });
    expect(() => engine.dispatch('GET', '/state')).not.toThrow();
    expect(() => engine.dispatch('GET', '/registry')).toThrow(
      'Сервис ресурсов временно недоступен',
    );
    expect(engine.dispatch('GET', '/registry').registry?.empty).toBe(false);
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'none', table: 'error' });
    expect(() => engine.dispatch('GET', '/registry')).toThrow();
    expect(() => engine.dispatch('GET', '/registry')).toThrow();
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'none', table: 'normal' });
    expect(() => engine.dispatch('GET', '/registry')).not.toThrow();
  });
});
const draft = (): VmDraft => ({
  name: 'demo-api-01',
  projectId: 'prod',
  hostId: 'h2',
  networkId: 'net-prod',
  template: 'Ubuntu 24.04 LTS',
  cpu: 2,
  memory: 4,
  rootSize: 40,
  dhcp: true,
  ip: '',
  mac: '',
  volumeIds: ['vol-prod-1'],
  tags: ['team:platform'],
  description: 'Демонстрация',
  backup: true,
  start: true,
});
function setup() {
  let time = now;
  const engine = new MockEngine(seedState(now), () => time);
  return {
    engine,
    advance: (ms = 8000) => {
      time += ms;
      engine.settle();
    },
  };
}
describe('Cloud mock API transactions', () => {
  it('creates a VM with related disks, allocates a free address and completes after reload', () => {
    const { engine } = setup(),
      result = engine.dispatch('POST', '/vms', draft()),
      vm = result.state.vms.find((v) => v.id === result.id)!;
    expect(vm.status).toBe('creating');
    expect(inSubnet(vm.ip, '10.20.0.0/24')).toBe(true);
    expect(
      new Set(result.state.vms.filter((v) => v.networkId === vm.networkId).map((v) => v.ip)).size,
    ).toBe(result.state.vms.filter((v) => v.networkId === vm.networkId).length);
    expect(result.state.volumes.filter((v) => v.vmId === vm.id)).toHaveLength(2);
    const restored = new MockEngine(JSON.parse(JSON.stringify(result.state)), () => now + 8000);
    restored.dispatch('GET', '/state');
    expect(restored.state.vms.find((v) => v.id === vm.id)?.status).toBe('running');
    expect(restored.state.tasks.find((t) => t.id === result.taskId)?.status).toBe('success');
  });
  it('validates names, quotas, placement, static addresses and occupied volumes before mutation', () => {
    const { engine } = setup(),
      before = engine.state.vms.length;
    const invalid = {
      ...draft(),
      name: 'prod-api-01',
      cpu: 128,
      hostId: 'h3',
      dhcp: false,
      ip: '10.20.0.11',
      volumeIds: ['vol-vm-1'],
    };
    const errors = validateVm(invalid, engine.state);
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['name', 'cpu', 'hostId', 'ip', 'volumeIds']),
    );
    expect(() => engine.dispatch('POST', '/vms', invalid)).toThrow(ApiError);
    expect(engine.state.vms).toHaveLength(before);
    engine.state.projects[0].cpuQuota = 1;
    expect(validateVm(draft(), engine.state).cpu).toContain('квоте');
  });
  it('rejects a mixed bulk action atomically and locks running operations', () => {
    const { engine, advance } = setup();
    expect(() =>
      engine.dispatch('POST', '/vms/actions', { action: 'start', ids: ['vm-1', 'vm-11'] }),
    ).toThrow();
    expect(engine.state.vms.find((v) => v.id === 'vm-11')?.status).toBe('stopped');
    const result = engine.dispatch('POST', '/vms/actions', { action: 'start', ids: ['vm-11'] });
    expect(() =>
      engine.dispatch('POST', '/vms/actions', { action: 'start', ids: ['vm-11'] }),
    ).toThrow(/выполняется/);
    advance();
    expect(engine.state.tasks.find((t) => t.id === result.taskId)?.status).toBe('success');
  });
  it('consumes one request failure without changing a resource and allows a retry', () => {
    const { engine } = setup();
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'request' });
    expect(() =>
      engine.dispatch('POST', '/volumes', { name: 'extra', projectId: 'prod', size: 100 }),
    ).toThrow(/временно/);
    expect(engine.state.volumes.some((v) => v.name === 'extra')).toBe(false);
    expect(engine.state.simulation.fault).toBe('none');
    expect(
      engine.dispatch('POST', '/volumes', { name: 'extra', projectId: 'prod', size: 100 }).id,
    ).toBeTruthy();
  });
  it('records task errors and creates a new successful retry without duplicating snapshots', () => {
    const { engine, advance } = setup(),
      vm = engine.state.vms[0],
      count = vm.snapshots.length;
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'task' });
    const first = engine.dispatch('POST', '/vms/actions', { action: 'snapshot', ids: [vm.id] });
    advance();
    expect(vm.snapshots).toHaveLength(count);
    expect(vm.status).toBe('running');
    const retried = engine.dispatch('POST', `/tasks/${first.taskId}/retry`);
    advance();
    expect(vm.snapshots).toHaveLength(count + 1);
    expect(engine.state.tasks.find((t) => t.id === first.taskId)?.status).toBe('error');
    expect(engine.state.tasks.find((t) => t.id === retried.taskId)?.status).toBe('success');
    advance();
    expect(vm.snapshots).toHaveLength(count + 1);
  });
  it('protects disks, checks project ownership and leaves data disks after VM deletion', () => {
    const { engine, advance } = setup(),
      vm = engine.state.vms.find((v) => v.id === 'vm-11')!;
    expect(() =>
      engine.dispatch('POST', `/vms/${vm.id}/volumes`, { ids: ['vol-prod-1'] }),
    ).toThrow();
    engine.dispatch('POST', `/vms/${vm.id}/volumes`, { ids: ['vol-dev-1'] });
    expect(() => engine.dispatch('DELETE', '/volumes/vol-dev-1')).toThrow(/отключите/);
    expect(() => engine.dispatch('DELETE', `/vms/${vm.id}/volumes/vol-vm-11`)).toThrow(/Системный/);
    expect(() =>
      engine.dispatch('POST', '/vms/actions', { action: 'delete', ids: [vm.id], code: '000000' }),
    ).toThrow(/код/);
    engine.dispatch('POST', '/vms/actions', { action: 'delete', ids: [vm.id], code: '642180' });
    advance();
    expect(engine.state.vms.some((v) => v.id === vm.id)).toBe(false);
    expect(engine.state.volumes.some((v) => v.id === 'vol-vm-11')).toBe(false);
    expect(engine.state.volumes.find((v) => v.id === 'vol-dev-1')?.vmId).toBeNull();
  });
  it('requires powered off state for resizing and prevents deleting a used network', () => {
    const { engine, advance } = setup();
    expect(() => engine.dispatch('PATCH', '/vms/vm-1', { cpu: 2 })).toThrow(/выключите/);
    engine.dispatch('POST', '/vms/actions', { action: 'stop', ids: ['vm-1'] });
    advance();
    engine.dispatch('PATCH', '/vms/vm-1', { cpu: 2, memory: 4 });
    expect(engine.state.vms[0].cpu).toBe(2);
    expect(() => engine.dispatch('DELETE', '/networks/net-prod')).toThrow(/используется/);
  });
  it('creates an empty project, validates CIDR and supports a full project-to-VM path', () => {
    const { engine } = setup();
    const project = engine.dispatch('POST', '/projects', {
      name: 'Sandbox',
      cpuQuota: 16,
      memoryQuota: 64,
    });
    expect(engine.state.vms.filter((v) => v.projectId === project.id)).toHaveLength(0);
    expect(() =>
      engine.dispatch('POST', '/networks', {
        name: 'private',
        projectId: project.id,
        cidr: '10.50.0.1/24',
        vlan: 300,
      }),
    ).toThrow();
    const network = engine.dispatch('POST', '/networks', {
      name: 'private',
      projectId: project.id,
      cidr: '10.50.0.0/24',
      vlan: 300,
    });
    const vm = engine.dispatch('POST', '/vms', {
      ...draft(),
      projectId: project.id,
      networkId: network.id,
      volumeIds: [],
    });
    expect(vm.state.vms.find((v) => v.id === vm.id)?.ip).toBe('10.50.0.10');
  });
  it('excludes network/broadcast addresses and checks a real network boundary', () => {
    expect(validCidr('10.50.1.0/24')).toBe(true);
    expect(validCidr('10.50.1.4/24')).toBe(false);
    expect(inSubnet('10.50.1.0', '10.50.1.0/24')).toBe(false);
    expect(inSubnet('10.50.1.255', '10.50.1.0/24')).toBe(false);
    expect(inSubnet('10.50.2.1', '10.50.1.0/24')).toBe(false);
    expect(inSubnet('10.50.1.254', '10.50.1.0/24')).toBe(true);
  });
  it('rejects overlapping project subnets but permits an isolated project address space', () => {
    const { engine } = setup();
    expect(() =>
      engine.dispatch('POST', '/networks', {
        name: 'overlap',
        projectId: 'prod',
        cidr: '10.20.0.128/25',
        vlan: 401,
      }),
    ).toThrow(/пересекается/);
    expect(
      engine.dispatch('POST', '/networks', {
        name: 'isolated',
        projectId: 'dev',
        cidr: '10.20.0.128/25',
        vlan: 402,
      }).id,
    ).toBeTruthy();
  });
  it('does not retry an old failed delete after a resource has been started', () => {
    const { engine, advance } = setup();
    engine.dispatch('POST', '/simulation', { latency: 0, fault: 'task' });
    const failed = engine.dispatch('POST', '/vms/actions', {
      action: 'delete',
      ids: ['vm-11'],
      code: '642180',
    });
    advance();
    engine.dispatch('POST', '/vms/actions', { action: 'start', ids: ['vm-11'] });
    advance();
    expect(() => engine.dispatch('POST', `/tasks/${failed.taskId}/retry`)).toThrow(/Состояние/);
    expect(engine.state.vms.find((v) => v.id === 'vm-11')?.status).toBe('running');
  });
});

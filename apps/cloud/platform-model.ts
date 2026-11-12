import apiOperations from './platform-api.json';
import type { CloudState, VM } from './domain';
import { platformEntities, platformEntity } from './platform-catalog';
import { seedPlatform } from './platform-seed';
import type { PlatformRecord, PlatformState } from './platform-types';

export function platformState(state: CloudState): PlatformState {
  if (!state.platform) {
    for (const host of state.hosts) host.name = host.name.replace('-esx-', '-kvm-');
    state.platform = seedPlatform(state);
  }
  if (state.platform.revision === 1) {
    // Upgrade the initial 0.7 preview fixtures without resetting core resources or user actions.
    const corrected = seedPlatform(state).records;
    for (const [entity, keys] of Object.entries({
      nodes: ['gridId'],
      networks: ['zoneId', 'extnetId'],
      seps: ['nodeIds'],
    })) {
      for (const row of state.platform.records[entity] || []) {
        const baseline = corrected[entity]?.find((item) => item.id === row.id);
        if (baseline) for (const key of keys) row[key] = baseline[key];
      }
    }
    for (const vm of state.platform.records.vms || []) {
      const baseline = corrected.vms?.find((item) => item.id === vm.id);
      if (baseline && vm.numaAffinity !== undefined) {
        if (vm.securityGroupId === 'sg-dev' && baseline.securityGroupId === 'sg-web')
          vm.securityGroupId = baseline.securityGroupId;
        if (vm.policyId === 'policy-1' && baseline.policyId === 'policy-3')
          vm.policyId = baseline.policyId;
      }
    }
    for (const disk of state.platform.records.volumes || []) {
      const baseline = corrected.volumes?.find((item) => item.id === disk.id);
      if (disk.iops !== undefined) {
        disk.readIops ??= disk.iops;
        disk.writeIops ??= disk.iops;
        if (baseline?.policyId === 'policy-3' && disk.policyId === 'policy-1') {
          disk.policyId = baseline.policyId;
          disk.sepId = baseline.sepId;
        }
        if (disk.replication === 'SYNCED' && !disk.replicaPolicyId)
          disk.replicaPolicyId = baseline?.replicaPolicyId || null;
      }
    }
    state.platform.revision = 2;
  }
  for (const role of state.platform.records['api-access'] || [])
    if (!Array.isArray(role.allowedMethods)) {
      role.allowedMethods = apiOperations
        .filter(
          (op) =>
            role.id === 'role-admin' ||
            (op.namespace === 'cloudapi' &&
              (role.id === 'role-owner' || /\/(get|list|search)/i.test(op.name))),
        )
        .map((op) => op.id);
      role.permissions = role.allowedMethods.length;
    }
  if (!state.platform.records['sdn-l2-external'])
    state.platform.records['sdn-l2-external'] = seedPlatform(state).records['sdn-l2-external'];
  for (const vm of state.platform.records.vms || []) {
    vm.numa ??= vm.numaAffinity || 'none';
    vm.cpuPin ??= Boolean(vm.cpuPinning);
    vm.hugepages ??= Boolean(vm.hugePages);
  }
  return state.platform;
}
export const groupAccountId = (state: CloudState, id: string) =>
  String(
    platformState(state).records.projects?.find((r) => r.id === id)?.accountId || 'account-100',
  );
export function scopeContains(state: CloudState, scope: string, rgId: string) {
  const p = platformState(state);
  if (p.mode !== 'admin' && groupAccountId(state, rgId) !== p.accountId) return false;
  return scope === 'all' || scope === rgId || scope === groupAccountId(state, rgId);
}
export function scopeLabel(state: CloudState, scope: string) {
  if (scope === 'all')
    return platformState(state).mode === 'admin' ? 'Вся платформа' : 'Все ресурсы аккаунта';
  return (
    state.projects.find((p) => p.id === scope)?.name ||
    platformState(state).records.accounts?.find((r) => r.id === scope)?.name ||
    'Область недоступна'
  );
}
export function scopeExists(state: CloudState, scope: string) {
  if (scope === 'all') return true;
  const account = listPlatformRecords(state, 'accounts').find((r) => r.id === scope);
  const group = listPlatformRecords(state, 'projects').find((r) => r.id === scope);
  return Boolean(
    account
      ? recordVisible(state, 'accounts', account)
      : group && recordVisible(state, 'projects', group),
  );
}
export const vmMetadata = (state: CloudState, id: string) =>
  platformState(state).records.vms?.find((r) => r.id === id);
export const vmAccountId = (state: CloudState, vm: VM) => groupAccountId(state, vm.projectId);
export function listPlatformRecords(state: CloudState, entity: string): PlatformRecord[] {
  const p = platformState(state);
  const extras = (id: string): Partial<PlatformRecord> =>
    p.records[entity]?.find((r) => r.id === id) || {};
  if (entity === 'projects')
    return state.projects.map((r) => ({
      ...extras(r.id),
      ...r,
      status: String(extras(r.id).status || 'ENABLED'),
      accountId: groupAccountId(state, r.id),
      rgId: r.id,
    }));
  if (entity === 'clusters')
    return state.clusters.map((r) => ({
      ...extras(r.id),
      ...r,
      status: String(extras(r.id).status || 'ENABLED'),
      nodeCount: state.hosts.filter((h) => h.clusterId === r.id).length,
    }));
  if (entity === 'nodes')
    return state.hosts.map((r) => ({
      ...extras(r.id),
      ...r,
      status: r.maintenance ? 'MAINTENANCE' : 'ENABLED',
      zoneId: r.clusterId,
    }));
  if (entity === 'vms')
    return state.vms.map((r) => ({
      ...extras(r.id),
      id: r.id,
      name: r.name,
      status:
        (
          { running: 'STARTED', stopped: 'STOPPED', paused: 'PAUSED', error: 'ERROR' } as Record<
            string,
            string
          >
        )[r.status] || 'PROCESSING',
      rgId: r.projectId,
      accountId: vmAccountId(state, r),
      nodeId: r.hostId,
      zoneId: state.hosts.find((h) => h.id === r.hostId)?.clusterId || '',
      vinsId: r.networkId,
      ip: r.ip,
      cpu: r.cpu,
      memory: r.memory,
      description: r.description,
      createdAt: r.createdAt,
    }));
  if (entity === 'volumes')
    return state.volumes.map((r) => ({
      ...extras(r.id),
      id: r.id,
      name: r.name,
      status: r.vmId ? 'ALLOCATED' : 'AVAILABLE',
      accountId: String(extras(r.id).accountId || groupAccountId(state, r.projectId)),
      rgId: r.vmId ? state.vms.find((vm) => vm.id === r.vmId)?.projectId || r.projectId : '',
      size: r.size,
      vmId: r.vmId,
      role: r.boot ? 'BOOT' : 'DATA',
      readIops: Number(extras(r.id).readIops || 0),
      writeIops: Number(extras(r.id).writeIops || 0),
      readBandwidth: Number(extras(r.id).readBandwidth || 0),
      writeBandwidth: Number(extras(r.id).writeBandwidth || 0),
      description: String(extras(r.id).description || ''),
    }));
  if (entity === 'networks')
    return state.networks.map((r) => ({
      ...extras(r.id),
      id: r.id,
      name: r.name,
      status: String(extras(r.id).status || 'ENABLED'),
      rgId: r.projectId,
      accountId: groupAccountId(state, r.projectId),
      cidr: r.cidr,
      vlan: r.vlan,
    }));
  if (entity === 'tasks')
    return state.tasks.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status === 'running' ? 'RUNNING' : r.status === 'success' ? 'SUCCESS' : 'FAILED',
      resource: r.resource,
      startedAt: new Date(r.startedAt).toISOString(),
      progress: r.progress,
      actor: 'anna.sokolova',
      rgId: r.projectId,
      accountId:
        r.platformOperation?.accountId ||
        (r.projectId !== 'all' ? groupAccountId(state, r.projectId) : ''),
      description:
        r.error ||
        (r.status === 'running' ? 'Операция выполняется.' : 'Операция выполнена без ошибок.'),
      operation: r.platformOperation?.action || r.action,
      resourceId: r.vmIds[0] || r.platformOperation?.ids[0] || '',
      entity: r.platformOperation?.entity || 'vms',
    }));
  if (entity === 'recycle-bin')
    return p.removed.map((r) => ({
      ...r.record,
      id: `${r.entity}:${r.record.id}`,
      originalId: r.record.id,
      status: 'DELETED',
      entity: r.entity,
      removedAt: r.removedAt,
    }));
  return (p.records[entity] || []).map((r) => {
    const inherited = resourceAccount(state, entity, r);
    return inherited ? { ...r, accountId: inherited } : r;
  });
}
export function resourceAccount(
  state: CloudState,
  entity: string,
  r: PlatformRecord,
  visited = new Set<string>(),
): string {
  if (entity === 'accounts') return r.id;
  if (typeof r.accountId === 'string' && r.accountId) return r.accountId;
  if (typeof r.rgId === 'string' && r.rgId) return groupAccountId(state, r.rgId);
  const key = `${entity}:${r.id}`;
  if (visited.has(key)) return '';
  visited.add(key);
  const p = platformState(state);
  const parentKeys: Record<string, string> = {
    accessGroupId: 'sdn-access',
    securityGroupId: 'security-groups',
    vinsId: 'networks',
    lbId: 'load-balancers',
    backendId: 'lb-backends',
    clusterId: 'kubernetes',
    serviceId: 'bservices',
    vmId: 'vms',
    diskId: 'volumes',
    portId: 'sdn-ports',
    routerId: 'sdn-routers',
  };
  for (const [field, parentEntity] of Object.entries(parentKeys)) {
    const parentId = r[field];
    if (!parentId) continue;
    if (parentEntity === 'vms') {
      const vm = state.vms.find((v) => v.id === parentId);
      if (vm) return groupAccountId(state, vm.projectId);
    } else if (parentEntity === 'networks') {
      const network = state.networks.find((n) => n.id === parentId);
      if (network) return groupAccountId(state, network.projectId);
    } else {
      const parent = p.records[parentEntity]?.find((v) => v.id === parentId);
      if (parent) return resourceAccount(state, parentEntity, parent, visited);
    }
  }
  if (entity === 'sdn-rules') {
    const policy = p.records['sdn-policies']?.find((v) => v.id === r.policyId);
    if (policy) return resourceAccount(state, 'sdn-policies', policy, visited);
  }
  return '';
}
export function recordVisible(state: CloudState, entity: string, r: PlatformRecord, scope = 'all') {
  const definition = platformEntity(entity),
    p = platformState(state);
  if (definition?.admin && p.mode !== 'admin') return false;
  const accountId = resourceAccount(state, entity, r);
  if (p.mode !== 'admin' && accountId && accountId !== p.accountId) return false;
  if (p.mode !== 'admin' && ['tasks', 'audits', 'recycle-bin'].includes(entity) && !accountId)
    return false;
  if (scope === 'all' || definition?.scope === 'global') return true;
  if (p.records.accounts?.some((account) => account.id === scope))
    return !accountId || accountId === scope;
  if (entity === 'accounts') return r.id === groupAccountId(state, scope);
  if (entity === 'projects') return r.id === scope;
  if (r.rgId) return r.rgId === scope;
  return !accountId || accountId === groupAccountId(state, scope);
}
export const visiblePlatformRecords = (state: CloudState, entity: string, scope = 'all') =>
  listPlatformRecords(state, entity).filter((r) => recordVisible(state, entity, r, scope));
export function relatedRecords(state: CloudState, entity: string, foreignKey: string, id: string) {
  return listPlatformRecords(state, entity).filter((r) => r[foreignKey] === id);
}
export function platformRecordName(state: CloudState, entity: string, id: unknown) {
  return listPlatformRecords(state, entity).find((r) => r.id === id)?.name || String(id || '—');
}
export function canChangePlatform(
  state: CloudState,
  entity: string,
  row?: PlatformRecord,
): string | null {
  const p = platformState(state),
    d = platformEntity(entity);
  if (p.mode === 'reader') return 'Роль «Наблюдатель» разрешает только просмотр.';
  if (row?.protected) return 'Системный ресурс защищён от изменения.';
  if (
    p.mode !== 'admin' &&
    [
      'accounts',
      'storage-policies',
      'images',
      'k8ci',
      'external-networks',
      'trunks',
      'vf-pools',
      'dpdk',
      'clusters',
    ].includes(entity)
  )
    return 'Управление доступно администратору платформы.';
  if (d?.admin && p.mode !== 'admin') return 'Требуются права администратора платформы.';
  if (row && !recordVisible(state, entity, row)) return 'Нет доступа к аккаунту этого ресурса.';
  if (row?.status === 'PROCESSING')
    return 'С ресурсом уже выполняется операция. Дождитесь завершения.';
  return null;
}
export function resourceDependencies(state: CloudState, entity: string, id: string) {
  const links = platformEntities.flatMap((d) => {
    const fields = d.fields.filter((f) => f.reference === entity);
    if (!fields.length) return [];
    return listPlatformRecords(state, d.id)
      .filter((r) => fields.some((f) => r[f.key] === id))
      .map((r) => ({ entity: d.id, label: d.label, record: r }));
  });
  if (entity === 'volumes') {
    const disk = state.volumes.find((r) => r.id === id);
    const vm = listPlatformRecords(state, 'vms').find((r) => r.id === disk?.vmId);
    if (vm) links.push({ entity: 'vms', label: 'Виртуальные машины', record: vm });
  }
  return links;
}
export function platformUsage(state: CloudState, scope = 'all') {
  const vms = state.vms.filter((vm) => scopeContains(state, scope, vm.projectId));
  const groups = visiblePlatformRecords(state, 'projects', scope);
  const accounts = visiblePlatformRecords(state, 'accounts', scope);
  const quotas = state.projects.some((r) => r.id === scope) ? groups : accounts;
  return {
    vms,
    groups,
    cpu: vms.reduce((sum, vm) => sum + vm.cpu, 0),
    memory: vms.reduce((sum, vm) => sum + vm.memory, 0),
    disk: visiblePlatformRecords(state, 'volumes', scope).reduce(
      (sum, r) => sum + Number(r.size || 0),
      0,
    ),
    cpuQuota: quotas.reduce((sum, r) => sum + Number(r.cpuQuota || 0), 0),
    diskQuota: quotas.reduce((sum, r) => sum + Number(r.diskQuota || 0), 0),
    memoryQuota: quotas.reduce((sum, r) => sum + Number(r.memoryQuota || 0), 0),
  };
}

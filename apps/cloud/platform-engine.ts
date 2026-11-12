import apiOperations from './platform-api.json';
import {
  isIPv4,
  inSubnet,
  validateVm,
  type CloudState,
  type Task,
  type VM,
  type Volume,
} from './domain';
import { platformEntity } from './platform-catalog';
import {
  canChangePlatform,
  groupAccountId,
  listPlatformRecords,
  platformRecordName,
  platformState,
  recordVisible,
  resourceDependencies,
  resourceAccount,
  platformUsage,
} from './platform-model';
import type { PlatformRecord } from './platform-types';

export class PlatformError extends Error {
  constructor(
    message: string,
    public status = 422,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
const idFor = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const fail = (message: string, fields: Record<string, string> = {}): never => {
  throw new PlatformError(message, 422, fields);
};
const ipv4Number = (ip: string) =>
  ip.split('.').reduce((n, part) => (n * 256 + Number(part)) >>> 0, 0);
const ipv6CidrValid = (value: string) => {
  const [ip, prefix, extra] = value.split('/');
  if (
    extra !== undefined ||
    !/^\d+$/.test(prefix || '') ||
    Number(prefix) > 128 ||
    ip.includes(':::')
  )
    return false;
  const chunks = ip.split('::');
  if (chunks.length > 2) return false;
  const parts = chunks.flatMap((part) => (part ? part.split(':') : []));
  return (
    parts.every((part) => /^[a-f\d]{1,4}$/i.test(part)) &&
    (chunks.length === 2 ? parts.length < 8 : parts.length === 8)
  );
};
const cidrValid = (value: string) => {
  const [ip, prefix, extra] = value.split('/');
  return (
    !extra &&
    isIPv4(ip) &&
    /^\d+$/.test(prefix || '') &&
    Number(prefix) >= 0 &&
    Number(prefix) <= 32
  );
};
function lookup(state: CloudState, entity: string, id: unknown) {
  return listPlatformRecords(state, entity).find((row) => row.id === id);
}
export function validatePlatformRecord(
  state: CloudState,
  entity: string,
  input: Record<string, unknown>,
  existing?: PlatformRecord,
) {
  const definition = platformEntity(entity);
  if (!definition) throw new PlatformError('Раздел не найден.', 404);
  const errors: Record<string, string> = {};
  const name = String(input.name || '').trim();
  if (!name || name.length > 80) errors.name = 'Укажите имя длиной от 1 до 80 символов.';
  const result: PlatformRecord = {
    ...(existing || {}),
    id: existing?.id || idFor(entity),
    name,
    status:
      existing?.status ||
      (['kubernetes', 'bservices', 'load-balancers'].includes(entity)
        ? 'STARTED'
        : entity === 'accounts'
          ? 'CONFIRMED'
          : 'ENABLED'),
  };
  for (const field of definition.fields) {
    if (field.form === false || field.readonly || field.kind === 'date') continue;
    const value = input[field.key];
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && !value.length);
    if (empty) {
      if (field.required && !(field.kind === 'password' && existing))
        errors[field.key] = 'Обязательное поле.';
      else result[field.key] = field.kind === 'tags' ? [] : field.kind === 'boolean' ? false : null;
      continue;
    }
    if (field.kind === 'number') {
      const number = Number(value);
      if (
        !Number.isFinite(number) ||
        !Number.isInteger(number) ||
        number < (field.min ?? 0) ||
        number > (field.max ?? 1_000_000)
      )
        errors[field.key] = `Целое число от ${field.min ?? 0} до ${field.max ?? 1_000_000}.`;
      result[field.key] = number;
    } else if (field.kind === 'boolean') result[field.key] = Boolean(value);
    else if (field.kind === 'tags')
      result[field.key] = Array.isArray(value) ? value.map(String) : [];
    else if (field.kind === 'password') {
      if (String(value).length < 12) errors[field.key] = 'Не менее 12 символов.';
      // Demonstration credentials are never retained in state, audit or task payloads.
    } else {
      result[field.key] = String(value).trim();
      if (field.kind === 'ip' && !isIPv4(String(value)))
        errors[field.key] = 'Введите корректный IPv4-адрес.';
      if (field.kind === 'enum' && !field.options?.some((option) => option.value === value))
        errors[field.key] = 'Выберите значение из списка.';
      if (field.reference) {
        const linked = lookup(state, field.reference, value);
        if (!linked || !recordVisible(state, field.reference, linked))
          errors[field.key] = 'Ресурс недоступен. Выберите другое значение.';
        else if (
          ['DISABLED', 'BLOCKED', 'MAINTENANCE', 'DELETED'].includes(linked.status) &&
          existing?.[field.key] !== value
        )
          errors[field.key] = 'Ресурс сейчас недоступен для новых подключений.';
      }
    }
  }
  if (
    result.cidr &&
    !(result.ethertype === 'IPv6'
      ? ipv6CidrValid(String(result.cidr)) && Number(String(result.cidr).split('/')[1]) <= 128
      : cidrValid(String(result.cidr)))
  )
    errors.cidr = 'Укажите корректную подсеть в формате CIDR.';
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(result.email)))
    errors.email = 'Проверьте адрес электронной почты.';
  if (result.url) {
    try {
      if (!['http:', 'https:'].includes(new URL(String(result.url)).protocol))
        errors.url = 'Используйте HTTP или HTTPS.';
    } catch {
      errors.url = 'Введите полный URL образа.';
    }
  }
  if (result.mac && !/^([\da-f]{2}:){5}[\da-f]{2}$/i.test(String(result.mac)))
    errors.mac = 'Формат: 52:54:00:00:00:01.';
  if (result.portMin && result.portMax && Number(result.portMax) < Number(result.portMin))
    errors.portMax = 'Конец диапазона не может быть меньше начала.';
  if (
    entity === 'security-rules' &&
    ['tcp', 'udp'].includes(String(result.protocol)) &&
    (!result.portMin || !result.portMax)
  )
    errors.portMin = 'Укажите диапазон портов для TCP или UDP.';
  if (
    result.startIp &&
    result.endIp &&
    ipv4Number(String(result.startIp)) > ipv4Number(String(result.endIp))
  )
    errors.endIp = 'Последний адрес должен быть не меньше первого.';
  if (
    result.cidr &&
    cidrValid(String(result.cidr)) &&
    result.ethertype !== 'IPv6' &&
    ['external-networks', 'sdn-external', 'sdn-address-pools'].includes(entity)
  ) {
    for (const key of ['gateway', 'startIp', 'endIp'])
      if (result[key] && !inSubnet(String(result[key]), String(result.cidr)))
        errors[key] = 'Адрес должен принадлежать указанной подсети и не быть служебным.';
  }
  if (entity === 'accounts' && platformState(state).mode !== 'admin')
    throw new PlatformError('Управлять аккаунтами может администратор платформы.', 403);
  const owner =
    result.accountId || (result.rgId ? groupAccountId(state, String(result.rgId)) : undefined);
  if (owner && platformState(state).mode !== 'admin' && owner !== platformState(state).accountId)
    throw new PlatformError('Нет доступа к выбранному аккаунту.', 403);
  if (
    result.rgId &&
    result.vinsId &&
    lookup(state, 'networks', result.vinsId)?.rgId !== result.rgId
  )
    errors.vinsId = 'Сеть должна находиться в выбранной ресурсной группе.';
  if (result.securityGroupId && result.vmId) {
    const group = lookup(state, 'security-groups', result.securityGroupId),
      vm = lookup(state, 'vms', result.vmId);
    if (group?.accountId !== vm?.accountId)
      errors.vmId = 'Машина и группа безопасности должны принадлежать одному аккаунту.';
  }
  if (entity.startsWith('sdn-') && result.accessGroupId) {
    for (const field of definition.fields.filter(
      (field) => field.reference && field.key !== 'accessGroupId',
    )) {
      const linked = lookup(state, field.reference!, result[field.key]);
      if (linked?.accessGroupId && linked.accessGroupId !== result.accessGroupId)
        errors[field.key] = 'Ресурс должен принадлежать той же группе доступа SDN.';
    }
  }
  if (entity === 'kubernetes') {
    const config = lookup(state, 'k8ci', result.k8ciId);
    if (
      config &&
      Array.isArray(config.plugins) &&
      !config.plugins.includes(String(result.networkPlugin))
    )
      errors.networkPlugin = 'Плагин не поддерживается выбранной конфигурацией.';
    if (Number(result.masterCount) > Number(config?.maxMasters))
      errors.masterCount = 'Превышен лимит конфигурации Kubernetes.';
    if (Number(result.workerCount) > Number(config?.maxWorkers))
      errors.workerCount = 'Превышен лимит конфигурации Kubernetes.';
  }
  if (entity === 'worker-groups') {
    const cluster = lookup(state, 'kubernetes', result.clusterId),
      config = lookup(state, 'k8ci', cluster?.k8ciId);
    const existingNodes = listPlatformRecords(state, entity)
      .filter((r) => r.clusterId === result.clusterId && r.id !== existing?.id)
      .reduce((sum, r) => sum + Number(r.count), 0);
    if (existingNodes + Number(result.count) > Number(config?.maxWorkers || 100))
      errors.count = 'Общее число рабочих узлов превышает лимит конфигурации.';
  }
  if (entity === 'projects') {
    const parent = lookup(state, 'accounts', result.accountId);
    for (const field of ['cpuQuota', 'memoryQuota', 'diskQuota'])
      if (Number(result[field]) > Number(parent?.[field] || 0))
        errors[field] = 'Лимит группы не может превышать квоту аккаунта.';
  }
  if (
    result.accountId &&
    result.rgId &&
    groupAccountId(state, String(result.rgId)) !== result.accountId
  )
    errors.rgId = 'Ресурсная группа принадлежит другому аккаунту.';
  if (result.policyId && !entity.startsWith('sdn-')) {
    const selectedPolicy = lookup(state, 'storage-policies', result.policyId);
    if (result.sepId && selectedPolicy?.sepId !== result.sepId)
      errors.sepId = 'Хранилище должно соответствовать политике хранения.';
  }
  if (
    entity === 'networks' &&
    result.cidr &&
    (!cidrValid(String(result.cidr)) ||
      Number(String(result.cidr).split('/')[1]) > 30 ||
      Number(String(result.cidr).split('/')[1]) < 16)
  )
    errors.cidr = 'Для сети ViNS укажите IPv4-подсеть с маской от /16 до /30.';
  if (entity === 'volumes') {
    if (existing && Number(result.size) < Number(existing.size))
      errors.size = 'Уменьшение диска недоступно.';
    const ownerAccount = lookup(state, 'accounts', result.accountId);
    const used = listPlatformRecords(state, 'volumes')
      .filter((r) => r.id !== existing?.id && r.accountId === result.accountId)
      .reduce((sum, r) => sum + Number(r.size), 0);
    const queued = state.tasks
      .filter(
        (t) =>
          t.status === 'running' &&
          t.platformOperation?.entity === 'volumes' &&
          t.platformOperation.action === 'create',
      )
      .flatMap((t) => t.platformOperation!.records)
      .filter((r) => r.accountId === result.accountId)
      .reduce((sum, r) => sum + Number(r.size), 0);
    if (used + queued + Number(result.size) > Number(ownerAccount?.diskQuota || 0))
      errors.size = 'Недостаточно квоты дисков аккаунта.';
  }
  if (existing && ['accounts', 'projects'].includes(entity)) {
    const usage = platformUsage(state, existing.id);
    for (const [field, used] of Object.entries({
      cpuQuota: usage.cpu,
      memoryQuota: usage.memory,
      diskQuota: usage.disk,
    }))
      if (Number(result[field]) < used)
        errors[field] = 'Квота не может быть меньше уже выделенных ресурсов.';
    if (
      entity === 'projects' &&
      existing.accountId !== result.accountId &&
      resourceDependencies(state, 'projects', existing.id).length
    )
      errors.accountId = 'Сначала перенесите связанные ресурсы группы.';
  }
  if (entity === 'members') {
    if (!result.accountId && !result.rgId && !result.accessGroupId)
      errors.accountId = 'Выберите аккаунт, ресурсную группу или группу доступа SDN.';
    if (result.accessGroupId) {
      const group = lookup(state, 'sdn-access', result.accessGroupId);
      if (result.accountId && group?.accountId !== result.accountId)
        errors.accountId = 'Группа SDN принадлежит другому аккаунту.';
      if (result.rgId) errors.rgId = 'Выберите один контекст доступа: ресурсную группу или SDN.';
      result.accountId = group?.accountId || null;
    }
  }
  if (entity === 'volumes' && result.replicaPolicyId && result.replicaPolicyId === result.policyId)
    errors.replicaPolicyId = 'Выберите отдельную политику для реплики.';
  if (entity === 'vms' && existing) {
    const vm = state.vms.find((r) => r.id === existing.id)!;
    if (
      vm.status !== 'stopped' &&
      ['chipset', 'numa', 'cpuPin', 'hugepages'].some((key) => result[key] !== existing[key])
    )
      errors.chipset = 'Для изменения аппаратной конфигурации выключите машину.';
    const host = state.hosts.find((r) => r.id === result.nodeId);
    if (!host || host.maintenance) errors.nodeId = 'Выберите доступный узел.';
    if (host) {
      const resident = state.vms.filter((r) => r.hostId === host.id && r.id !== vm.id);
      if (
        resident.reduce((sum, r) => sum + r.cpu, 0) + vm.cpu > host.cpu ||
        resident.reduce((sum, r) => sum + r.memory, 0) + vm.memory > host.memory
      )
        errors.nodeId = 'На узле недостаточно свободной ёмкости.';
    }
    if (
      result.securityGroupId &&
      lookup(state, 'security-groups', result.securityGroupId)?.accountId !==
        groupAccountId(state, vm.projectId)
    )
      errors.securityGroupId = 'Выберите группу безопасности аккаунта машины.';
  }
  const duplicate = listPlatformRecords(state, entity).some(
    (row) =>
      row.id !== existing?.id &&
      row.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
      (!owner || resourceAccount(state, entity, row) === owner),
  );
  if (duplicate) errors.name = 'Такое имя уже используется в этой области.';
  if (Object.keys(errors).length)
    throw new PlatformError('Проверьте параметры формы.', 422, errors);
  result.createdAt ||= new Date().toISOString();
  return result;
}

export function writePlatformRecord(state: CloudState, entity: string, record: PlatformRecord) {
  const p = platformState(state),
    list = (p.records[entity] ||= []);
  const index = list.findIndex((r) => r.id === record.id);
  if (index >= 0) list[index] = { ...list[index], ...record };
  else list.push(record);
  const upsert = <T extends { id: string }>(rows: T[], value: T) => {
    const i = rows.findIndex((r) => r.id === value.id);
    if (i >= 0) rows[i] = { ...rows[i], ...value };
    else rows.push(value);
  };
  if (entity === 'vms') {
    const vm = state.vms.find((r) => r.id === record.id);
    if (vm) {
      vm.name = record.name;
      if (record.nodeId) vm.hostId = String(record.nodeId);
    }
  }
  if (entity === 'projects')
    upsert(state.projects, {
      id: record.id,
      name: record.name,
      description: String(record.description || ''),
      environment: 'custom',
      cpuQuota: Number(record.cpuQuota),
      memoryQuota: Number(record.memoryQuota),
      members: [],
    });
  if (entity === 'clusters')
    upsert(state.clusters, {
      id: record.id,
      name: record.name,
      description: String(record.description || ''),
      region: platformRecordName(state, 'locations', record.gridId),
    });
  if (entity === 'nodes') {
    const host = state.hosts.find((h) => h.id === record.id);
    if (host) {
      host.maintenance = record.status === 'MAINTENANCE';
      host.name = record.name;
    }
  }
  if (entity === 'networks')
    upsert(state.networks, {
      id: record.id,
      name: record.name,
      projectId: String(record.rgId),
      cidr: String(record.cidr),
      vlan: Number(record.vlan || 0),
    });
  if (entity === 'volumes') {
    const group = String(
      record.rgId ||
        state.projects.find((g) => groupAccountId(state, g.id) === record.accountId)?.id ||
        '',
    );
    upsert(state.volumes, {
      id: record.id,
      name: record.name,
      projectId: group,
      size: Number(record.size),
      tier: 'ssd',
      vmId: record.vmId ? String(record.vmId) : null,
      boot: record.role === 'BOOT',
    });
  }
  if (entity === 'worker-groups') {
    const cluster = p.records.kubernetes?.find((r) => r.id === record.clusterId);
    if (cluster)
      cluster.workerCount = list
        .filter((r) => r.clusterId === cluster.id)
        .reduce((sum, r) => sum + Number(r.count), 0);
  }
}
function removeRecord(state: CloudState, entity: string, row: PlatformRecord, now: number) {
  const p = platformState(state);
  const core: Record<string, keyof CloudState> = {
    projects: 'projects',
    clusters: 'clusters',
    nodes: 'hosts',
    networks: 'networks',
    volumes: 'volumes',
    vms: 'vms',
  };
  const key = core[entity];
  const data = key ? (state[key] as { id: string }[]).find((r) => r.id === row.id) : undefined;
  p.removed.unshift({
    entity,
    record: row,
    data: data ? structuredClone(data) : undefined,
    removedAt: new Date(now).toISOString(),
  });
  p.records[entity] = (p.records[entity] || []).filter((r) => r.id !== row.id);
  if (entity === 'worker-groups') {
    const cluster = p.records.kubernetes?.find((r) => r.id === row.clusterId);
    if (cluster)
      cluster.workerCount = p.records[entity]
        .filter((r) => r.clusterId === cluster.id)
        .reduce((sum, r) => sum + Number(r.count), 0);
  }
  if (key)
    (state as unknown as Record<string, unknown>)[key] = (state[key] as { id: string }[]).filter(
      (r) => r.id !== row.id,
    );
}
export function recordAudit(
  state: CloudState,
  entity: string,
  record: PlatformRecord,
  operation: string,
  now: number,
  success = true,
) {
  const audits = (platformState(state).records.audits ||= []);
  audits.unshift({
    id: idFor('audit'),
    name: operation,
    status: success ? 'SUCCESS' : 'FAILED',
    actor: platformState(state).mode === 'admin' ? 'anna.sokolova' : 'mikhail.petrov',
    operation,
    resource: record.name,
    resourceId: record.id,
    entity,
    accountId: String(
      record.accountId || (record.rgId ? groupAccountId(state, String(record.rgId)) : ''),
    ),
    rgId: record.rgId || '',
    createdAt: new Date(now).toISOString(),
    responseCode: success ? 200 : 409,
  });
  if (audits.length > 300) audits.length = 300;
}
export function finishPlatformTask(state: CloudState, task: Task, now: number) {
  const op = task.platformOperation!;
  if (task.fail) {
    for (const row of op.records)
      recordAudit(
        state,
        op.entity,
        row,
        `${platformEntity(op.entity)?.api}/${op.action}`,
        now,
        false,
      );
    return;
  }
  for (const row of op.records) {
    if (op.action === 'delete' && resourceDependencies(state, op.entity, row.id).length)
      throw new PlatformError('У ресурса появились зависимости. Удаление отменено.', 409);
    if (['create', 'update', 'restore'].includes(op.action))
      for (const field of platformEntity(op.entity)?.fields || [])
        if (field.reference && row[field.key] && !lookup(state, field.reference, row[field.key]))
          throw new PlatformError('Связанный ресурс удалён. Проверьте параметры.', 409);
    if (!['create', 'restore'].includes(op.action) && !lookup(state, op.entity, row.id))
      throw new PlatformError('Ресурс больше не существует.', 409);
  }
  if (op.action === 'restore' && op.entity === 'vms') {
    for (const row of op.records) {
      const archived = platformState(state).removed.find(
        (r) => r.entity === 'vms' && r.record.id === row.id,
      )?.data as { vm?: VM };
      if (archived?.vm) {
        const errors = validateVm({ ...archived.vm, start: false, volumeIds: [] }, state);
        if (Object.keys(errors).length)
          throw new PlatformError('Восстановление невозможно: ' + Object.values(errors)[0], 409);
      }
    }
  }
  if (op.action === 'create' || op.action === 'update') {
    for (const row of op.records) {
      // References are checked again because another queued operation may have removed a dependency.
      for (const field of platformEntity(op.entity)?.fields || [])
        if (field.reference && row[field.key] && !lookup(state, field.reference, row[field.key]))
          throw new PlatformError(
            'Связанный ресурс изменился или был удалён. Проверьте параметры и повторите операцию.',
            409,
          );
      if (op.entity === 'volumes') row.replication = row.replicaPolicyId ? 'SYNCED' : 'NONE';
      writePlatformRecord(state, op.entity, row);
      if (op.entity === 'kubernetes' && op.action === 'create')
        writePlatformRecord(state, 'worker-groups', {
          id: idFor('workers'),
          name: String(row.workerGroupName),
          status: 'ENABLED',
          clusterId: row.id,
          count: Number(row.workerCount),
          cpu: 4,
          memory: 8,
          disk: 80,
          labels: [],
        });
    }
  } else if (op.action === 'delete') {
    for (const row of op.records) {
      if (resourceDependencies(state, op.entity, row.id).length)
        throw new PlatformError('У ресурса появились зависимости. Удаление отменено.', 409);
      removeRecord(state, op.entity, row, now);
    }
  } else if (op.action === 'restore') {
    for (const row of op.records) {
      const archived = platformState(state).removed.find(
        (r) => r.entity === op.entity && r.record.id === row.id,
      );
      if (!archived) throw new PlatformError('Ресурс уже восстановлен или удалён.', 409);
      const key = (
        {
          projects: 'projects',
          clusters: 'clusters',
          nodes: 'hosts',
          networks: 'networks',
          volumes: 'volumes',
          vms: 'vms',
        } as const
      )[op.entity as 'vms'];
      const vmArchive = archived.data as
        { kind?: string; vm: VM; volumes: Volume[]; interfaces: PlatformRecord[] } | undefined;
      if (op.entity === 'vms' && vmArchive?.kind === 'vm-archive') {
        state.vms.push(structuredClone(vmArchive.vm));
        state.volumes.push(...structuredClone(vmArchive.volumes));
        platformState(state).records.interfaces.push(...structuredClone(vmArchive.interfaces));
      } else if (key && archived.data)
        (state[key] as { id: string }[]).push(archived.data as { id: string });
      writePlatformRecord(state, op.entity, {
        ...row,
        status: row.status === 'DELETED' ? 'ENABLED' : row.status,
      });
      platformState(state).removed = platformState(state).removed.filter((r) => r !== archived);
    }
  } else if (op.action === 'apply' && op.entity === 'recommendations') {
    for (const row of op.records) {
      const vm = state.vms.find((r) => r.id === row.vmId),
        host = state.hosts.find((r) => r.id === row.targetNodeId);
      if (!vm || !host || host.maintenance)
        throw new PlatformError('Целевой узел недоступен для переноса.', 409);
      vm.hostId = host.id;
      writePlatformRecord(state, op.entity, { ...row, status: 'APPLIED' });
    }
  } else {
    for (const row of op.records) {
      if (
        ['bservices', 'kubernetes'].includes(op.entity) &&
        ['start', 'stop'].includes(op.action)
      ) {
        const field = op.entity === 'bservices' ? 'serviceId' : 'k8sId';
        const children = listPlatformRecords(state, 'vms').filter((vm) => vm[field] === row.id);
        for (const child of children) {
          const vm = state.vms.find((v) => v.id === child.id);
          if (vm) vm.status = op.action === 'start' ? 'running' : 'stopped';
        }
      }
      if (op.entity === 'vms' && ['pause', 'resume'].includes(op.action)) {
        const vm = state.vms.find((r) => r.id === row.id);
        if (vm) vm.status = op.action === 'pause' ? 'paused' : 'running';
      }
      writePlatformRecord(state, op.entity, { ...row, status: op.target || row.status });
    }
  }
  for (const row of op.records)
    recordAudit(state, op.entity, row, `${platformEntity(op.entity)?.api}/${op.action}`, now);
  const jobs = (platformState(state).records.jobs ||= []);
  jobs.unshift({
    id: idFor('job'),
    name: task.name,
    status: 'SUCCESS',
    method: `${platformEntity(op.entity)?.api}/${op.action}`,
    startedAt: new Date(task.startedAt).toISOString(),
    duration: Math.round(task.duration / 1000),
    heartbeat: new Date(now).toISOString(),
    taskId: task.id,
  });
}
export function dispatchPlatform(
  state: CloudState,
  method: string,
  path: string,
  input: Record<string, unknown>,
  now: number,
): { id?: string; taskId?: string } | undefined {
  if (!path.startsWith('/platform/')) return undefined;
  if (path === '/platform/mode' && method === 'POST') {
    if (!['admin', 'user', 'reader'].includes(String(input.mode))) fail('Неизвестная роль.');
    platformState(state).mode = input.mode as 'admin' | 'user' | 'reader';
    return {};
  }
  const [, , entity, resourceId, operation] = path.split('/');
  const definition = platformEntity(entity);
  if (!definition) throw new PlatformError('Раздел не найден.', 404);
  const bulk = resourceId === 'actions' && method === 'POST';
  const action = bulk
    ? String(input.action || '')
    : operation ||
      (method === 'POST' && !resourceId
        ? 'create'
        : method === 'PATCH'
          ? 'update'
          : method === 'DELETE'
            ? 'delete'
            : '');
  if (operation && method !== 'POST')
    throw new PlatformError('Метод операции не поддерживается.', 405);
  const ids = bulk
    ? Array.isArray(input.ids)
      ? [...new Set(input.ids.map(String))]
      : []
    : resourceId
      ? [resourceId]
      : [];
  if (bulk && (!ids.length || ids.length > 100 || ['create', 'update', 'restore'].includes(action)))
    fail('Выберите от 1 до 100 ресурсов для массовой операции.');
  const rows = ids.map((id) =>
    action === 'restore'
      ? platformState(state).removed.find((r) => r.entity === entity && r.record.id === id)?.record
      : lookup(state, entity, id),
  );
  if (rows.some((r) => !r)) throw new PlatformError('Ресурс не найден.', 404);
  const records = rows as PlatformRecord[];
  const unavailable = canChangePlatform(state, entity);
  if (unavailable) throw new PlatformError(unavailable, 403);
  for (const row of records) {
    const denied = canChangePlatform(state, entity, row);
    if (denied) throw new PlatformError(denied, 403);
    if (
      state.tasks.some(
        (t) =>
          t.status === 'running' &&
          t.platformOperation?.entity === entity &&
          t.platformOperation.ids.includes(row.id),
      )
    )
      throw new PlatformError('С ресурсом уже выполняется операция. Дождитесь её завершения.', 409);
  }
  if (entity === 'api-access' && action === 'permissions' && records.length === 1) {
    if (records[0].protected) throw new PlatformError('Системная роль защищена от изменения.', 409);
    const paths = new Set(apiOperations.map((op) => op.id));
    if (
      !Array.isArray(input.methods) ||
      input.methods.some((method) => typeof method !== 'string' || !paths.has(method))
    )
      fail('Выберите методы из каталога API.');
    const allowedMethods = [...new Set(input.methods as string[])];
    const updated = { ...records[0], allowedMethods, permissions: allowedMethods.length };
    writePlatformRecord(state, entity, updated);
    recordAudit(state, entity, updated, 'cloudbroker/apiaccess/apisInclude', now);
    return { id: updated.id };
  }
  let next: PlatformRecord[] = records,
    target: string | undefined;
  if (action === 'create' || action === 'update') {
    if (action === 'create' && !definition.create)
      throw new PlatformError('Создание в этом разделе недоступно.', 405);
    if (
      action === 'update' &&
      !definition.create &&
      !['locations', 'nodes', 'vnf-devices', 'optimizer', 'vms'].includes(entity)
    )
      throw new PlatformError('Изменение в этом разделе недоступно.', 405);
    if (action === 'update' && !records.length) throw new PlatformError('Укажите ресурс.', 404);
    next = [validatePlatformRecord(state, entity, input, records[0])];
    if (
      state.tasks.some(
        (task) =>
          task.status === 'running' &&
          task.platformOperation?.entity === entity &&
          task.platformOperation.action === 'create' &&
          task.platformOperation.records.some(
            (r) =>
              r.name === next[0].name &&
              resourceAccount(state, entity, r) === resourceAccount(state, entity, next[0]),
          ),
      )
    )
      throw new PlatformError('Ресурс с таким именем уже создаётся.', 409);
  } else if (action === 'delete') {
    if (!definition.delete || !records.length) throw new PlatformError('Удаление недоступно.', 405);
    for (const row of records) {
      if (row.protected) throw new PlatformError('Системный ресурс защищён от удаления.', 409);
      const links = resourceDependencies(state, entity, row.id);
      if (links.length)
        fail(
          'Сначала удалите или переназначьте связанные ресурсы: ' +
            links
              .slice(0, 3)
              .map((link) => link.record.name)
              .join(', ') +
            '.',
        );
    }
  } else if (action === 'restore') {
    if (!records.length) throw new PlatformError('Ресурс отсутствует в корзине.', 404);
    for (const row of records)
      for (const field of definition.fields)
        if (field.reference && row[field.key] && !lookup(state, field.reference, row[field.key]))
          throw new PlatformError('Сначала восстановите связанные ресурсы.', 409);
  } else {
    if (entity === 'vms' && records.some((r) => r.locked || r.administrativeStatus === 'DISABLED'))
      throw new PlatformError('Машина заблокирована или административно отключена.', 409);
    const command = definition.actions?.find((a) => a.id === action);
    if (!command || !records.length) throw new PlatformError('Операция недоступна.', 405);
    if (command.admin && platformState(state).mode !== 'admin')
      throw new PlatformError('Требуются права администратора.', 403);
    if (records.some((r) => command.from && !command.from.includes(r.status)))
      throw new PlatformError('Состояние ресурса изменилось. Обновите данные.', 409);
    target = command.target;
  }
  const resource = next.length === 1 ? next[0].name : next.length + ' ресурсов';
  const prefix =
    (
      {
        create: 'Создание',
        update: 'Изменение',
        delete: 'Удаление',
        restore: 'Восстановление',
      } as Record<string, string>
    )[action] ||
    definition.actions?.find((a) => a.id === action)?.label ||
    action;
  const owners = new Set(next.map((r) => resourceAccount(state, entity, r)));
  const task: Task = {
    id: idFor('task'),
    name: prefix + ': ' + resource,
    action: action === 'delete' ? 'delete' : 'create',
    vmIds: [],
    resource,
    projectId: String(next[0].rgId || 'all'),
    startedAt: now,
    duration: 2200,
    status: 'running',
    progress: 0,
    fail: state.simulation.fault === 'task',
    previous: {},
    platformOperation: {
      entity,
      ids: next.map((r) => r.id),
      action,
      accountId: owners.size === 1 ? [...owners][0] : '',
      records: structuredClone(next),
      target,
    },
  };
  if (task.fail) state.simulation.fault = 'none';
  state.tasks.unshift(task);
  return { id: next[0].id, taskId: task.id };
}

export function retryPlatformTask(state: CloudState, task: Task, now: number) {
  const op = task.platformOperation!;
  if (op.action === 'create' || op.action === 'update') {
    // Passwords were deliberately discarded. Retrying user creation needs a fresh form.
    if (op.entity === 'users' && op.action === 'create')
      throw new PlatformError('Повторно заполните форму пользователя: пароль не сохранялся.', 409);
    return dispatchPlatform(
      state,
      op.action === 'create' ? 'POST' : 'PATCH',
      '/platform/' + op.entity + (op.action === 'update' ? '/' + op.ids[0] : ''),
      op.records[0],
      now,
    )!;
  }
  return dispatchPlatform(
    state,
    'POST',
    op.ids.length > 1
      ? '/platform/' + op.entity + '/actions'
      : '/platform/' + op.entity + '/' + op.ids[0] + '/' + op.action,
    { ids: op.ids, action: op.action },
    now,
  )!;
}

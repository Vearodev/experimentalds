import {
  actionNames,
  busy,
  inSubnet,
  projectUsage,
  seedState,
  validCidr,
  validateVm,
  type CloudState,
  type FieldErrors,
  type Task,
  type VM,
  type VmAction,
  type VmDraft,
} from './domain.ts';
import {
  dispatchPlatform,
  finishPlatformTask,
  retryPlatformTask,
  recordAudit,
  PlatformError,
} from './platform-engine';
import {
  platformState,
  canChangePlatform,
  listPlatformRecords,
  resourceAccount,
  vmMetadata,
  scopeContains,
} from './platform-model';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fields: FieldErrors = {},
  ) {
    super(message);
  }
}
export type ApiResult = {
  state: CloudState;
  id?: string;
  taskId?: string;
  registry?: { empty: boolean };
};
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const requiredName = (name: unknown) => {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60)
    throw new ApiError('Укажите название длиной от 1 до 60 символов.', 422, {
      name: 'От 1 до 60 символов.',
    });
  return name.trim();
};
const numberIn = (value: unknown, min: number, max: number, key: string) => {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
    throw new ApiError('Проверьте числовые параметры.', 422, {
      [key]: `Допустимо от ${min} до ${max}.`,
    });
  return Number(value);
};
export class MockEngine {
  constructor(
    public state: CloudState = seedState(),
    private clock = () => Date.now(),
  ) {
    platformState(this.state);
  }
  private touch() {
    this.state.updatedAt = Math.max(this.clock(), this.state.updatedAt + 1);
  }
  settle() {
    let changed = false;
    for (const task of this.state.tasks.filter((t) => t.status === 'running')) {
      const progress = Math.min(
        100,
        Math.floor(((this.clock() - task.startedAt) / task.duration) * 100),
      );
      if (progress !== task.progress) {
        task.progress = progress;
        changed = true;
      }
      if (progress < 100) continue;
      task.status = task.fail ? 'error' : 'success';
      task.error = task.fail
        ? 'Хост не подтвердил операцию. Изменения не завершены; можно повторить задачу.'
        : undefined;
      if (task.platformOperation) {
        try {
          finishPlatformTask(this.state, task, this.clock());
        } catch (error) {
          task.status = 'error';
          task.error = error instanceof Error ? error.message : 'Не удалось завершить операцию.';
        }
        continue;
      }
      for (const id of task.vmIds) {
        const vm = this.state.vms.find((v) => v.id === id);
        if (!vm) continue;
        const auditRow = listPlatformRecords(this.state, 'vms').find((r) => r.id === id)!;
        recordAudit(
          this.state,
          'vms',
          auditRow,
          'cloudapi/compute/' + task.action,
          this.clock(),
          !task.fail,
        );
        if (task.fail) {
          vm.status =
            task.action === 'start' || task.action === 'create' ? 'error' : task.previous[id];
          continue;
        }
        if (task.action === 'delete') {
          const platform = platformState(this.state);
          platform.removed.unshift({
            entity: 'vms',
            record: { ...auditRow, status: task.previous[id] === 'error' ? 'ERROR' : 'STOPPED' },
            removedAt: new Date(this.clock()).toISOString(),
            data: {
              kind: 'vm-archive',
              vm: { ...structuredClone(vm), status: task.previous[id] },
              volumes: structuredClone(this.state.volumes.filter((r) => r.vmId === id && r.boot)),
              interfaces: structuredClone(
                platform.records.interfaces?.filter((r) => r.vmId === id) || [],
              ),
            },
          });
          platform.records.interfaces = (platform.records.interfaces || []).filter(
            (r) => r.vmId !== id,
          );
          this.state.vms = this.state.vms.filter((v) => v.id !== id);
          this.state.volumes = this.state.volumes
            .filter((v) => !(v.vmId === id && v.boot))
            .map((v) => (v.vmId === id ? { ...v, vmId: null } : v));
        } else if (task.action === 'snapshot') {
          vm.snapshots.unshift({
            id: uid('snap'),
            name: `Снимок ${vm.snapshots.length + 1}`,
            createdAt: new Date(this.clock()).toISOString(),
            size: Math.round(vm.rootSize * 0.12),
          });
        } else
          vm.status =
            task.action === 'stop'
              ? 'stopped'
              : task.action === 'create'
                ? task.previous[id]
                : 'running';
      }
    }
    if (changed) this.touch();
  }
  private project(id: unknown) {
    const project = this.state.projects.find((p) => p.id === id);
    if (!project)
      throw new ApiError('Проект не найден.', 422, { projectId: 'Выберите существующий проект.' });
    return project;
  }
  private vm(id: string) {
    const vm = this.state.vms.find((v) => v.id === id);
    if (!vm) throw new ApiError('Виртуальная машина не найдена.', 404);
    const denied = canChangePlatform(
      this.state,
      'vms',
      listPlatformRecords(this.state, 'vms').find((row) => row.id === vm.id),
    );
    if (denied) throw new ApiError(denied, 403);
    if (
      this.state.tasks.some(
        (t) =>
          t.status === 'running' &&
          t.platformOperation?.entity === 'vms' &&
          t.platformOperation.ids.includes(vm.id),
      )
    )
      throw new ApiError('С машиной уже выполняется операция.', 409);
    if (vmMetadata(this.state, vm.id)?.administrativeStatus === 'DISABLED')
      throw new ApiError(
        'Машина административно отключена. Включите её доступность в разделе безопасности.',
        409,
      );
    if (vmMetadata(this.state, vm.id)?.locked)
      throw new ApiError('Машина заблокирована. Сначала снимите блокировку.', 409);
    return vm;
  }
  private task(action: VmAction | 'create', vms: VM[], target?: 'running' | 'stopped') {
    const task: Task = {
      id: uid('task'),
      name: actionNames[action],
      action,
      vmIds: vms.map((v) => v.id),
      resource: vms.length === 1 ? vms[0].name : `${vms.length} машин`,
      projectId: vms.every((v) => v.projectId === vms[0].projectId) ? vms[0].projectId : 'all',
      startedAt: this.clock(),
      duration: action === 'create' ? 7000 : 4500,
      status: 'running',
      progress: 0,
      fail: this.state.simulation.fault === 'task',
      previous: Object.fromEntries(vms.map((v) => [v.id, target || v.status])),
    };
    if (task.fail) this.state.simulation.fault = 'none';
    for (const vm of vms) {
      if (action !== 'snapshot')
        vm.status =
          action === 'create'
            ? 'creating'
            : action === 'start'
              ? 'starting'
              : action === 'stop'
                ? 'stopping'
                : action === 'delete'
                  ? 'deleting'
                  : 'restarting';
    }
    this.state.tasks.unshift(task);
    return task.id;
  }
  dispatch(method: string, path: string, raw: unknown = {}): ApiResult {
    this.settle();
    if (method === 'GET' && path === '/state') return { state: structuredClone(this.state) };
    if (method === 'GET' && path === '/registry') {
      if (this.state.simulation.fault === 'read' || this.state.simulation.table === 'error') {
        if (this.state.simulation.fault === 'read') {
          this.state.simulation.fault = 'none';
          this.touch();
        }
        throw new ApiError('Сервис ресурсов временно недоступен. Повторите запрос.', 503);
      }
      return {
        state: structuredClone(this.state),
        registry: { empty: this.state.simulation.table === 'empty' },
      };
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new ApiError('Ожидается объект параметров.', 400);
    const data = raw as Record<string, any>;
    if (
      method !== 'GET' &&
      !['/simulation', '/reset'].includes(path) &&
      this.state.simulation.fault === 'request'
    ) {
      this.state.simulation.fault = 'none';
      this.touch();
      throw new ApiError(
        'Сервис временно недоступен. Данные формы сохранены — попробуйте ещё раз.',
        503,
      );
    }
    let id: string | undefined, taskId: string | undefined;
    if (path.startsWith('/platform/')) {
      try {
        const result = dispatchPlatform(this.state, method, path, data, this.clock());
        if (result) {
          this.touch();
          return { state: structuredClone(this.state), ...result };
        }
      } catch (error) {
        if (error instanceof PlatformError)
          throw new ApiError(error.message, error.status, error.fields);
        throw error;
      }
    }
    if (
      !['/simulation', '/reset', '/profile'].includes(path) &&
      platformState(this.state).mode === 'reader'
    )
      throw new ApiError('Роль «Наблюдатель» разрешает только просмотр.', 403);
    if (method === 'POST' && path === '/simulation') {
      const latency = numberIn(data.latency, 0, 3000, 'latency');
      if (!['none', 'request', 'task', 'read'].includes(data.fault))
        throw new ApiError('Неизвестный режим ошибок.');
      if (data.table !== undefined && !['normal', 'empty', 'error'].includes(data.table))
        throw new ApiError('Неизвестное состояние реестров.');
      this.state.simulation = {
        latency,
        fault: data.fault,
        table: data.table ?? this.state.simulation.table ?? 'normal',
      };
    } else if (method === 'POST' && path === '/reset') {
      if (data.confirm !== 'RESET')
        throw new ApiError('Подтвердите восстановление демонстрационных данных.');
      this.state = seedState(this.clock());
      platformState(this.state);
    } else if (method === 'POST' && path === '/vms') {
      const draft: VmDraft = {
        name: String(data.name || '').trim(),
        accountId: typeof data.accountId === 'string' ? data.accountId : undefined,
        policyId: typeof data.policyId === 'string' ? data.policyId : undefined,
        imageId: typeof data.imageId === 'string' ? data.imageId : undefined,
        chipset: String(data.chipset || 'Q35'),
        numa: String(data.numa || 'none'),
        cpuPin: data.cpuPin === true,
        hugepages: data.hugepages === true,
        projectId: String(data.projectId || ''),
        hostId: String(data.hostId || ''),
        networkId: String(data.networkId || ''),
        template: String(data.template || ''),
        cpu: Number(data.cpu),
        memory: Number(data.memory),
        rootSize: Number(data.rootSize),
        ip: String(data.ip || ''),
        dhcp: data.dhcp === true,
        mac: String(data.mac || '').toLowerCase(),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        description: String(data.description || ''),
        backup: data.backup === true,
        start: data.start === true,
        volumeIds: Array.isArray(data.volumeIds) ? data.volumeIds.map(String) : [],
      };
      if (!scopeContains(this.state, 'all', draft.projectId))
        throw new ApiError('Нет доступа к ресурсной группе.', 403);
      const errors = validateVm(draft, this.state);
      if (Object.keys(errors).length)
        throw new ApiError('Проверьте параметры виртуальной машины.', 422, errors);
      let ip = draft.ip;
      if (draft.dhcp) {
        const network = this.state.networks.find((n) => n.id === draft.networkId)!;
        const parts = network.cidr.split('/')[0].split('.');
        let candidate = parts.reduce((n, p) => (n * 256 + +p) >>> 0, 0) + 10;
        ip = '';
        for (let i = 0; i < 65526; i++, candidate++) {
          const value = [24, 16, 8, 0].map((shift) => (candidate >>> shift) & 255).join('.');
          if (!inSubnet(value, network.cidr)) break;
          if (!this.state.vms.some((v) => v.networkId === network.id && v.ip === value)) {
            ip = value;
            break;
          }
        }
        if (!ip)
          throw new ApiError('В подсети закончились свободные адреса.', 409, {
            networkId: 'Выберите другую сеть.',
          });
      }
      id = uid('vm');
      const vm: VM = {
        ...draft,
        id,
        ip,
        mac: draft.mac || `02${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`,
        status: 'creating',
        cpuUsage: 0,
        memoryUsage: 0,
        createdAt: new Date(this.clock()).toISOString(),
        snapshots: [],
      };
      this.state.vms.push(vm);
      platformState(this.state).records.vms.push({
        id,
        name: vm.name,
        status: 'ENABLED',
        administrativeStatus: 'ENABLED',
        locked: false,
        imageId:
          draft.imageId ||
          listPlatformRecords(this.state, 'images').find((r) => r.name === vm.template)?.id ||
          'image-1',
        policyId: draft.policyId || 'policy-2',
        chipset: draft.chipset || 'Q35',
        numa: draft.numa || 'none',
        cpuPin: draft.cpuPin || false,
        hugepages: draft.hugepages || false,
      });
      this.state.volumes.push({
        id: uid('vol'),
        name: `${vm.name}-system`,
        projectId: vm.projectId,
        size: vm.rootSize,
        tier: 'ssd',
        vmId: id,
        boot: true,
      });
      const systemDisk = this.state.volumes.at(-1)!;
      platformState(this.state).records.volumes.push({
        id: systemDisk.id,
        name: systemDisk.name,
        status: 'ALLOCATED',
        accountId: resourceAccount(
          this.state,
          'vms',
          listPlatformRecords(this.state, 'vms').find((r) => r.id === id)!,
        ),
        policyId: draft.policyId || 'policy-2',
        sepId:
          listPlatformRecords(this.state, 'storage-policies').find(
            (r) => r.id === (draft.policyId || 'policy-2'),
          )?.sepId || 'sep-1',
        shareable: false,
      });
      this.state.volumes.forEach((v) => {
        if (draft.volumeIds.includes(v.id)) v.vmId = id!;
      });
      taskId = this.task('create', [vm], draft.start ? 'running' : 'stopped');
    } else if (method === 'POST' && path === '/vms/actions') {
      if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > 100)
        throw new ApiError('Выберите от 1 до 100 машин.');
      const action = data.action as VmAction;
      if (!['start', 'stop', 'restart', 'snapshot', 'delete'].includes(action))
        throw new ApiError('Неизвестное действие.');
      const vms = [...new Set<string>(data.ids)].map((value) => this.vm(value));
      if (
        vms.some(
          (v) =>
            busy(v) ||
            this.state.tasks.some((t) => t.status === 'running' && t.vmIds.includes(v.id)),
        )
      )
        throw new ApiError(
          'Для выбранной машины уже выполняется задача. Дождитесь её завершения.',
          409,
        );
      if (action === 'delete' && data.code !== '642180')
        throw new ApiError('Неверный демонстрационный код.', 422, { code: 'Введите 642180.' });
      if (action === 'start' && vms.some((v) => !['stopped', 'error'].includes(v.status)))
        throw new ApiError('Запуск доступен только для выключенных машин и машин с ошибкой.', 409);
      if (['stop', 'restart'].includes(action) && vms.some((v) => v.status !== 'running'))
        throw new ApiError('Действие доступно только для работающих машин.', 409);
      if (action === 'delete' && vms.some((v) => !['stopped', 'error'].includes(v.status)))
        throw new ApiError('Перед удалением выключите машины.', 409);
      if (action === 'snapshot' && vms.some((v) => v.status === 'error'))
        throw new ApiError('Сначала устраните ошибку машины.', 409);
      taskId = this.task(action, vms);
    } else if (method === 'PATCH' && /^\/vms\/[^/]+$/.test(path)) {
      const vm = this.vm(path.split('/')[2]);
      if (busy(vm)) throw new ApiError('Дождитесь завершения операции.', 409);
      const cpu = data.cpu === undefined ? vm.cpu : Number(data.cpu),
        memory = data.memory === undefined ? vm.memory : Number(data.memory);
      if ((cpu !== vm.cpu || memory !== vm.memory) && vm.status !== 'stopped')
        throw new ApiError('Для изменения ресурсов выключите машину.', 409);
      const draft: VmDraft = {
        ...vm,
        name: data.name === undefined ? vm.name : String(data.name),
        cpu,
        memory,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : vm.tags,
        description: data.description === undefined ? vm.description : String(data.description),
        backup: typeof data.backup === 'boolean' ? data.backup : vm.backup,
        volumeIds: [],
        start: false,
      };
      const errors = validateVm(draft, this.state, vm.id);
      if (Object.keys(errors).length) throw new ApiError('Проверьте параметры.', 422, errors);
      Object.assign(vm, {
        name: draft.name,
        cpu,
        memory,
        tags: draft.tags,
        description: draft.description,
        backup: draft.backup,
      });
      id = vm.id;
    } else if (method === 'POST' && /^\/vms\/[^/]+\/volumes$/.test(path)) {
      const vm = this.vm(path.split('/')[2]);
      if (busy(vm)) throw new ApiError('Дождитесь завершения операции.', 409);
      if (!Array.isArray(data.ids) || !data.ids.length) throw new ApiError('Выберите диски.');
      const volumes = [...new Set<string>(data.ids)].map((value) =>
        this.state.volumes.find((v) => v.id === value),
      );
      if (
        volumes.some(
          (v) =>
            !v ||
            v.vmId ||
            v.boot ||
            resourceAccount(
              this.state,
              'volumes',
              listPlatformRecords(this.state, 'volumes').find((row) => row.id === v.id)!,
            ) !==
              resourceAccount(
                this.state,
                'vms',
                listPlatformRecords(this.state, 'vms').find((row) => row.id === vm.id)!,
              ),
        )
      )
        throw new ApiError('Один из дисков уже подключён или недоступен в проекте.', 409);
      volumes.forEach((v) => {
        v!.vmId = vm.id;
      });
    } else if (method === 'DELETE' && /^\/vms\/[^/]+\/volumes\/[^/]+$/.test(path)) {
      const [, , vmId, , volumeId] = path.split('/'),
        vm = this.vm(vmId),
        volume = this.state.volumes.find((v) => v.id === volumeId && v.vmId === vmId);
      if (!volume || volume.boot) throw new ApiError('Системный диск нельзя отключить.', 409);
      if (vm.status !== 'stopped')
        throw new ApiError('Для отключения диска выключите машину.', 409);
      volume.vmId = null;
    } else if (method === 'POST' && path === '/volumes') {
      const project = this.project(data.projectId),
        name = requiredName(data.name),
        size = numberIn(data.size, 10, 4096, 'size');
      if (this.state.volumes.some((v) => v.name === name && v.projectId === project.id))
        throw new ApiError('Диск с таким именем уже существует.', 422, { name: 'Имя уже занято.' });
      id = uid('vol');
      this.state.volumes.push({
        id,
        name,
        projectId: project.id,
        size,
        tier: data.tier === 'hdd' ? 'hdd' : 'ssd',
        vmId: null,
        boot: false,
      });
    } else if (method === 'DELETE' && /^\/volumes\/[^/]+$/.test(path)) {
      const volume = this.state.volumes.find((v) => v.id === path.split('/')[2]);
      if (!volume) throw new ApiError('Диск не найден.', 404);
      if (volume.vmId) throw new ApiError('Сначала отключите диск от машины.', 409);
      this.state.volumes = this.state.volumes.filter((v) => v.id !== volume.id);
    } else if (method === 'POST' && path === '/networks') {
      const project = this.project(data.projectId),
        name = requiredName(data.name),
        cidr = String(data.cidr || ''),
        vlan = numberIn(data.vlan, 1, 4094, 'vlan');
      if (!validCidr(cidr))
        throw new ApiError('Некорректная подсеть.', 422, {
          cidr: 'Сетевой адрес с маской /16–/28, например 10.40.0.0/24.',
        });
      if (this.state.networks.some((n) => n.vlan === vlan))
        throw new ApiError('VLAN уже используется.', 422, { vlan: 'Выберите другой VLAN.' });
      if (this.state.networks.some((n) => n.projectId === project.id && n.name === name))
        throw new ApiError('Имя сети уже занято.', 422, { name: 'Выберите другое имя.' });
      const range = (subnet: string) => {
        const [address, prefix] = subnet.split('/');
        const start = address.split('.').reduce((value, part) => value * 256 + +part, 0);
        return [start, start + 2 ** (32 - +prefix) - 1];
      };
      const [start, end] = range(cidr);
      if (
        this.state.networks.some((n) => {
          const [a, b] = range(n.cidr);
          return n.projectId === project.id && start <= b && a <= end;
        })
      )
        throw new ApiError('Подсеть пересекается с существующей сетью проекта.', 422, {
          cidr: 'Выберите непересекающийся диапазон адресов.',
        });
      id = uid('net');
      this.state.networks.push({ id, name, projectId: project.id, cidr, vlan });
    } else if (method === 'DELETE' && /^\/networks\/[^/]+$/.test(path)) {
      id = path.split('/')[2];
      if (!this.state.networks.some((n) => n.id === id))
        throw new ApiError('Сеть не найдена.', 404);
      if (this.state.vms.some((v) => v.networkId === id))
        throw new ApiError('Сеть используется виртуальными машинами.', 409);
      this.state.networks = this.state.networks.filter((n) => n.id !== id);
    } else if (method === 'POST' && path === '/projects') {
      const name = requiredName(data.name),
        cpuQuota = numberIn(data.cpuQuota, 8, 512, 'cpuQuota'),
        memoryQuota = numberIn(data.memoryQuota, 16, 2048, 'memoryQuota');
      if (this.state.projects.some((p) => p.name.toLowerCase() === name.toLowerCase()))
        throw new ApiError('Проект уже существует.', 422, { name: 'Название уже занято.' });
      id = uid('project');
      this.state.projects.push({
        id,
        name,
        cpuQuota,
        memoryQuota,
        description: String(data.description || '').slice(0, 500),
        environment: ['production', 'development', 'recovery'].includes(data.environment)
          ? data.environment
          : 'development',
        members: [this.state.profile.name],
      });
    } else if (method === 'PATCH' && path === '/profile') {
      const name = requiredName(data.name),
        phone = String(data.phone || '');
      if (phone && !/^\d{10}$/.test(phone))
        throw new ApiError('Проверьте телефон.', 422, { phone: 'Введите 10 цифр после +7.' });
      this.state.profile = {
        ...this.state.profile,
        name,
        phone,
        notifications: Boolean(data.notifications),
        digest: Boolean(data.digest),
      };
    } else if (method === 'POST' && /^\/tasks\/[^/]+\/retry$/.test(path)) {
      const task = this.state.tasks.find((t) => t.id === path.split('/')[2]);
      if (!task || task.status !== 'error')
        throw new ApiError('Задача недоступна для повторного запуска.', 409);
      if (task.platformOperation) {
        try {
          const result = retryPlatformTask(this.state, task, this.clock());
          this.touch();
          return { state: structuredClone(this.state), ...result };
        } catch (error) {
          if (error instanceof PlatformError)
            throw new ApiError(error.message, error.status, error.fields);
          throw error;
        }
      }
      const vms = task.vmIds.map((value) => this.vm(value));
      if (
        vms.some(
          (v) =>
            busy(v) ||
            this.state.tasks.some((t) => t.status === 'running' && t.vmIds.includes(v.id)),
        )
      )
        throw new ApiError('Для ресурса уже выполняется другая задача.', 409);
      if (
        (task.action === 'start' && vms.some((v) => !['stopped', 'error'].includes(v.status))) ||
        (['stop', 'restart'].includes(task.action) && vms.some((v) => v.status !== 'running')) ||
        (task.action === 'delete' && vms.some((v) => v.status === 'running')) ||
        (task.action === 'create' && vms.some((v) => v.status !== 'error')) ||
        (task.action === 'snapshot' && vms.some((v) => v.status === 'error'))
      )
        throw new ApiError(
          'Состояние ресурса изменилось. Выберите новое действие на странице машины.',
          409,
        );
      taskId = this.task(
        task.action,
        vms,
        task.action === 'create'
          ? task.previous[vms[0].id] === 'running'
            ? 'running'
            : 'stopped'
          : undefined,
      );
    } else throw new ApiError('Маршрут не найден.', 404);
    this.touch();
    return { state: structuredClone(this.state), id, taskId };
  }
}

export { projectUsage };

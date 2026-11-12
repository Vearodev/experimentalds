import {
  groupAccountId,
  listPlatformRecords,
  platformState,
  scopeContains,
} from './platform-model';
import type { PlatformRecord, PlatformState } from './platform-types';

export type VmStatus =
  | 'running'
  | 'stopped'
  | 'paused'
  | 'error'
  | 'creating'
  | 'starting'
  | 'stopping'
  | 'restarting'
  | 'deleting';
export type VmAction = 'start' | 'stop' | 'restart' | 'snapshot' | 'delete';
export type Project = {
  id: string;
  name: string;
  description: string;
  environment: string;
  cpuQuota: number;
  memoryQuota: number;
  members: string[];
};
export type Cluster = { id: string; name: string; region: string; description: string };
export type Host = {
  id: string;
  name: string;
  clusterId: string;
  cpu: number;
  memory: number;
  maintenance: boolean;
};
export type Volume = {
  id: string;
  name: string;
  projectId: string;
  size: number;
  tier: 'ssd' | 'hdd';
  vmId: string | null;
  boot: boolean;
};
export type CloudNetwork = {
  id: string;
  name: string;
  projectId: string;
  cidr: string;
  vlan: number;
};
export type Snapshot = { id: string; name: string; createdAt: string; size: number };
export type VM = {
  id: string;
  name: string;
  projectId: string;
  hostId: string;
  networkId: string;
  template: string;
  cpu: number;
  memory: number;
  rootSize: number;
  ip: string;
  dhcp: boolean;
  mac: string;
  status: VmStatus;
  cpuUsage: number;
  memoryUsage: number;
  tags: string[];
  description: string;
  backup: boolean;
  createdAt: string;
  snapshots: Snapshot[];
};
export type Task = {
  id: string;
  name: string;
  action: VmAction | 'create';
  vmIds: string[];
  resource: string;
  projectId: string;
  startedAt: number;
  duration: number;
  status: 'running' | 'success' | 'error';
  progress: number;
  fail: boolean;
  error?: string;
  previous: Record<string, VmStatus>;
  platformOperation?: {
    entity: string;
    ids: string[];
    action: string;
    accountId: string;
    records: PlatformRecord[];
    target?: string;
  };
};
export type Profile = {
  name: string;
  email: string;
  phone: string;
  notifications: boolean;
  digest: boolean;
};
export type Simulation = {
  latency: number;
  fault: 'none' | 'request' | 'task' | 'read';
  table?: 'normal' | 'empty' | 'error';
};
export type CloudState = {
  version: 1;
  projects: Project[];
  clusters: Cluster[];
  hosts: Host[];
  vms: VM[];
  volumes: Volume[];
  networks: CloudNetwork[];
  tasks: Task[];
  profile: Profile;
  simulation: Simulation;
  updatedAt: number;
  platform?: PlatformState;
};
export type VmDraft = {
  accountId?: string;
  policyId?: string;
  imageId?: string;
  chipset?: string;
  numa?: string;
  cpuPin?: boolean;
  hugepages?: boolean;
  name: string;
  projectId: string;
  hostId: string;
  template: string;
  cpu: number;
  memory: number;
  rootSize: number;
  networkId: string;
  dhcp: boolean;
  ip: string;
  mac: string;
  volumeIds: string[];
  tags: string[];
  description: string;
  backup: boolean;
  start: boolean;
};
export type FieldErrors = Record<string, string>;
export const templates = ['Ubuntu 24.04 LTS', 'Debian 12', 'Rocky Linux 9', 'Windows Server 2022'];
export const busy = (vm: VM) =>
  ['creating', 'starting', 'stopping', 'restarting', 'deleting'].includes(vm.status);
export const actionNames: Record<VmAction | 'create', string> = {
  start: 'Запуск',
  stop: 'Выключение',
  restart: 'Перезапуск',
  snapshot: 'Создание снимка',
  delete: 'Удаление',
  create: 'Создание ВМ',
};
export const statusNames: Record<VmStatus, string> = {
  running: 'Работает',
  stopped: 'Выключена',
  paused: 'Приостановлена',
  error: 'Ошибка',
  creating: 'Создаётся',
  starting: 'Запускается',
  stopping: 'Выключается',
  restarting: 'Перезапуск',
  deleting: 'Удаляется',
};
export const isIPv4 = (value: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
  value.split('.').every((n) => +n <= 255 && String(+n) === n);
export function inSubnet(ip: string, cidr: string) {
  const [base, rawPrefix] = cidr.split('/'),
    prefix = Number(rawPrefix);
  if (!isIPv4(ip) || !isIPv4(base) || !Number.isInteger(prefix) || prefix < 1 || prefix > 30)
    return false;
  const numeric = (v: string) =>
    v.split('.').reduce((result, part) => (result * 256 + Number(part)) >>> 0, 0);
  const mask = (0xffffffff << (32 - prefix)) >>> 0,
    n = numeric(ip),
    network = (numeric(base) & mask) >>> 0;
  return (n & mask) >>> 0 === network && n !== network && n !== (network | ~mask) >>> 0;
}
export function validCidr(value: string) {
  const [address, prefix, extra] = value.split('/');
  if (
    extra ||
    !isIPv4(address || '') ||
    !/^\d+$/.test(prefix || '') ||
    +prefix < 16 ||
    +prefix > 28
  )
    return false;
  const n = address.split('.').reduce((result, part) => (result * 256 + +part) >>> 0, 0);
  return (n & (0xffffffff << (32 - +prefix))) >>> 0 === n;
}
export function projectUsage(state: CloudState, id: string, except?: string) {
  return state.vms
    .filter((vm) => vm.projectId === id && vm.id !== except)
    .reduce((sum, vm) => ({ cpu: sum.cpu + vm.cpu, memory: sum.memory + vm.memory }), {
      cpu: 0,
      memory: 0,
    });
}
export function validateVm(draft: VmDraft, state: CloudState, except?: string): FieldErrors {
  const errors: FieldErrors = {},
    project = state.projects.find((p) => p.id === draft.projectId),
    host = state.hosts.find((h) => h.id === draft.hostId),
    network = state.networks.find((n) => n.id === draft.networkId);
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(draft.name))
    errors.name = 'От 3 до 40 символов: латинские буквы, цифры и дефис. Начните с буквы.';
  else if (
    state.vms.some(
      (vm) =>
        vm.id !== except &&
        vm.name.toLowerCase() === draft.name.toLowerCase() &&
        vm.projectId === draft.projectId,
    )
  )
    errors.name = 'Машина с таким именем уже есть в ресурсной группе.';
  if (draft.accountId && draft.accountId !== groupAccountId(state, draft.projectId))
    errors.projectId = 'Ресурсная группа принадлежит другому аккаунту.';
  if (!scopeContains(state, 'all', draft.projectId))
    errors.projectId = 'Нет доступа к ресурсной группе.';
  if (!project) errors.projectId = 'Выберите ресурсную группу.';
  if (!host || host.maintenance) errors.hostId = 'Выберите доступный узел.';
  const image = draft.imageId
    ? listPlatformRecords(state, 'images').find((r) => r.id === draft.imageId)
    : undefined;
  if (
    draft.imageId
      ? !image || image.status !== 'ENABLED' || image.type === 'ISO'
      : !templates.includes(draft.template)
  )
    errors.template = 'Выберите доступный образ ОС.';
  if (
    draft.policyId &&
    !listPlatformRecords(state, 'storage-policies').some(
      (r) => r.id === draft.policyId && r.status === 'ENABLED',
    )
  )
    errors.policyId = 'Выберите доступную политику хранения.';
  if (draft.chipset && !['Q35', 'i440fx'].includes(draft.chipset))
    errors.chipset = 'Выберите поддерживаемый чипсет.';
  if (draft.numa && !['none', 'loose', 'strict'].includes(draft.numa))
    errors.numa = 'Выберите режим NUMA.';
  if (!Number.isInteger(draft.cpu) || draft.cpu < 1 || draft.cpu > 32)
    errors.cpu = 'Допустимо от 1 до 32 vCPU.';
  if (!Number.isInteger(draft.memory) || draft.memory < 1 || draft.memory > 128)
    errors.memory = 'Допустимо от 1 до 128 GiB.';
  if (!Number.isInteger(draft.rootSize) || draft.rootSize < 20 || draft.rootSize > 1024)
    errors.rootSize = 'Допустимо от 20 до 1024 GiB.';
  if (project) {
    const usage = projectUsage(state, project.id, except);
    if (usage.cpu + draft.cpu > project.cpuQuota)
      errors.cpu = `Доступно ${Math.max(0, project.cpuQuota - usage.cpu)} vCPU по квоте ресурсной группы.`;
    if (usage.memory + draft.memory > project.memoryQuota)
      errors.memory = `Доступно ${Math.max(0, project.memoryQuota - usage.memory)} GiB по квоте ресурсной группы.`;
  }
  const owner = platformState(state).records.accounts.find(
    (r) => r.id === groupAccountId(state, draft.projectId),
  );
  const peers = state.vms.filter(
    (vm) => vm.id !== except && groupAccountId(state, vm.projectId) === owner?.id,
  );
  if (owner && peers.reduce((sum, vm) => sum + vm.cpu, 0) + draft.cpu > Number(owner.cpuQuota))
    errors.cpu = 'Недостаточно квоты vCPU аккаунта.';
  if (
    owner &&
    peers.reduce((sum, vm) => sum + vm.memory, 0) + draft.memory > Number(owner.memoryQuota)
  )
    errors.memory = 'Недостаточно квоты памяти аккаунта.';
  if (host) {
    const selectedGroup = listPlatformRecords(state, 'projects').find(
      (r) => r.id === draft.projectId,
    );
    const selectedZone = listPlatformRecords(state, 'clusters').find(
      (r) => r.id === host.clusterId,
    );
    if (
      selectedGroup?.gridId &&
      selectedZone?.gridId &&
      selectedGroup.gridId !== selectedZone.gridId
    )
      errors.hostId = 'Узел должен находиться на площадке ресурсной группы.';
    const resident = state.vms.filter((vm) => vm.hostId === host.id && vm.id !== except);
    if (
      resident.reduce((n, vm) => n + vm.cpu, 0) + draft.cpu > host.cpu ||
      resident.reduce((n, vm) => n + vm.memory, 0) + draft.memory > host.memory
    )
      errors.hostId = 'На узле недостаточно свободных ресурсов.';
  }
  if (!network || network.projectId !== draft.projectId)
    errors.networkId = 'Выберите сеть этой ресурсной группы.';
  if (!draft.dhcp && (!network || !inSubnet(draft.ip, network.cidr)))
    errors.ip = 'Укажите адрес хоста в выбранной подсети.';
  if (
    !draft.dhcp &&
    state.vms.some(
      (vm) => vm.id !== except && vm.networkId === draft.networkId && vm.ip === draft.ip,
    )
  )
    errors.ip = 'Этот адрес уже занят.';
  if (draft.mac && !/^[a-f0-9]{12}$/i.test(draft.mac))
    errors.mac = 'MAC-адрес должен содержать 12 шестнадцатеричных символов.';
  if (
    draft.mac &&
    state.vms.some((vm) => vm.id !== except && vm.mac.toLowerCase() === draft.mac.toLowerCase())
  )
    errors.mac = 'MAC-адрес уже используется.';
  if (
    !Array.isArray(draft.tags) ||
    draft.tags.length > 8 ||
    draft.tags.some((t) => !/^[a-z0-9:_-]{1,24}$/i.test(t)) ||
    new Set(draft.tags.map((t) => t.toLowerCase())).size !== draft.tags.length
  )
    errors.tags = 'До 8 уникальных меток, по 24 символа: латиница, цифры, : _ -.';
  if (draft.description.length > 500) errors.description = 'Не более 500 символов.';
  if (
    draft.volumeIds.some(
      (id) =>
        !state.volumes.some(
          (v) =>
            v.id === id &&
            String(listPlatformRecords(state, 'volumes').find((r) => r.id === v.id)?.accountId) ===
              groupAccountId(state, draft.projectId) &&
            !v.boot &&
            (!v.vmId || v.vmId === except),
        ),
    )
  )
    errors.volumeIds = 'Один из дисков уже занят или принадлежит другому аккаунту.';
  return errors;
}
export function seedState(now = Date.now()): CloudState {
  const projects: Project[] = [
    {
      id: 'prod',
      name: 'Production',
      environment: 'production',
      description: 'Основные сервисы и клиентские приложения',
      cpuQuota: 128,
      memoryQuota: 512,
      members: ['Анна Смирнова', 'Марк Волков', 'Ирина Ли', 'Денис Орлов'],
    },
    {
      id: 'dev',
      name: 'Development',
      environment: 'development',
      description: 'Разработка, стенды и автоматические проверки',
      cpuQuota: 64,
      memoryQuota: 192,
      members: ['Марк Волков', 'Денис Орлов'],
    },
    {
      id: 'dr',
      name: 'Disaster Recovery',
      environment: 'recovery',
      description: 'Резервная площадка критичных сервисов',
      cpuQuota: 64,
      memoryQuota: 256,
      members: ['Анна Смирнова', 'Ирина Ли'],
    },
  ];
  const clusters: Cluster[] = [
    {
      id: 'msk-main',
      name: 'Moscow / Core',
      region: 'Москва',
      description: 'Основная вычислительная площадка',
    },
    {
      id: 'msk-lab',
      name: 'Moscow / Lab',
      region: 'Москва',
      description: 'Разработка и испытания',
    },
    {
      id: 'spb-dr',
      name: 'Saint Petersburg / DR',
      region: 'Санкт-Петербург',
      description: 'Резервная площадка',
    },
  ];
  const hosts: Host[] = [
    {
      id: 'h1',
      name: 'msk-kvm-01',
      clusterId: 'msk-main',
      cpu: 96,
      memory: 384,
      maintenance: false,
    },
    {
      id: 'h2',
      name: 'msk-kvm-02',
      clusterId: 'msk-main',
      cpu: 96,
      memory: 384,
      maintenance: false,
    },
    {
      id: 'h3',
      name: 'msk-kvm-03',
      clusterId: 'msk-main',
      cpu: 96,
      memory: 384,
      maintenance: true,
    },
    {
      id: 'h4',
      name: 'msk-lab-01',
      clusterId: 'msk-lab',
      cpu: 64,
      memory: 256,
      maintenance: false,
    },
    { id: 'h5', name: 'spb-kvm-01', clusterId: 'spb-dr', cpu: 96, memory: 384, maintenance: false },
  ];
  const networks: CloudNetwork[] = projects.map((p, i) => ({
    id: `net-${p.id}`,
    name: `${p.id}-private`,
    projectId: p.id,
    cidr: `10.${20 + i}.0.0/24`,
    vlan: 120 + i,
  }));
  const names = [
    'prod-api-01',
    'prod-api-02',
    'prod-postgres-01',
    'prod-redis-01',
    'prod-worker-01',
    'prod-worker-02',
    'prod-ingress-01',
    'prod-monitoring-01',
    'dev-build-01',
    'dev-api-01',
    'dev-test-01',
    'dev-registry-01',
    'dr-postgres-01',
    'dr-backup-01',
    'prod-analytics-01',
    'dev-sandbox-01',
  ];
  const vms: VM[] = names.map((name, i) => {
    const projectId = name.startsWith('dev') ? 'dev' : name.startsWith('dr') ? 'dr' : 'prod';
    const p = projects.findIndex((p) => p.id === projectId);
    return {
      id: `vm-${i + 1}`,
      name,
      projectId,
      hostId: projectId === 'dev' ? 'h4' : projectId === 'dr' ? 'h5' : i % 2 ? 'h2' : 'h1',
      networkId: `net-${projectId}`,
      template: templates[i % 3],
      cpu: i === 2 ? 16 : i % 3 === 0 ? 8 : 4,
      memory: i === 2 ? 64 : i % 3 === 0 ? 16 : 8,
      rootSize: i === 2 ? 200 : 40,
      ip: `10.${20 + p}.0.${11 + i}`,
      dhcp: true,
      mac: `02000000${(i + 1).toString(16).padStart(4, '0')}`,
      status: i === 5 ? 'error' : [10, 13, 15].includes(i) ? 'stopped' : 'running',
      cpuUsage: i === 2 ? 87 : 8 + ((i * 13) % 59),
      memoryUsage: 23 + ((i * 17) % 62),
      tags: [projectId === 'prod' ? 'critical' : projectId, i === 2 ? 'database' : 'linux'],
      description:
        i === 2
          ? 'Основная база данных. Изменения согласуются с владельцем сервиса.'
          : 'Управляемый ресурс облачной платформы.',
      backup: projectId === 'prod',
      createdAt: new Date(now - (12 + i) * 86400000).toISOString(),
      snapshots:
        i < 4
          ? [
              {
                id: `snap-${i}`,
                name: 'Ежедневный снимок',
                createdAt: new Date(now - 3 * 3600000).toISOString(),
                size: 4 + i * 2,
              },
            ]
          : [],
    };
  });
  const volumes: Volume[] = [
    ...vms.map((vm) => ({
      id: `vol-${vm.id}`,
      name: `${vm.name}-system`,
      projectId: vm.projectId,
      size: vm.rootSize,
      tier: 'ssd' as const,
      vmId: vm.id,
      boot: true,
    })),
    ...projects.flatMap((p) =>
      [1, 2].map((i) => ({
        id: `vol-${p.id}-${i}`,
        name: `${p.id}-${i === 1 ? 'data' : 'archive'}-0${i}`,
        projectId: p.id,
        size: i === 1 ? 100 : 500,
        tier: i === 1 ? ('ssd' as const) : ('hdd' as const),
        vmId: null,
        boot: false,
      })),
    ),
  ];
  const tasks: Task[] = [
    {
      id: 'task-seed-failed',
      name: 'Запуск',
      action: 'start',
      vmIds: ['vm-6'],
      resource: 'prod-worker-02',
      projectId: 'prod',
      startedAt: now - 27 * 60000,
      duration: 5000,
      status: 'error',
      progress: 100,
      fail: false,
      error: 'Хост временно не отвечал. Повторите операцию.',
      previous: { 'vm-6': 'stopped' },
    },
    ...vms.slice(0, 4).map((vm, i) => ({
      id: `task-seed-${i}`,
      name: 'Создание снимка',
      action: 'snapshot' as const,
      vmIds: [vm.id],
      resource: vm.name,
      projectId: vm.projectId,
      startedAt: now - (i + 1) * 3600000,
      duration: 5000,
      status: 'success' as const,
      progress: 100,
      fail: false,
      previous: { [vm.id]: vm.status },
    })),
  ];
  return {
    version: 1,
    projects,
    clusters,
    hosts,
    vms,
    volumes,
    networks,
    tasks,
    profile: {
      name: 'Анна Смирнова',
      email: 'anna@example.test',
      phone: '9991234567',
      notifications: true,
      digest: false,
    },
    simulation: { latency: 260, fault: 'none' },
    updatedAt: now,
  };
}

import type { PlatformEntity, PlatformField, PlatformRecord, PlatformTab } from '../platform-types';
import type { CloudState } from '../domain';
import { listPlatformRecords, recordVisible } from '../platform-model';

export function relatedResourceRows(state: CloudState, row: PlatformRecord, tab: PlatformTab) {
  if (!tab.entity) return [];
  return listPlatformRecords(state, tab.entity).filter(
    (item) =>
      recordVisible(state, tab.entity!, item) &&
      (tab.foreignKey
        ? item[tab.foreignKey] === row.id
        : Array.isArray(row[tab.idsField || '']) &&
          (row[tab.idsField!] as string[]).includes(item.id)),
  );
}

// Product information hierarchy. The DS still owns controls, states and visual tokens.
const groups = [
  {
    id: 'context',
    title: 'Рабочая область',
    icon: 'FolderKanban',
    keys: ['accountId', 'rgId', 'owner', 'accessGroupId', 'clusterId', 'serviceId'],
  },
  {
    id: 'placement',
    title: 'Размещение',
    icon: 'MapPin',
    keys: ['gridId', 'zoneId', 'defaultZoneId', 'nodeId', 'hypervisorId', 'location'],
  },
  {
    id: 'compute',
    title: 'Вычислительная конфигурация',
    icon: 'Cpu',
    keys: [
      'cpu',
      'memory',
      'chipset',
      'numa',
      'cpuPin',
      'hugepages',
      'architecture',
      'pgpuId',
      'pciAddress',
      'vendor',
      'model',
      'profile',
      'k8ciId',
      'masterCount',
      'workerCount',
      'workerGroupName',
      'maxMasters',
      'maxWorkers',
      'version',
      'autostart',
      'count',
      'features',
    ],
  },
  {
    id: 'storage',
    title: 'Хранение и образ',
    icon: 'HardDrive',
    keys: [
      'size',
      'disk',
      'diskId',
      'policyId',
      'sepId',
      'pool',
      'role',
      'imageId',
      'masterImageId',
      'workerImageId',
      'os',
      'url',
      'vmId',
    ],
  },
  {
    id: 'network',
    title: 'Сеть и подключения',
    icon: 'Network',
    keys: [
      'vinsId',
      'extnetId',
      'cidr',
      'gateway',
      'defaultGateway',
      'defaultNetwork',
      'vlan',
      'vni',
      'startIp',
      'endIp',
      'bridgeNetworkName',
      'hypervisors',
      'portCount',
      'protocol',
      'ethertype',
      'direction',
      'port',
      'portMin',
      'portMax',
      'externalPort',
      'internalPort',
      'internalIp',
      'metric',
      'lbId',
      'backendId',
      'vnfId',
      'algorithm',
      'serverCount',
      'healthPath',
      'weight',
      'check',
      'priority',
      'nativeVlan',
      'bridge',
      'tags',
      'mtu',
      'interface',
      'address',
      'ip',
      'mac',
      'endpoint',
      'segmentId',
      'portId',
      'poolId',
      'routerId',
      'externalNetworkId',
      'networkObjectId',
      'activeVmId',
      'networkPlugin',
      'plugins',
      'floatingIp',
      'network',
      'start',
      'end',
    ],
  },
  {
    id: 'protection',
    title: 'Доступ и защита',
    icon: 'ShieldCheck',
    keys: [
      'securityGroupId',
      'administrativeStatus',
      'locked',
      'replicaPolicyId',
      'replication',
      'highlyAvailable',
      'protected',
      'sshUser',
      'apiAccessId',
      'provider',
      'serviceAccount',
      'userId',
      'email',
      'default',
    ],
  },
  {
    id: 'limits',
    title: 'Лимиты и производительность',
    icon: 'Gauge',
    keys: [
      'cpuQuota',
      'memoryQuota',
      'diskQuota',
      'readIops',
      'writeIops',
      'readBandwidth',
      'writeBandwidth',
      'iops',
    ],
  },
];

export function resourceFieldGroups(entity: PlatformEntity, omitted: string[] = []) {
  const remaining = entity.fields.filter(
    (f) =>
      !['password'].includes(f.kind || '') &&
      !['description', 'id', 'name', 'status', 'createdAt', ...omitted].includes(f.key),
  );
  const groupFor = (field: PlatformField) => {
    if (entity.group === 'storage' && ['type', 'capacity', 'used', 'shared'].includes(field.key))
      return 'storage';
    if (['network', 'sdn'].includes(entity.group) && ['action', 'free'].includes(field.key))
      return 'network';
    if (field.key === 'policyId' && field.reference === 'sdn-policies') return 'protection';
    if (field.key === 'role' && entity.id !== 'volumes') return 'protection';
    if (field.key === 'vmId' && ['network', 'sdn'].includes(entity.group)) return 'network';
    if (field.key === 'vmId' && entity.group === 'infrastructure') return 'compute';
    if (['shareable', 'permissions'].includes(field.key)) return 'protection';
    return groups.find((group) => group.keys.includes(field.key))?.id;
  };
  const assigned = new Set<string>();
  const result: { id: string; title: string; icon: string; fields: PlatformField[] }[] = [];
  for (const group of groups) {
    const fields = remaining.filter((f) => !assigned.has(f.key) && groupFor(f) === group.id);
    if (fields.length) {
      fields.forEach((f) => assigned.add(f.key));
      result.push({
        ...group,
        title:
          group.id === 'storage' && entity.group === 'storage'
            ? 'Хранилище и подключение'
            : group.title,
        fields,
      });
    }
  }
  const rest = remaining.filter((f) => !assigned.has(f.key));
  if (rest.length)
    result.push({
      id: 'parameters',
      title: entity.group === 'operations' ? 'Сведения об операции' : 'Параметры',
      icon: 'Settings2',
      fields: rest,
    });
  return result;
}

// Explicit choices: an arbitrary number in an entity is not automatically a KPI.
export const resourceHighlights: Record<string, { key: string; icon: string }[]> = {
  accounts: [],
  projects: [],
  kubernetes: [
    { key: 'masterCount', icon: 'ServerCog' },
    { key: 'workerCount', icon: 'Server' },
    { key: 'networkPlugin', icon: 'Network' },
  ],
  volumes: [
    { key: 'size', icon: 'HardDrive' },
    { key: 'role', icon: 'Disc3' },
    { key: 'replication', icon: 'ShieldCheck' },
  ],
  images: [
    { key: 'os', icon: 'Package' },
    { key: 'architecture', icon: 'Cpu' },
    { key: 'size', icon: 'HardDrive' },
  ],
  seps: [
    { key: 'capacity', icon: 'Database' },
    { key: 'used', icon: 'HardDrive' },
    { key: 'type', icon: 'Layers3' },
  ],
  'storage-policies': [
    { key: 'pool', icon: 'Database' },
    { key: 'used', icon: 'HardDrive' },
    { key: 'iops', icon: 'Gauge' },
  ],
  networks: [
    { key: 'cidr', icon: 'Network' },
    { key: 'freeIps', icon: 'Waypoints' },
  ],
  'external-networks': [
    { key: 'cidr', icon: 'Network' },
    { key: 'freeIps', icon: 'Waypoints' },
    { key: 'vlan', icon: 'Cable' },
  ],
  nodes: [
    { key: 'cpu', icon: 'Cpu' },
    { key: 'memory', icon: 'CircuitBoard' },
    { key: 'load', icon: 'Gauge' },
  ],
  locations: [
    { key: 'cpuCapacity', icon: 'Cpu' },
    { key: 'memoryCapacity', icon: 'CircuitBoard' },
    { key: 'location', icon: 'MapPin' },
  ],
  pgpu: [
    { key: 'model', icon: 'Microchip' },
    { key: 'memory', icon: 'CircuitBoard' },
    { key: 'allocated', icon: 'Gauge' },
  ],
  'vf-pools': [
    { key: 'capacity', icon: 'Cable' },
    { key: 'allocated', icon: 'Waypoints' },
  ],
  k8ci: [
    { key: 'version', icon: 'Hexagon' },
    { key: 'maxMasters', icon: 'ServerCog' },
    { key: 'maxWorkers', icon: 'Server' },
  ],
  tasks: [
    { key: 'progress', icon: 'Activity' },
    { key: 'startedAt', icon: 'ListTodo' },
  ],
  incidents: [
    { key: 'severity', icon: 'TriangleAlert' },
    { key: 'occurrences', icon: 'Activity' },
  ],
};

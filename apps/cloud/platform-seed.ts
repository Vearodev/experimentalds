import apiOperations from './platform-api.json';
import type { CloudState } from './domain';
import type { PlatformRecord, PlatformState } from './platform-types';

export function seedPlatform(
  core: Pick<CloudState, 'projects' | 'vms' | 'volumes' | 'networks' | 'hosts' | 'clusters'>,
  now = Date.now(),
): PlatformState {
  const date = (days = 0) => new Date(now - days * 86400000).toISOString();
  const records: Record<string, PlatformRecord[]> = {};
  const add = (entity: string, id: string, name: string, values: Partial<PlatformRecord> = {}) => {
    (records[entity] ||= []).push({ id, name, status: 'ENABLED', createdAt: date(12), ...values });
  };
  const prod = core.projects[0]?.id || 'project-prod';
  const dev = core.projects[1]?.id || 'project-dev';
  const dr = core.projects[2]?.id || prod;
  const zone1 = core.clusters[0]?.id || 'cluster-msk-1';
  const zone2 = core.clusters[1]?.id || zone1;
  const zone3 = core.clusters[2]?.id || zone1;
  const host1 = core.hosts[0]?.id || 'host-1';
  const host2 = core.hosts[1]?.id || host1;
  const net1 = core.networks.find((n) => n.projectId === prod)?.id || 'net-prod';
  const vm1 = core.vms[0]?.id || 'vm-1';
  const vm2 = core.vms[1]?.id || vm1;
  add('accounts', 'account-100', 'Базис · Production', {
    status: 'CONFIRMED',
    owner: 'anna.sokolova',
    defaultZoneId: zone1,
    cpuQuota: 256,
    memoryQuota: 1024,
    diskQuota: 16384,
    description: 'Продуктовые сервисы и резервная площадка.',
  });
  add('accounts', 'account-200', 'Инженерная команда', {
    status: 'CONFIRMED',
    owner: 'mikhail.petrov',
    defaultZoneId: zone2,
    cpuQuota: 128,
    memoryQuota: 512,
    diskQuota: 4096,
    description: 'Разработка, тестирование и сборочные системы.',
  });
  add('accounts', 'account-300', 'Исследовательская лаборатория', {
    status: 'CONFIRMED',
    owner: 'elena.volkova',
    defaultZoneId: zone1,
    cpuQuota: 64,
    memoryQuota: 256,
    diskQuota: 2048,
    description: 'Новый аккаунт без развёрнутых ресурсов.',
  });
  core.projects.forEach((p, index) =>
    add('projects', p.id, p.name, {
      accountId: index === 1 ? 'account-200' : 'account-100',
      gridId: index === 2 ? 'grid-2' : 'grid-1',
      defaultNetwork: 'PRIVATE',
      diskQuota: index === 1 ? 2048 : 8192,
    }),
  );
  add('locations', 'grid-1', 'Москва · DC-01', {
    location: 'Москва, M9',
    cpuCapacity: 2048,
    memoryCapacity: 8192,
    sdn: true,
  });
  add('locations', 'grid-2', 'Санкт-Петербург · DR', {
    location: 'Санкт-Петербург',
    cpuCapacity: 1024,
    memoryCapacity: 4096,
    sdn: true,
  });
  core.clusters.forEach((c, index) =>
    add('clusters', c.id, c.name, { gridId: index === 2 ? 'grid-2' : 'grid-1', autostart: true }),
  );
  core.hosts.forEach((h, index) =>
    add('nodes', h.id, h.name, {
      address: `172.16.${h.clusterId === zone3 ? 20 : 10}.${11 + index}`,
      load: [32, 74, 21, 18, 8][index % 5],
      gridId: h.clusterId === zone3 ? 'grid-2' : 'grid-1',
      version: 'DynamiX 4.0',
      description: 'Гипервизор KVM / x86_64.',
    }),
  );
  add('seps', 'sep-1', 'shared-msk-01', {
    gridId: 'grid-1',
    type: 'SHARED',
    endpoint: '172.16.30.10',
    capacity: 80,
    used: 31.4,
    nodeIds: core.hosts.filter((h) => h.clusterId !== zone3).map((h) => h.id),
    description: 'Основное общее хранилище Москвы.',
  });
  add('seps', 'sep-2', 'tatlin-dr-01', {
    gridId: 'grid-2',
    type: 'TATLIN',
    endpoint: '172.16.40.10',
    capacity: 40,
    used: 12.8,
    nodeIds: core.hosts.filter((h) => h.clusterId === zone3).map((h) => h.id),
    description: 'Резервное хранилище площадки DR.',
  });
  add('pools', 'pool-1', 'nvme-production', {
    sepId: 'sep-1',
    type: 'block',
    capacity: 40960,
    used: 19200,
    shared: true,
  });
  add('pools', 'pool-2', 'ssd-general', {
    sepId: 'sep-1',
    type: 'file',
    capacity: 40960,
    used: 12954,
    shared: true,
  });
  add('pools', 'pool-3', 'dr-replica', {
    sepId: 'sep-2',
    type: 'indirect',
    capacity: 40960,
    used: 13107,
    shared: true,
  });
  add('storage-policies', 'policy-1', 'NVMe · Production', {
    sepId: 'sep-1',
    pool: 'nvme-production',
    iops: 20000,
    used: 1840,
    description: 'Низкая задержка для баз данных и основных сервисов.',
  });
  add('storage-policies', 'policy-2', 'SSD · General', {
    sepId: 'sep-1',
    pool: 'ssd-general',
    iops: 5000,
    used: 680,
    description: 'Универсальное размещение виртуальных машин.',
  });
  add('storage-policies', 'policy-3', 'DR · Replica', {
    sepId: 'sep-2',
    pool: 'dr-replica',
    iops: 10000,
    used: 960,
    description: 'Реплики данных и резервные рабочие нагрузки.',
  });
  ['Ubuntu 24.04 LTS', 'Debian 12', 'Rocky Linux 9', 'Windows Server 2022'].forEach((name, index) =>
    add('images', `image-${index + 1}`, name, {
      type: 'OS',
      architecture: 'X86_64',
      os: name,
      size: index === 3 ? 32 : 8,
      policyId: 'policy-2',
      url: `https://images.demo.invalid/${index + 1}.qcow2`,
      description: 'Проверенный базовый образ для облачных машин.',
    }),
  );
  core.vms.forEach((vm, index) =>
    add('vms', vm.id, vm.name, {
      administrativeStatus: 'ENABLED',
      locked: false,
      imageId: `image-${Math.max(1, ['Ubuntu 24.04 LTS', 'Debian 12', 'Rocky Linux 9', 'Windows Server 2022'].indexOf(vm.template) + 1)}`,
      policyId: vm.projectId === dr ? 'policy-3' : vm.projectId === dev ? 'policy-2' : 'policy-1',
      chipset: 'Q35',
      numa: 'none',
      cpuPin: false,
      hugepages: false,
      securityGroupId: vm.projectId === dev ? 'sg-dev' : 'sg-web',
      ...(index < 2 ? { serviceId: 'service-1' } : {}),
      ...(index >= 4 && index <= 6 ? { k8sId: 'k8s-1' } : {}),
    }),
  );
  core.volumes.forEach((v) =>
    add('volumes', v.id, v.name, {
      policyId: v.projectId === dr ? 'policy-3' : v.projectId === dev ? 'policy-2' : 'policy-1',
      sepId: v.projectId === dr ? 'sep-2' : 'sep-1',
      shareable: false,
      readIops: 5000,
      writeIops: 5000,
      readBandwidth: 0,
      writeBandwidth: 0,
      replicaPolicyId: v.projectId === dr ? 'policy-1' : '',
      replication: v.projectId === dr ? 'SYNCED' : 'NONE',
    }),
  );
  core.networks.forEach((n, index) =>
    add('networks', n.id, n.name, {
      extnetId: n.projectId === dr ? 'extnet-2' : 'extnet-1',
      zoneId: n.projectId === dr ? zone3 : n.projectId === dev ? zone2 : zone1,
      defaultGateway: true,
      freeIps: 220 - index * 12,
      description: 'Изолированная сеть ресурсной группы.',
    }),
  );
  add('external-networks', 'extnet-1', 'public-msk', {
    gridId: 'grid-1',
    zoneId: zone1,
    cidr: '198.51.100.0/24',
    gateway: '198.51.100.1',
    vlan: 201,
    freeIps: 182,
    highlyAvailable: true,
  });
  add('external-networks', 'extnet-2', 'public-spb', {
    gridId: 'grid-2',
    zoneId: zone3,
    cidr: '203.0.113.0/24',
    gateway: '203.0.113.1',
    vlan: 202,
    freeIps: 218,
    highlyAvailable: true,
  });
  add('security-groups', 'sg-web', 'web-production', {
    accountId: 'account-100',
    ruleCount: 3,
    description: 'Входящий HTTPS и SSH из управляющей сети.',
  });
  add('security-groups', 'sg-dev', 'development', {
    accountId: 'account-200',
    ruleCount: 2,
    description: 'Доступ из сети инженерной команды.',
  });
  add('security-rules', 'rule-1', 'HTTPS', {
    securityGroupId: 'sg-web',
    direction: 'inbound',
    protocol: 'tcp',
    ethertype: 'IPv4',
    portMin: 443,
    portMax: 443,
    cidr: '0.0.0.0/0',
  });
  add('security-rules', 'rule-2', 'SSH · management', {
    securityGroupId: 'sg-web',
    direction: 'inbound',
    protocol: 'tcp',
    ethertype: 'IPv4',
    portMin: 22,
    portMax: 22,
    cidr: '172.16.0.0/16',
  });
  add('security-rules', 'rule-3', 'Исходящий трафик', {
    securityGroupId: 'sg-web',
    direction: 'outbound',
    protocol: 'any',
    ethertype: 'IPv4',
    cidr: '0.0.0.0/0',
  });
  add('security-rules', 'rule-4', 'SSH · engineering', {
    securityGroupId: 'sg-dev',
    direction: 'inbound',
    protocol: 'tcp',
    ethertype: 'IPv4',
    portMin: 22,
    portMax: 22,
    cidr: '10.21.0.0/24',
  });
  add('security-rules', 'rule-5', 'Исходящий трафик', {
    securityGroupId: 'sg-dev',
    direction: 'outbound',
    protocol: 'any',
    ethertype: 'IPv4',
    cidr: '0.0.0.0/0',
  });
  add('load-balancers', 'lb-1', 'public-api', {
    status: 'STARTED',
    rgId: prod,
    zoneId: zone1,
    vinsId: net1,
    extnetId: 'extnet-1',
    address: '198.51.100.24',
    highlyAvailable: true,
    description: 'Входная точка API и web-приложения.',
  });
  add('lb-backends', 'backend-1', 'api-pool', {
    lbId: 'lb-1',
    algorithm: 'leastconn',
    serverCount: 2,
    healthPath: '/health',
  });
  add('lb-frontends', 'frontend-1', 'https', {
    lbId: 'lb-1',
    address: '198.51.100.24',
    port: 443,
    protocol: 'TCP',
    backendId: 'backend-1',
  });
  add('lb-servers', 'server-1', 'prod-api-01', {
    backendId: 'backend-1',
    address: '10.20.0.11',
    port: 8080,
    weight: 100,
    check: true,
  });
  add('lb-servers', 'server-2', 'prod-api-02', {
    backendId: 'backend-1',
    address: '10.20.0.12',
    port: 8080,
    weight: 100,
    check: true,
  });
  add('flip-groups', 'flip-1', 'postgres-vip', {
    accountId: 'account-100',
    vinsId: net1,
    ip: '10.20.0.100',
    activeVmId: vm1,
    computeCount: 2,
    vmIds: [vm1, vm2],
  });
  add('trunks', 'trunk-1', 'tenant-trunk', {
    bridge: 'br-tenant',
    tags: ['110', '120', '130'],
    nativeVlan: 110,
    mtu: 9000,
  });
  add('dpdk', 'dpdk-1', 'low-latency', {
    gridId: 'grid-1',
    bridge: 'br-dpdk',
    vlan: 310,
    computeCount: 0,
  });
  add('vf-pools', 'vf-1', 'mlx5-production', {
    nodeId: host1,
    interface: 'ens4f0',
    capacity: 32,
    allocated: 8,
  });
  add('vnf-devices', 'vnf-1', 'vins-prod-gw', {
    status: 'STARTED',
    vinsId: net1,
    nodeId: host1,
    address: '172.16.50.10',
    cpu: 2,
    memory: 4,
  });
  add('nat-rules', 'nat-1', 'ssh-bastion', {
    vinsId: net1,
    protocol: 'TCP',
    externalPort: 2222,
    internalIp: '10.20.0.11',
    internalPort: 22,
  });
  add('static-routes', 'route-1', 'Сеть резервной площадки', {
    vinsId: net1,
    cidr: '10.22.0.0/24',
    gateway: '10.20.0.254',
    metric: 100,
  });
  add('static-routes', 'route-2', 'Корпоративная сеть', {
    extnetId: 'extnet-1',
    cidr: '172.20.0.0/16',
    gateway: '198.51.100.2',
    metric: 100,
  });
  add('ip-reservations', 'ip-1', 'prod-api-01', {
    vinsId: net1,
    ip: '10.20.0.11',
    vmId: vm1,
    mac: core.vms[0]?.mac || '52:54:00:20:00:11',
  });
  add('bservices', 'service-1', 'customer-api', {
    status: 'STARTED',
    rgId: prod,
    zoneId: zone1,
    sshUser: 'cloud-user',
    computeCount: 2,
    description: 'Группа прикладных сервисов customer API.',
  });
  add('service-groups', 'sgroup-1', 'api', {
    serviceId: 'service-1',
    count: 2,
    cpu: 4,
    memory: 8,
    imageId: 'image-1',
  });
  add('service-snapshots', 'ssnap-1', 'Перед обновлением 4.2', {
    serviceId: 'service-1',
    createdAt: date(1),
  });
  add('k8ci', 'k8ci-1', 'Kubernetes · stable', {
    version: '1.33.5',
    masterImageId: 'image-1',
    workerImageId: 'image-1',
    maxMasters: 5,
    maxWorkers: 100,
    plugins: ['calico', 'flannel'],
    description: 'Демонстрационная конфигурация кластера.',
  });
  add('kubernetes', 'k8s-1', 'production-k8s', {
    status: 'STARTED',
    rgId: prod,
    k8ciId: 'k8ci-1',
    zoneId: zone1,
    policyId: 'policy-1',
    vinsId: net1,
    networkPlugin: 'calico',
    masterCount: 3,
    workerCount: 3,
    workerGroupName: 'general',
    highlyAvailable: true,
    address: '198.51.100.30',
    description: 'Основной кластер контейнерных нагрузок.',
  });
  add('worker-groups', 'workers-1', 'general', {
    clusterId: 'k8s-1',
    count: 3,
    cpu: 8,
    memory: 16,
    disk: 100,
    labels: ['workload=general', 'environment=production'],
  });
  add('pgpu', 'pgpu-1', 'NVIDIA A40 · 01', {
    nodeId: host1,
    vendor: 'NVIDIA',
    model: 'A40',
    pciAddress: '0000:65:00.0',
    memory: 48,
    allocated: 8,
  });
  add('vgpu', 'vgpu-1', 'ml-lab-gpu', {
    status: 'ALLOCATED',
    rgId: dev,
    pgpuId: 'pgpu-1',
    profile: 'A40-8Q',
    memory: 8,
  });
  add('pci', 'pci-1', 'Mellanox ConnectX-6', {
    nodeId: host1,
    rgId: prod,
    pciAddress: '0000:3b:00.0',
    description: 'Выделенный сетевой адаптер.',
  });
  add('cpu-profiles', 'cpu-1', 'Intel · baseline', {
    zoneId: zone1,
    model: 'Skylake-Server',
    features: ['avx', 'avx2', 'aes'],
  });
  add('optimizer', 'optimizer-1', 'DRS · Москва', {
    status: 'STARTED',
    zoneId: zone1,
    mode: 'Рекомендации',
    recommendations: 1,
    schedule: 'Каждый день, 02:00–05:00',
    nodeIds: [host1, host2],
  });
  add('recommendations', 'recommendation-1', 'Выровнять загрузку CPU', {
    status: 'PENDING',
    optimizerId: 'optimizer-1',
    vmId: vm1,
    targetNodeId: host2,
    reason: 'Неравномерная загрузка узлов в зоне.',
    benefit: 18,
  });
  add('api-access', 'role-admin', 'Администратор платформы', {
    permissions: 742,
    default: false,
    protected: true,
    description: 'Управление инфраструктурой и ресурсами всех аккаунтов.',
  });
  add('api-access', 'role-owner', 'Владелец аккаунта', {
    permissions: 211,
    default: false,
    description: 'Управление ресурсами своего аккаунта.',
  });
  add('api-access', 'role-reader', 'Наблюдатель', {
    permissions: 82,
    default: true,
    description: 'Просмотр ресурсов и журналов без изменения.',
  });
  add('users', 'user-1', 'anna.sokolova', {
    email: 'anna.sokolova@example.test',
    provider: 'bvs',
    apiAccessId: 'role-admin',
    serviceAccount: false,
  });
  add('users', 'user-2', 'mikhail.petrov', {
    email: 'mikhail.petrov@example.test',
    provider: 'bvs',
    apiAccessId: 'role-owner',
    serviceAccount: false,
  });
  add('users', 'user-3', 'ci-deploy', {
    email: 'ci-deploy@example.test',
    provider: 'bvs',
    apiAccessId: 'role-owner',
    serviceAccount: true,
  });
  add('members', 'member-1', 'anna.sokolova', {
    accountId: 'account-100',
    userId: 'user-1',
    role: 'ARCXDU',
  });
  add('members', 'member-2', 'mikhail.petrov', {
    accountId: 'account-200',
    userId: 'user-2',
    role: 'ARCXDU',
  });
  add('members', 'member-3', 'ci-deploy', { rgId: prod, userId: 'user-3', role: 'RCX' });
  add('zero-access', 'session-1', 'Обслуживание сети', {
    status: 'CLOSED',
    userId: 'user-1',
    nodeId: host1,
    startedAt: date(1),
    duration: 24,
    reason: 'Проверка интерфейсов после обновления.',
  });
  add('jobs', 'job-1', 'Подготовка снимка', {
    status: 'SUCCESS',
    method: 'compute.snapshotCreate',
    nodeId: host1,
    startedAt: date(0.2),
    duration: 12,
    heartbeat: date(0.2),
    taskId: 'task-initial-1',
  });
  add('jobs', 'job-2', 'Проверка состояния узла', {
    status: 'SUCCESS',
    method: 'node.health',
    nodeId: host2,
    startedAt: date(0.01),
    duration: 2,
    heartbeat: date(0.01),
  });
  add('incidents', 'eco-1', 'Высокая загрузка узла', {
    status: 'WARNING',
    severity: 'WARNING',
    resource: core.hosts[1]?.name || 'node-02',
    createdAt: date(0.1),
    occurrences: 3,
    description: 'Загрузка CPU превышала заданный порог. Проверьте размещение рабочих нагрузок.',
  });
  add('incidents', 'eco-2', 'Ошибка запуска ВМ', {
    status: 'ERROR',
    severity: 'ERROR',
    resource: core.vms.find((v) => v.status === 'error')?.name || 'prod-worker-02',
    createdAt: date(0.05),
    occurrences: 1,
    description: 'Гипервизор не подтвердил запуск. Проверьте доступность узла и дисков.',
  });
  ['API', 'Планировщик', 'Хранилища', 'Сеть SDN', 'Агенты'].forEach((service, index) =>
    add('health', `health-${index}`, service, {
      status: index === 4 ? 'DEGRADED' : 'HEALTHY',
      service,
      nodeId: index === 4 ? host2 : host1,
      latency: [12, 8, 24, 9, 78][index],
      checkedAt: date(),
      description: index === 4 ? 'Один узел на обслуживании.' : 'Проверка выполнена успешно.',
    }),
  );
  core.vms.slice(0, 6).forEach((vm, index) =>
    add(
      'audits',
      `audit-${index + 1}`,
      ['Изменение машины', 'Создание снимка', 'Запуск машины'][index % 3],
      {
        status: 'SUCCESS',
        actor: index % 2 ? 'ci-deploy' : 'anna.sokolova',
        operation: ['compute.update', 'compute.snapshotCreate', 'compute.start'][index % 3],
        resource: vm.name,
        resourceId: vm.id,
        entity: 'vms',
        accountId: vm.projectId === dev ? 'account-200' : 'account-100',
        rgId: vm.projectId,
        createdAt: date(index * 0.04),
        responseCode: 200,
      },
    ),
  );
  add('sdn-access', 'sdn-access-1', 'Production SDN', {
    accountId: 'account-100',
    description: 'Сетевой контур продуктовых сервисов.',
  });
  add('sdn-segments', 'segment-1', 'app-segment', {
    accessGroupId: 'sdn-access-1',
    cidr: '10.60.0.0/24',
    vni: 10001,
    mtu: 1500,
  });
  add('sdn-segments', 'segment-2', 'data-segment', {
    accessGroupId: 'sdn-access-1',
    cidr: '10.61.0.0/24',
    vni: 10002,
    mtu: 1500,
  });
  add('sdn-l2-external', 'l2-network-1', 'physical-production', {
    accessGroupId: 'sdn-access-1',
    bridgeNetworkName: 'br-provider',
    vlan: 320,
    hypervisors: ['sdn-msk-01'],
    description: 'Выход в физическую L2-сеть площадки.',
  });
  add('sdn-hypervisors', 'hypervisor-1', 'sdn-msk-01', {
    status: 'ONLINE',
    nodeId: host1,
    address: '172.16.60.11',
    portCount: 2,
    version: '4.0',
  });
  add('sdn-ports', 'port-1', 'api-port', {
    accessGroupId: 'sdn-access-1',
    segmentId: 'segment-1',
    ip: '10.60.0.11',
    mac: '52:54:00:60:00:11',
    hypervisorId: 'hypervisor-1',
    vmId: vm1,
  });
  add('sdn-ports', 'port-2', 'data-port', {
    accessGroupId: 'sdn-access-1',
    segmentId: 'segment-2',
    ip: '10.61.0.11',
    mac: '52:54:00:61:00:11',
    hypervisorId: 'hypervisor-1',
    vmId: vm2,
  });
  add('sdn-networks', 'network-object-1', 'application-ports', {
    accessGroupId: 'sdn-access-1',
    portCount: 2,
    portIds: ['port-1', 'port-2'],
  });
  add('sdn-external', 'sdn-ext-1', 'sdn-uplink', {
    accessGroupId: 'sdn-access-1',
    cidr: '192.0.2.0/24',
    gateway: '192.0.2.1',
  });
  add('sdn-routers', 'router-1', 'application-router', {
    accessGroupId: 'sdn-access-1',
    externalNetworkId: 'sdn-ext-1',
  });
  add('sdn-router-ports', 'router-port-1', 'app-gateway', {
    routerId: 'router-1',
    segmentId: 'segment-1',
    ip: '10.60.0.1',
  });
  add('sdn-router-ports', 'router-port-2', 'data-gateway', {
    routerId: 'router-1',
    segmentId: 'segment-2',
    ip: '10.61.0.1',
  });
  add('static-routes', 'route-3', 'Маршрут по умолчанию', {
    routerId: 'router-1',
    cidr: '0.0.0.0/0',
    gateway: '192.0.2.1',
    metric: 100,
  });
  add('sdn-address-pools', 'address-pool-1', 'floating-addresses', {
    accessGroupId: 'sdn-access-1',
    cidr: '192.0.2.0/24',
    startIp: '192.0.2.10',
    endIp: '192.0.2.100',
    free: 89,
  });
  add('sdn-floating-ips', 'floating-1', 'api-public', {
    accessGroupId: 'sdn-access-1',
    poolId: 'address-pool-1',
    portId: 'port-1',
    ip: '192.0.2.10',
  });
  add('sdn-policies', 'sdn-policy-1', 'application-policy', {
    accessGroupId: 'sdn-access-1',
    networkObjectId: 'network-object-1',
    priority: 100,
  });
  add('sdn-rules', 'sdn-rule-1', 'HTTPS ingress', {
    policyId: 'sdn-policy-1',
    direction: 'inbound',
    action: 'allow',
    protocol: 'tcp',
    port: 443,
    cidr: '0.0.0.0/0',
    priority: 100,
  });
  for (const role of records['api-access']) {
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
  return { revision: 2, mode: 'admin', accountId: 'account-100', records, removed: [] };
}

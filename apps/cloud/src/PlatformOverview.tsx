import { csvCell } from './csv';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Download,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import {
  Accordion,
  Badge,
  Button,
  ContextPanel,
  Message,
  Progress,
  StatusBadge,
  Tabs,
  Tag,
} from '@basis/ui';
import { platformEntity, platformStatusLabels, platformTone } from '../platform-catalog';
import {
  canChangePlatform,
  listPlatformRecords,
  platformState,
  platformUsage,
  scopeContains,
  scopeLabel,
  visiblePlatformRecords,
} from '../platform-model';
import { useCloud } from './cloud-state';
import { Capacity, Empty, navigate, PageTitle, Panel, ResourceMark, VmState } from './parts';
import { PlatformRegistry } from './PlatformPage';
import { ResourceTable } from './ResourceTable';
import apiSource from '../platform-api.json';
type ApiOperation = {
  id: string;
  method: string;
  name: string;
  summary: string;
  namespace: string;
  group: string;
  parameters: {
    name: string;
    type?: string | string[];
    required: boolean;
    description: string;
    values?: (string | number | boolean)[];
  }[];
};
const api = apiSource as ApiOperation[];

export function PlatformOverview() {
  const { data: source, scope, setScope } = useCloud(),
    data = source!;
  const vms = data.vms.filter((vm) => scopeContains(data, scope, vm.projectId));
  const usage = platformUsage(data, scope);
  const accounts = visiblePlatformRecords(data, 'accounts', scope),
    groups = visiblePlatformRecords(data, 'projects', scope);
  const isGroup = data.projects.some((r) => r.id === scope),
    isAccount = scope !== 'all' && !isGroup;
  const problems = vms.filter(
    (vm) => vm.status === 'error' || (vm.status === 'running' && vm.cpuUsage > 85),
  );
  const recent = visiblePlatformRecords(data, 'tasks', scope).slice(0, 5);
  return (
    <>
      <PageTitle
        eyebrow={
          scope === 'all' ? 'Рабочее пространство' : isGroup ? 'Ресурсная группа' : 'Аккаунт'
        }
        title={scope === 'all' ? 'Обзор облака' : scopeLabel(data, scope)}
        description="Ресурсы, доступная ёмкость и операции в вашей рабочей области."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus />}
            disabled={Boolean(canChangePlatform(data, 'vms'))}
            onClick={() => navigate('create')}
          >
            Создать машину
          </Button>
        }
      />
      <div className="cloud-overview-ribbon">
        <span>
          <span className="cloud-live-dot" />
          Зоны: {visiblePlatformRecords(data, 'clusters').length}
        </span>
        <span>
          <Building2 size={14} />
          Аккаунты: {accounts.length} · Группы: {groups.length}
        </span>
        <span>
          <ShieldCheck size={14} />С защитой: {vms.filter((vm) => vm.backup).length} ВМ
        </span>
        <Tag tone="info">
          {platformState(data).mode === 'admin'
            ? 'Администратор'
            : platformState(data).mode === 'reader'
              ? 'Наблюдатель'
              : 'Участник аккаунта'}
        </Tag>
      </div>
      <div className="cloud-metrics">
        <article className="cloud-machine-total">
          <div>
            <Server size={16} />
            <span>Виртуальные машины</span>
          </div>
          <strong>
            {vms.length}
            <small>всего</small>
          </strong>
          <div>
            <span>
              <i data-tone="success" />
              {vms.filter((vm) => vm.status === 'running').length} работают
            </span>
            <span>
              <i />
              {vms.filter((vm) => vm.status === 'stopped').length} выключены
            </span>
          </div>
        </article>
        <Capacity type="cpu" value={usage.cpu} total={usage.cpuQuota} />
        <Capacity type="memory" value={usage.memory} total={usage.memoryQuota} />
        <Capacity type="disk" value={usage.disk} total={usage.diskQuota} />
      </div>
      {problems.length > 0 && (
        <div className="cloud-attention">
          <span>
            <Activity size={17} />
            <strong>Требуют внимания</strong>
            <Badge count={problems.length} tone="warning" />
          </span>
          {problems.map((vm) => (
            <Button
              key={vm.id}
              variant="ghost"
              size="sm"
              tone={vm.status === 'error' ? 'danger' : 'warning'}
              trailingIcon={<ArrowUpRight />}
              onClick={() => navigate(`vms/${vm.id}`)}
            >
              {vm.name} · {vm.status === 'error' ? 'ошибка запуска' : `CPU ${vm.cpuUsage}%`}
            </Button>
          ))}
        </div>
      )}
      <div className="cloud-overview-grid">
        <Panel
          title={isGroup ? 'Виртуальные машины' : isAccount ? 'Ресурсные группы' : 'Аккаунты'}
          subtitle={
            isGroup
              ? 'Вычисления в выбранной группе'
              : 'От рабочей области — к её ресурсам и квотам'
          }
          action={
            <Button
              size="sm"
              variant="ghost"
              trailingIcon={<ArrowRight />}
              onClick={() => navigate(isGroup ? 'vms' : isAccount ? 'projects' : 'accounts')}
            >
              Открыть реестр
            </Button>
          }
        >
          {isGroup ? (
            <div className="cloud-vm-overview-list">
              {vms.slice(0, 6).map((vm) => (
                <a key={vm.id} href={`#cloud/vms/${vm.id}`}>
                  <ResourceMark />
                  <span>
                    <strong>{vm.name}</strong>
                    <small>
                      {vm.cpu} vCPU · {vm.memory} GiB · {vm.ip}
                    </small>
                  </span>
                  <VmState vm={vm} />
                </a>
              ))}
              {!vms.length && (
                <Empty
                  title="Группа готова к работе"
                  description="Создайте сеть ViNS и добавьте первую машину."
                  action={<Button onClick={() => navigate('networks')}>Создать сеть</Button>}
                />
              )}
            </div>
          ) : (
            <div className="cloud-project-overview">
              {(isAccount ? groups : accounts).map((record) => {
                const value = platformUsage(data, record.id);
                return (
                  <article key={record.id}>
                    <div>
                      <ResourceMark kind="cloud" />
                      <a href={`#cloud/${isAccount ? 'projects' : 'accounts'}/${record.id}`}>
                        <strong>{record.name}</strong>
                        <span>{record.description}</span>
                      </a>
                      <StatusBadge tone={platformTone(record.status)}>
                        {platformStatusLabels[record.status] || record.status}
                      </StatusBadge>
                    </div>
                    <div>
                      <span>{value.vms.length} ВМ</span>
                      <span>
                        {value.cpu} / {value.cpuQuota} vCPU
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        trailingIcon={<ArrowRight />}
                        onClick={() => setScope(record.id)}
                      >
                        В область
                      </Button>
                    </div>
                    <Progress
                      label={`Квота CPU · ${record.name}`}
                      value={value.cpuQuota ? (value.cpu / value.cpuQuota) * 100 : 0}
                      compact
                    />
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
        <div className="platform-overview-aside">
          <Panel
            title="Последние операции"
            action={
              <Button
                size="sm"
                variant="ghost"
                trailingIcon={<ArrowRight />}
                onClick={() => navigate('tasks')}
              >
                Все задачи
              </Button>
            }
          >
            <div className="platform-event-list">
              {recent.map((task) => (
                <a key={task.id} href={`#cloud/tasks/${task.id}`}>
                  <span>
                    <strong>{task.name}</strong>
                    <small>{String(task.resource || '')}</small>
                  </span>
                  <StatusBadge tone={platformTone(task.status)}>
                    {platformStatusLabels[task.status]}
                  </StatusBadge>
                </a>
              ))}
            </div>
          </Panel>
          <Panel title="Связанные ресурсы" subtitle="Одна рабочая область для всех сервисов">
            <div className="platform-resource-shortcuts">
              {[
                'volumes',
                'networks',
                'kubernetes',
                'load-balancers',
                'security-groups',
                'storage-policies',
              ].map((id) => (
                <a key={id} href={`#cloud/${id}`}>
                  <span>{platformEntity(id)!.label}</span>
                  <strong>{visiblePlatformRecords(data, id, scope).length}</strong>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function ApiCatalog() {
  const [namespace, setNamespace] = useState('cloudapi'),
    [selected, setSelected] = useState<{ row: ApiOperation; anchor: HTMLElement } | null>(null);
  return (
    <>
      <Tabs
        value={namespace}
        onValueChange={setNamespace}
        items={['cloudapi', 'cloudbroker', 'system', 'sdn'].map((id) => ({
          id,
          label:
            {
              cloudapi: 'Пользовательский API',
              cloudbroker: 'Администрирование',
              system: 'Система',
              sdn: 'SDN',
            }[id] || id,
          count: api.filter((op) => op.namespace === id).length,
        }))}
      />
      <div className="platform-tab-content">
        <ResourceTable
          tableId={`api:${namespace}`}
          caption="Методы API"
          rows={api.filter((op) => op.namespace === namespace)}
          placeholder="Название метода или описание"
          previewRowId={selected?.row.id}
          onRowActivate={(row, anchor) => setSelected({ row, anchor })}
          columns={[
            {
              id: 'name',
              header: 'Метод',
              description: 'Путь метода из OpenAPI исходного проекта.',
              width: 340,
              pinned: 'start',
              value: (r) => r.name,
              render: (r) => <span className="cloud-mono">{r.name}</span>,
            },
            {
              id: 'httpMethod',
              header: 'HTTP',
              description: 'HTTP-метод запроса. Один путь может поддерживать несколько операций.',
              width: 160,
              kind: 'enum',
              options: [...new Set(api.map((op) => op.method))].map((value) => ({
                value,
                label: value,
              })),
              value: (r) => r.method,
              render: (r) => <Tag>{r.method}</Tag>,
            },
            {
              id: 'group',
              header: 'Объект',
              description: 'Группа методов API.',
              width: 200,
              kind: 'enum',
              options: [
                ...new Set(api.filter((op) => op.namespace === namespace).map((op) => op.group)),
              ].map((value) => ({ value, label: value })),
              value: (r) => r.group,
              render: (r) => r.group,
            },
            {
              id: 'summary',
              header: 'Назначение',
              width: 470,
              value: (r) => r.summary,
              render: (r) => r.summary,
            },
            {
              id: 'parameters',
              header: 'Параметров',
              description: 'Количество входных параметров метода.',
              width: 140,
              kind: 'number',
              value: (r) => r.parameters.length,
              render: (r) => r.parameters.length,
            },
          ]}
        />
      </div>
      {selected && (
        <ContextPanel
          icon={<Server />}
          open
          presentation="drawer"
          anchor={selected.anchor}
          title={selected.row.name}
          description={selected.row.summary}
          onClose={() => setSelected(null)}
          footer={<Button onClick={() => setSelected(null)}>Закрыть</Button>}
        >
          <div className="platform-form">
            <Message title="Справочник исходной платформы" compact>
              Методы не выполняются из демо. Описания и параметры получены из OpenAPI проекта.
            </Message>
            <Tag>{selected.row.method}</Tag>
            <dl className="platform-api-parameters">
              {selected.row.parameters.map((parameter) => (
                <div key={parameter.name}>
                  <dt>
                    <strong>{parameter.name}</strong>
                    <Tag>{String(parameter.type || 'object')}</Tag>
                    {parameter.required && <Tag tone="warning">Обязательный</Tag>}
                  </dt>
                  <dd>
                    {parameter.description}
                    {parameter.values && <p>{parameter.values.join(' · ')}</p>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </ContextPanel>
      )}
    </>
  );
}
export function PlatformServicePage({ section }: { section: string }) {
  const { data: source, refresh, working } = useCloud(),
    data = source!;
  const [view, setView] = useState('accounts'),
    [expanded, setExpanded] = useState<string[]>(['task']);
  const entity = platformEntity(section)!;
  if (entity.admin && platformState(data).mode !== 'admin')
    return <Empty title="Раздел доступен администратору" />;
  if (section === 'api')
    return (
      <>
        <PageTitle
          title="Справочник API"
          description={`${api.length.toLocaleString('ru-RU')} методов исходного проекта. Поиск по сущности, операции и назначению.`}
        />
        <ApiCatalog />
      </>
    );
  if (section === 'statistics') {
    const rows = listPlatformRecords(data, view).map((row) => ({
      id: row.id,
      name: row.name,
      ...platformUsage(data, row.id),
    }));
    return (
      <>
        <PageTitle
          title="Использование ресурсов"
          description="Выделенные ресурсы и остаток квот по аккаунтам и ресурсным группам."
          actions={
            <Button
              leadingIcon={<Download />}
              onClick={() => {
                const blob = new Blob(
                  [
                    '\uFEFFОбласть;ВМ;vCPU;Память GiB;Диски GiB\n' +
                      rows
                        .map((r) => [r.name, r.vms, r.cpu, r.memory, r.disk].map(csvCell).join(';'))
                        .join('\n'),
                  ],
                  { type: 'text/csv;charset=utf-8' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'capacity.csv';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Экспорт
            </Button>
          }
        />
        <Tabs
          value={view}
          onValueChange={setView}
          items={[
            { id: 'accounts', label: 'По аккаунтам' },
            { id: 'projects', label: 'По ресурсным группам' },
          ]}
        />
        <div className="platform-tab-content">
          <ResourceTable
            tableId={`statistics:${view}`}
            rows={rows}
            caption="Использование ресурсов"
            columns={[
              {
                id: 'name',
                header: 'Рабочая область',
                width: 280,
                value: (r) => r.name,
                render: (r) => (
                  <a className="platform-resource-link" href={`#cloud/${view}/${r.id}`}>
                    {r.name}
                  </a>
                ),
              },
              {
                id: 'vms',
                header: 'Машины',
                width: 130,
                kind: 'number',
                value: (r) => r.vms.length,
                render: (r) => r.vms.length,
              },
              ...(['cpu', 'memory', 'disk'] as const).map((key) => ({
                id: key,
                header: { cpu: 'vCPU', memory: 'Память, GiB', disk: 'Диски, GiB' }[key],
                width: 230,
                kind: 'number' as const,
                value: (r: (typeof rows)[number]) => r[key],
                render: (r: (typeof rows)[number]) => (
                  <Progress
                    compact
                    label={`${r[key]} из ${r[(key + 'Quota') as 'cpuQuota']}`}
                    value={
                      r[(key + 'Quota') as 'cpuQuota']
                        ? (r[key] / r[(key + 'Quota') as 'cpuQuota']) * 100
                        : 0
                    }
                  />
                ),
              })),
            ]}
          />
        </div>
      </>
    );
  }
  if (section === 'health')
    return (
      <>
        <PageTitle
          title="Здоровье платформы"
          description="Контроль сервисов управления, хранения и виртуализации."
          actions={
            <Button loading={working} leadingIcon={<RefreshCw />} onClick={() => void refresh()}>
              Обновить
            </Button>
          }
        />
        <div className="platform-health-grid">
          {listPlatformRecords(data, 'health').map((row) => (
            <article className="cloud-panel platform-health-card" key={row.id}>
              <span>
                <ShieldCheck size={19} />
                <StatusBadge tone={platformTone(row.status)}>
                  {platformStatusLabels[row.status]}
                </StatusBadge>
              </span>
              <h2>{row.name}</h2>
              <p>{row.description}</p>
              <small>{String(row.endpoint || row.zone || 'Управляющий контур')}</small>
            </article>
          ))}
        </div>
        <PlatformRegistry entity={platformEntity('incidents')!} />
      </>
    );
  return (
    <>
      <PageTitle
        title="Помощь и поддержка"
        description="Диагностика, документация и сведения о демонстрационной среде."
      />
      <div className="platform-detail-grid">
        <Panel title="Перед обращением в поддержку">
          <Accordion
            value={expanded}
            onValueChange={setExpanded}
            items={[
              {
                id: 'task',
                title: 'Операция завершилась ошибкой',
                content: (
                  <p>
                    Откройте задачу, проверьте причину и связанный ресурс. После устранения причины
                    повторите задачу из её меню. <a href="#cloud/tasks">Открыть задачи</a>
                  </p>
                ),
              },
              {
                id: 'access',
                title: 'Не видно ресурса или раздела',
                content: (
                  <p>
                    Проверьте выбранный аккаунт и ресурсную группу. Администратор видит
                    инфраструктуру целиком; участник — ресурсы своего аккаунта. Роль «Наблюдатель»
                    разрешает просмотр.
                  </p>
                ),
              },
              {
                id: 'network',
                title: 'Недоступна сеть виртуальной машины',
                content: (
                  <p>
                    Проверьте ViNS, адрес интерфейса, маршруты и правила группы безопасности.{' '}
                    <a href="#cloud/networks">Открыть сети ViNS</a>
                  </p>
                ),
              },
              {
                id: 'catalog',
                title: 'API и автоматизация',
                content: (
                  <p>
                    Справочник содержит методы и параметры из исходного OpenAPI.{' '}
                    <a href="#cloud/api">Открыть справочник</a>
                  </p>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Демонстрационная среда">
          <div className="platform-form">
            <Tag tone="info">BASIS Cloud · 0.7.0</Tag>
            <p>
              Изолированные ресурсы, фоновые задачи и аудит. Все изменения выполняются в
              мок-сервере.
            </p>
            <Message title="Функциональная основа">
              Базис.DynamiX: аккаунты, ресурсные группы, вычисления, хранение, ViNS, SDN и
              инфраструктура.
            </Message>
            <Button trailingIcon={<ArrowRight />} onClick={() => navigate('api')}>
              Открыть API
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

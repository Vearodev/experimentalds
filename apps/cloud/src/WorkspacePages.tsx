import { platformState } from '../platform-model';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  HardDrive,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Input,
  InputMask,
  Message,
  PasswordInput,
  Progress,
  RadioButton,
  Select,
  Slider,
  StatusBadge,
  Switch,
  Tabs,
  Tag,
  Tooltip,
} from '@basis/ui';
import { useDesign } from '../../playground/src/DesignContext';
import { useCloud } from './cloud-state';
import { offline, ApiError } from './api';
import { projectUsage, type Host, type Task } from '../domain';
import {
  Capacity,
  date,
  Empty,
  navigate,
  PageTitle,
  Panel,
  PlainTable,
  ResourceMark,
  VmState,
} from './parts';
import { ResourceForm } from './ResourcePages';
import { VmTable } from './VmTable';
import { canAct } from './VmActions';
import type { RegistryColumn } from './registry-model';

export function OverviewPage() {
  const { data: source, scope, setScope } = useCloud(),
    data = source!;
  const vms = data.vms.filter((vm) => scope === 'all' || vm.projectId === scope),
    projects = data.projects.filter((p) => scope === 'all' || p.id === scope),
    current = data.projects.find((p) => p.id === scope);
  const cpu = vms.reduce((n, vm) => n + vm.cpu, 0),
    memory = vms.reduce((n, vm) => n + vm.memory, 0),
    volumes = data.volumes.filter((v) => scope === 'all' || v.projectId === scope),
    disk = volumes.reduce((n, v) => n + v.size, 0);
  const tasks = data.tasks.filter((t) => scope === 'all' || t.projectId === scope),
    problems = vms.filter(
      (vm) => vm.status === 'error' || (vm.cpuUsage > 85 && vm.status === 'running'),
    );
  return (
    <>
      <PageTitle
        title={current ? current.name : 'Обзор инфраструктуры'}
        description={
          current?.description || 'Состояние облака, доступная ёмкость и текущие операции.'
        }
        actions={
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('create')}>
            Создать машину
          </Button>
        }
      />
      <div className="cloud-overview-ribbon">
        <span>
          <span className="cloud-live-dot" />
          {data.hosts.filter((h) => !h.maintenance).length} хоста доступны
        </span>
        <span>
          <MapPin size={14} />2 региона
        </span>
        <span>
          <ShieldCheck size={14} />
          {vms.filter((vm) => vm.backup).length} машин с политикой защиты
        </span>
        <Tag tone="info">{scope === 'all' ? 'Все проекты' : 'Проект'}</Tag>
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
              {vms.filter((v) => v.status === 'running').length} работают
            </span>
            <span>
              <i />
              {vms.filter((v) => v.status === 'stopped').length} выключены
            </span>
          </div>
        </article>
        <Capacity
          type="cpu"
          value={cpu}
          total={
            current?.cpuQuota ||
            data.hosts.filter((h) => !h.maintenance).reduce((n, h) => n + h.cpu, 0)
          }
        />
        <Capacity
          type="memory"
          value={memory}
          total={
            current?.memoryQuota ||
            data.hosts.filter((h) => !h.maintenance).reduce((n, h) => n + h.memory, 0)
          }
        />
        <Capacity type="disk" value={disk} total={scope === 'all' ? 8192 : 4096} />
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
          title={current ? 'Машины проекта' : 'Рабочие области'}
          subtitle={
            current ? 'Ресурсы выбранной рабочей области' : 'От проекта — к его ресурсам и квотам'
          }
          action={
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowRight />}
              onClick={() => navigate(current ? 'vms' : 'projects')}
            >
              {current ? 'Все машины' : 'Все проекты'}
            </Button>
          }
        >
          {current ? (
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
                  title="Первый ресурс начинается здесь"
                  description="Добавьте сеть, затем создайте машину в проекте."
                  action={<Button onClick={() => navigate('networks')}>Перейти к сетям</Button>}
                />
              )}
            </div>
          ) : (
            <div className="cloud-project-overview">
              {projects.map((p) => {
                const usage = projectUsage(data, p.id);
                return (
                  <article key={p.id}>
                    <div>
                      <ResourceMark kind="cloud" />
                      <a href="#cloud/overview" onClick={() => setScope(p.id)}>
                        <strong>{p.name}</strong>
                        <span>{p.description}</span>
                      </a>
                      <ArrowUpRight size={16} />
                    </div>
                    <div>
                      <span>Машины: {data.vms.filter((v) => v.projectId === p.id).length}</span>
                      <span>
                        {usage.cpu} / {p.cpuQuota} vCPU
                      </span>
                      <AvatarGroup members={p.members.map((name) => ({ name }))} max={3} />
                    </div>
                    <Progress
                      label={`Квота CPU · ${p.name}`}
                      value={(usage.cpu / p.cpuQuota) * 100}
                      compact
                    />
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel
          title="Размещение"
          subtitle="Регионы → кластеры → хосты"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('clusters')}>
              Открыть
            </Button>
          }
        >
          <div className="cloud-topology">
            {[...new Set(data.clusters.map((c) => c.region))].map((region) => (
              <section key={region}>
                <h3>
                  <MapPin size={16} />
                  {region}
                </h3>
                {data.clusters
                  .filter((c) => c.region === region)
                  .map((c) => (
                    <a key={c.id} href={`#cloud/clusters/${c.id}`}>
                      <span>
                        <strong>{c.name.split(' / ')[1]}</strong>
                        <small>
                          {data.hosts.filter((h) => h.clusterId === c.id && !h.maintenance).length}{' '}
                          доступно / {data.hosts.filter((h) => h.clusterId === c.id).length} хоста
                        </small>
                      </span>
                      <span className="cloud-host-grid">
                        {data.hosts
                          .filter((h) => h.clusterId === c.id)
                          .map((h) => (
                            <span
                              key={h.id}
                              title={`${h.name}${h.maintenance ? ' · обслуживание' : ''}`}
                              data-maintenance={h.maintenance}
                            >
                              <Server size={15} />
                            </span>
                          ))}
                      </span>
                      <ArrowUpRight size={14} />
                    </a>
                  ))}
              </section>
            ))}
          </div>
          <div className="cloud-topology-note">
            <span className="cloud-live-dot" />
            Инфраструктура доступна<span>1 хост на обслуживании</span>
          </div>
        </Panel>
      </div>
      <Panel
        title="Последние операции"
        subtitle="Результат и прогресс сохраняются в журнале"
        action={
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight />}
            onClick={() => navigate('tasks')}
          >
            Журнал задач
          </Button>
        }
      >
        <TaskList tasks={tasks.slice(0, 4)} />
      </Panel>
    </>
  );
}
export function ProjectsPage() {
  const { data: source, setScope } = useCloud(),
    data = source!;
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageTitle
        title="Проекты"
        description="Рабочие области с собственными квотами, сетями, машинами и участниками."
        actions={
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreate(true)}>
            Новый проект
          </Button>
        }
      />
      <div className="cloud-project-grid">
        {data.projects.map((p) => {
          const usage = projectUsage(data, p.id);
          return (
            <article key={p.id} className="cloud-project-card">
              <header>
                <ResourceMark kind="cloud" />
                <Tag tone={p.environment === 'production' ? 'info' : 'neutral'}>
                  {p.environment}
                </Tag>
              </header>
              <h2>{p.name}</h2>
              <p>{p.description || 'Новая рабочая область'}</p>
              <div className="cloud-project-statline">
                <span>
                  <Server size={15} />
                  Машины: {data.vms.filter((vm) => vm.projectId === p.id).length}
                </span>
                <span>
                  <HardDrive size={15} />
                  Диски: {data.volumes.filter((v) => v.projectId === p.id).length}
                </span>
              </div>
              <Progress
                label="Квота vCPU"
                compact
                value={(usage.cpu / p.cpuQuota) * 100}
                description={`${usage.cpu} из ${p.cpuQuota} vCPU`}
              />
              <Progress
                label="Квота памяти"
                compact
                value={(usage.memory / p.memoryQuota) * 100}
                description={`${usage.memory} из ${p.memoryQuota} GiB`}
              />
              <footer>
                <AvatarGroup members={p.members.map((name) => ({ name }))} max={3} />
                <Button
                  trailingIcon={<ArrowRight />}
                  size="sm"
                  onClick={() => {
                    setScope(p.id);
                    navigate('overview');
                  }}
                >
                  Открыть проект
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
      {create && <ResourceForm kind="projects" onClose={() => setCreate(false)} />}
    </>
  );
}
export function ClustersPage({ id }: { id?: string }) {
  const { data: source } = useCloud(),
    data = source!,
    cluster = data.clusters.find((c) => c.id === id);
  const [tab, setTab] = useState('overview');
  const hostColumns: RegistryColumn<Host>[] = [
    {
      id: 'cluster',
      header: 'Кластер',
      width: 180,
      kind: 'enum',
      hidden: !!id,
      value: (h) => h.clusterId,
      options: data.clusters.map((c) => ({ value: c.id, label: c.name })),
      description: 'Кластер, в котором размещён физический сервер.',
      render: (h) => (
        <a href={`#cloud/clusters/${h.clusterId}`}>
          {data.clusters.find((c) => c.id === h.clusterId)?.name}
        </a>
      ),
    },
    {
      id: 'name',
      value: (h) => h.name,
      pinned: 'start',
      description: 'Физический сервер кластера.',
      header: 'Хост',
      width: 200,
      render: (h) => (
        <span className="cloud-resource-cell">
          <Server size={16} />
          <strong>{h.name}</strong>
        </span>
      ),
    },
    {
      id: 'status',
      kind: 'enum',
      value: (h) => (h.maintenance ? 'maintenance' : 'available'),
      options: [
        { value: 'available', label: 'Доступен' },
        { value: 'maintenance', label: 'Обслуживание' },
      ],
      description: 'Хост на обслуживании не принимает новые машины.',
      header: 'Состояние',
      width: 200,
      render: (h) => (
        <StatusBadge tone={h.maintenance ? 'warning' : 'success'}>
          {h.maintenance ? 'Обслуживание' : 'Доступен'}
        </StatusBadge>
      ),
    },
    {
      id: 'cpu',
      kind: 'number',
      value: (h) => data.vms.filter((v) => v.hostId === h.id).reduce((n, v) => n + v.cpu, 0),
      unit: 'vCPU',
      description: 'Выделенные vCPU / физическая ёмкость. Фильтр по выделенным ресурсам.',
      header: 'Процессоры',
      width: 140,
      render: (h) =>
        `${data.vms.filter((v) => v.hostId === h.id).reduce((n, v) => n + v.cpu, 0)} / ${h.cpu} vCPU`,
    },
    {
      id: 'memory',
      kind: 'number',
      value: (h) => data.vms.filter((v) => v.hostId === h.id).reduce((n, v) => n + v.memory, 0),
      unit: 'GiB',
      description: 'Выделенная память / ёмкость хоста. Фильтр по выделенной памяти.',
      header: 'Память',
      width: 140,
      render: (h) =>
        `${data.vms.filter((v) => v.hostId === h.id).reduce((n, v) => n + v.memory, 0)} / ${h.memory} GiB`,
    },
    {
      id: 'vms',
      kind: 'number',
      value: (h) => data.vms.filter((v) => v.hostId === h.id).length,
      description: 'Количество размещённых машин.',
      header: 'Машины',
      width: 110,
      align: 'right',
      render: (h) => data.vms.filter((v) => v.hostId === h.id).length,
    },
  ];
  if (!id)
    return (
      <>
        <PageTitle
          title="Кластеры и хосты"
          description="Размещение ресурсов, доступная ёмкость и состояние физических узлов."
        />
        <div className="cloud-cluster-grid">
          {data.clusters.map((c) => {
            const hosts = data.hosts.filter((h) => h.clusterId === c.id),
              vms = data.vms.filter((v) => hosts.some((h) => h.id === v.hostId));
            return (
              <Panel
                key={c.id}
                title={c.name}
                subtitle={`${c.region} · ${c.description}`}
                action={
                  <Button size="sm" onClick={() => navigate(`clusters/${c.id}`)}>
                    Открыть
                  </Button>
                }
              >
                <div className="cloud-cluster-hosts">
                  {hosts.map((h) => (
                    <div key={h.id} data-maintenance={h.maintenance}>
                      <Server />
                      <strong>{h.name}</strong>
                      <span>{h.maintenance ? 'Обслуживание' : 'Доступен'}</span>
                    </div>
                  ))}
                </div>
                <Progress
                  label="Выделено vCPU"
                  compact
                  value={
                    (vms.reduce((n, v) => n + v.cpu, 0) / hosts.reduce((n, h) => n + h.cpu, 0)) *
                    100
                  }
                  description={`Машины: ${vms.length} · Хосты: ${hosts.length}`}
                />
              </Panel>
            );
          })}
        </div>
        <h2 className="cloud-section-title">
          Физические хосты <span>{data.hosts.length}</span>
        </h2>
        <PlainTable
          rows={data.hosts}
          columns={hostColumns}
          caption="Хосты облака"
          placeholder="Имя хоста, кластер…"
          initialSort={[{ column: 'name', direction: 'asc' }]}
          rowTone={(h) => (h.maintenance ? 'warning' : undefined)}
          presets={[
            {
              label: 'Доступны',
              filters: [
                { field: 'status', operator: 'in', value: '', to: '', values: ['available'] },
              ],
            },
            {
              label: 'Обслуживание',
              filters: [
                { field: 'status', operator: 'in', value: '', to: '', values: ['maintenance'] },
              ],
            },
          ]}
        />
      </>
    );
  if (!cluster)
    return (
      <Empty
        title="Кластер не найден"
        action={<Button onClick={() => navigate('clusters')}>К списку кластеров</Button>}
      />
    );
  const hosts = data.hosts.filter((h) => h.clusterId === id),
    vms = data.vms.filter((v) => hosts.some((h) => h.id === v.hostId));
  return (
    <>
      <PageTitle
        title={cluster.name}
        resourceType={{ label: 'Кластер', href: '#cloud/clusters' }}
        description={cluster.description}
        actions={<Button onClick={() => navigate('clusters')}>Все кластеры</Button>}
      />
      <Tabs
        label="Разделы кластера"
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'hosts', label: 'Хосты', count: hosts.length },
          { id: 'vms', label: 'Виртуальные машины', count: vms.length },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        {tab === 'overview' ? (
          <div className="cloud-form-stack">
            <div className="cloud-metrics cloud-metrics--two">
              <Capacity
                type="cpu"
                value={vms.reduce((n, v) => n + v.cpu, 0)}
                total={hosts.reduce((n, h) => n + h.cpu, 0)}
              />
              <Capacity
                type="memory"
                value={vms.reduce((n, v) => n + v.memory, 0)}
                total={hosts.reduce((n, h) => n + h.memory, 0)}
              />
            </div>
            <Message tone="info" title="Размещение учитывает доступность узлов">
              Хосты на обслуживании видны в списке, но недоступны в форме создания машины.
            </Message>
            <PlainTable rows={hosts} columns={hostColumns} caption="Хосты кластера" />
          </div>
        ) : tab === 'hosts' ? (
          <PlainTable rows={hosts} columns={hostColumns} caption="Хосты кластера" />
        ) : (
          <VmTable clusterId={id} />
        )}
      </Tabs>
    </>
  );
}
export function TaskList({ tasks }: { tasks: Task[] }) {
  const { data, mutate, working, notify } = useCloud();
  const canRetry = (task: Task) =>
    task.vmIds.length > 0 &&
    task.vmIds.every((id) => {
      const vm = data?.vms.find((v) => v.id === id);
      if (!vm || data?.tasks.some((t) => t.status === 'running' && t.vmIds.includes(id)))
        return false;
      return task.action === 'create' ? vm.status === 'error' : canAct(vm, task.action);
    });
  const columns: RegistryColumn<Task>[] = [
    {
      id: 'name',
      pinned: 'start',
      value: (t) => t.name,
      description: 'Название операции с ресурсом.',
      header: 'Операция',
      width: 190,
      render: (t) => <strong>{t.name}</strong>,
    },
    {
      id: 'resource',
      value: (t) => t.resource,
      description: 'Ресурс или группа ресурсов, над которыми выполнялась операция.',
      header: 'Ресурс',
      width: 195,
      render: (t) =>
        t.vmIds.length === 1 && data?.vms.some((vm) => vm.id === t.vmIds[0]) ? (
          <a href={`#cloud/vms/${t.vmIds[0]}`}>{t.resource}</a>
        ) : (
          <span title={t.resource}>{t.resource}</span>
        ),
    },
    {
      id: 'status',
      kind: 'enum',
      value: (t) => t.status,
      options: [
        { value: 'running', label: 'Выполняется' },
        { value: 'success', label: 'Завершено' },
        { value: 'error', label: 'Ошибка' },
      ],
      description: 'Результат или текущий прогресс. Причина ошибки доступна по наведению.',
      header: 'Результат',
      width: 210,
      render: (t) =>
        t.status === 'running' ? (
          <Progress label="Выполнение" compact value={t.progress} />
        ) : t.status === 'error' ? (
          <Tooltip content={t.error || 'Операция завершилась с ошибкой.'}>
            <span tabIndex={0} aria-label={`Ошибка: ${t.error || t.name}`}>
              <StatusBadge tone="danger">Ошибка</StatusBadge>
            </span>
          </Tooltip>
        ) : (
          <StatusBadge tone="success">Завершено</StatusBadge>
        ),
    },
    {
      id: 'started',
      kind: 'date',
      value: (t) => t.startedAt,
      description: 'Местное время начала. Фильтр включает весь выбранный день.',
      header: 'Начало',
      width: 150,
      render: (t) => date(t.startedAt),
    },
    {
      id: 'action',
      pinned: 'end',
      header: 'Действие',
      width: 116,
      render: (t) =>
        t.status === 'error' ? (
          <Button
            size="sm"
            leadingIcon={<RefreshCw />}
            disabled={working || !canRetry(t)}
            title={
              !canRetry(t) ? 'Состояние ресурса изменилось или уже выполняется задача.' : undefined
            }
            onClick={async () => {
              try {
                await mutate(`/tasks/${t.id}/retry`, {}, 'Задача запущена повторно');
              } catch (e) {
                notify('Повтор недоступен', 'danger', e instanceof Error ? e.message : undefined);
              }
            }}
          >
            Повторить
          </Button>
        ) : (
          <span className="cloud-muted">—</span>
        ),
    },
  ];
  return (
    <PlainTable
      rows={tasks}
      columns={columns}
      caption="Операции"
      initialSort={[{ column: 'started', direction: 'desc' }]}
      placeholder="Операция, ресурс, результат…"
      rowTone={(t) => (t.status === 'error' ? 'error' : undefined)}
      presets={[
        {
          label: 'Выполняются',
          filters: [{ field: 'status', operator: 'in', value: '', to: '', values: ['running'] }],
        },
        {
          label: 'Завершены',
          filters: [{ field: 'status', operator: 'in', value: '', to: '', values: ['success'] }],
        },
        {
          label: 'С ошибкой',
          filters: [{ field: 'status', operator: 'in', value: '', to: '', values: ['error'] }],
        },
      ]}
      empty={
        <Empty
          title="Задач пока нет"
          description="Здесь появятся операции с виртуальными машинами."
        />
      }
    />
  );
}
export function TasksPage() {
  const { data: source, scope } = useCloud(),
    data = source!;
  const tasks = data.tasks.filter(
    (t) =>
      scope === 'all' ||
      t.projectId === scope ||
      t.vmIds.some((id) => data.vms.some((v) => v.id === id && v.projectId === scope)),
  );
  return (
    <>
      <PageTitle
        title="Журнал задач"
        description="Ход выполнения, результаты и история операций с ресурсами."
      />
      <TaskList tasks={tasks} />
    </>
  );
}
export function SettingsPage() {
  const { data: source, mutate, working, notify } = useCloud(),
    data = source!,
    design = useDesign();
  const [profile, setProfile] = useState(data.profile),
    [tab, setTab] = useState('profile'),
    [error, setError] = useState(''),
    [fields, setFields] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(profile) !== JSON.stringify(data.profile);
  const save = async () => {
    setError('');
    setFields({});
    try {
      await mutate('/profile', profile, 'Настройки сохранены', 'PATCH');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения.');
      if (e instanceof ApiError) setFields(e.fields);
    }
  };
  return (
    <>
      <PageTitle
        title="Настройки профиля"
        description="Профиль, уведомления и внешний вид рабочего пространства."
        actions={
          <Button variant="primary" loading={working} disabled={!dirty} onClick={() => void save()}>
            Сохранить изменения
          </Button>
        }
      />
      <Tabs
        label="Разделы настроек"
        items={[
          { id: 'profile', label: 'Профиль' },
          { id: 'notifications', label: 'Уведомления' },
          { id: 'appearance', label: 'Внешний вид' },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        <div className="cloud-settings-content">
          {error && (
            <Message title="Не удалось сохранить" tone="danger">
              {error}
            </Message>
          )}
          {tab === 'profile' ? (
            <>
              <Panel
                title="Профиль администратора"
                subtitle="Изменения сохраняются в локальной демонстрационной среде."
              >
                <div className="cloud-profile-header">
                  <Avatar name={profile.name} size="lg" status="online" />
                  <div>
                    <h3>{profile.name}</h3>
                    <Tag tone="info">Администратор облака</Tag>
                  </div>
                </div>
                <div className="cloud-form-grid">
                  <Input
                    label="Имя и фамилия"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                    leadingIcon={<UserRound />}
                    error={fields.name}
                  />
                  <Input
                    label="Электронная почта"
                    value={profile.email}
                    readOnly
                    hint="Учебная учётная запись"
                    leadingIcon={<Mail />}
                  />
                  <InputMask
                    kind="phone"
                    label="Телефон"
                    value={profile.phone}
                    onValueChange={(value) => setProfile((p) => ({ ...p, phone: value }))}
                    error={fields.phone}
                  />
                </div>
              </Panel>
              <Panel
                title="Демо-интеграция"
                subtitle="Искусственный ключ для проверки отображения защищённых полей."
              >
                <PasswordInput
                  label="Демонстрационный ключ"
                  value="demo_local_basis_no_real_access"
                  readOnly
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText('demo_local_basis_no_real_access');
                      notify('Демо-ключ скопирован');
                    } catch {
                      notify(
                        'Буфер обмена недоступен',
                        'warning',
                        'Ключ можно раскрыть и скопировать вручную.',
                      );
                    }
                  }}
                >
                  Копировать демо-ключ
                </Button>
              </Panel>
            </>
          ) : tab === 'notifications' ? (
            <Panel
              title="Уведомления о ресурсах"
              subtitle="Настройки профиля; отправка сообщений во внешние сервисы не выполняется."
            >
              <div className="cloud-form-stack">
                <Switch
                  checked={profile.notifications}
                  onCheckedChange={(value) => setProfile((p) => ({ ...p, notifications: value }))}
                  label="Уведомления о задачах"
                  description="Показывать результаты операций в рабочем пространстве."
                />
                <Checkbox
                  checked={profile.digest}
                  onCheckedChange={(value) => setProfile((p) => ({ ...p, digest: value }))}
                  label="Ежедневная сводка"
                  description="Сохранить предпочтение для будущей интеграции уведомлений."
                />
                <Message title="Журнал доступен всегда">
                  Ошибка операции остаётся в журнале задач независимо от настройки уведомлений.
                </Message>
              </div>
            </Panel>
          ) : (
            <Panel
              title="Тема интерфейса"
              subtitle="Те же семантические токены, что и в дизайн-системе."
            >
              <div className="cloud-theme-options">
                <RadioButton
                  card
                  name="cloud-theme"
                  label="Светлая"
                  description="Светлые поверхности и тёмно-синие акценты"
                  checked={design.theme === 'light'}
                  onChange={() => design.setTheme('light')}
                />
                <RadioButton
                  card
                  name="cloud-theme"
                  label="Тёмная"
                  description="Глубокие поверхности и мягкий контраст"
                  checked={design.theme === 'dark'}
                  onChange={() => design.setTheme('dark')}
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  location.hash = '#foundations';
                }}
              >
                Открыть токены дизайн-системы
              </Button>
            </Panel>
          )}
        </div>
      </Tabs>
    </>
  );
}
export function EnvironmentDialog({ onClose }: { onClose: () => void }) {
  const { data: source, mutate, working, refresh } = useCloud(),
    data = source!;
  const [mode, setMode] = useState(platformState(data).mode),
    [latency, setLatency] = useState(data.simulation.latency),
    [fault, setFault] = useState(data.simulation.fault),
    [tableState, setTableState] = useState(data.simulation.table ?? 'normal'),
    [error, setError] = useState(''),
    [confirmReset, setConfirmReset] = useState(false);
  const apply = async () => {
    setError('');
    try {
      await mutate('/platform/mode', { mode });
      await mutate(
        '/simulation',
        { latency, fault, table: tableState },
        'Поведение среды обновлено',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(value) => {
          if (!value && !working) onClose();
        }}
        title="Среда демонстрации"
        description={
          offline
            ? 'Автономный режим: изменения хранятся в этом браузере.'
            : 'Локальный HTTP API: изменения сохраняются между перезапусками сервера.'
        }
        footer={
          <>
            <Button disabled={working} onClick={onClose}>
              Закрыть
            </Button>
            <Button variant="primary" loading={working} onClick={() => void apply()}>
              Применить
            </Button>
          </>
        }
      >
        <div className="cloud-form-stack">
          <Message title="Без подключения к реальному облаку" compact>
            Все ресурсы и операции демонстрационные. Здесь можно проверить поведение при медленной
            сети и ошибках.
          </Message>
          <Select
            label="Роль в демо"
            value={mode}
            onValueChange={(value) => setMode(value as typeof mode)}
            options={[
              {
                value: 'admin',
                label: 'Администратор платформы',
                description: 'Все аккаунты и инфраструктура',
              },
              {
                value: 'user',
                label: 'Участник аккаунта',
                description: 'Управление ресурсами Базис · Production',
              },
              {
                value: 'reader',
                label: 'Наблюдатель',
                description: 'Просмотр ресурсов аккаунта без изменений',
              },
            ]}
          />
          <Slider
            label="Задержка ответа"
            value={latency}
            onValueChange={setLatency}
            min={0}
            max={3000}
            step={10}
            unit="мс"
            marks={[0, 1000, 2000, 3000]}
          />
          <Select
            label="Состояние реестров"
            value={tableState}
            onValueChange={setTableState}
            options={[
              {
                value: 'normal',
                label: 'Ресурсы загружены',
                description: 'Обычная работа с данными',
              },
              {
                value: 'empty',
                label: 'Пустой реестр',
                description: 'Пустой ответ без удаления демо-ресурсов',
              },
              {
                value: 'error',
                label: 'Ошибка загрузки',
                description: 'Запросы реестров недоступны до смены сценария',
              },
            ]}
          />
          <Select
            label="Следующая операция"
            value={fault}
            onValueChange={setFault}
            options={[
              {
                value: 'none',
                label: 'Обычная работа',
                description: 'Ответы без искусственной ошибки',
              },
              {
                value: 'request',
                label: 'Ошибка запроса',
                description: 'Следующее изменение вернёт 503; форма сохранит значения',
              },
              {
                value: 'read',
                label: 'Ошибка обновления таблицы',
                description: 'Следующее обновление вернёт ошибку; повторная попытка сработает',
              },
              {
                value: 'task',
                label: 'Ошибка фоновой задачи',
                description: 'Следующая задача завершится ошибкой и будет доступна для повтора',
              },
            ]}
          />
          <div className="cloud-env-stats">
            <span>Машины: {data.vms.length}</span>
            <span>Ресурсные группы: {data.projects.length}</span>
            <span>{data.tasks.length} задач</span>
          </div>
          <Button
            leadingIcon={<RefreshCw />}
            onClick={() => {
              onClose();
              void refresh(true);
            }}
          >
            Повторно загрузить данные
          </Button>
          <Button tone="danger" variant="ghost" onClick={() => setConfirmReset(true)}>
            Восстановить исходные демо-данные
          </Button>
          {error && (
            <Message title="Не удалось изменить среду" tone="danger">
              {error}
            </Message>
          )}
        </div>
      </Dialog>
      <Dialog
        open={confirmReset}
        onOpenChange={(value) => {
          if (!working) setConfirmReset(value);
        }}
        title="Восстановить исходные данные?"
        description="Созданные в демо ресурсы и задачи будут заменены начальным набором. Токены и настройки дизайн-системы сохранятся."
        tone="danger"
        footer={
          <>
            <Button disabled={working} onClick={() => setConfirmReset(false)}>
              Отмена
            </Button>
            <Button
              tone="danger"
              variant="primary"
              loading={working}
              onClick={async () => {
                try {
                  await mutate(
                    '/reset',
                    { confirm: 'RESET' },
                    'Исходные демо-данные восстановлены',
                  );
                  sessionStorage.removeItem('basis-cloud-create-draft-v1');
                  setConfirmReset(false);
                  navigate('overview');
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Ошибка');
                  setConfirmReset(false);
                }
              }}
            >
              Восстановить
            </Button>
          </>
        }
      />
    </>
  );
}

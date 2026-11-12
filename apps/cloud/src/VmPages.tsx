import { VmOverview } from './VmOverview';
import { DetailFacts, ResourceConnection, ResourceMetrics, CopyValue } from './ResourceDetails';
import {
  canChangePlatform,
  scopeLabel,
  scopeContains,
  groupAccountId,
  listPlatformRecords,
} from '../platform-model';
import { PlatformRecordSettings, vmConfiguration } from './PlatformSettings';
import { useVmConsole } from './ConsoleProvider';
import { useRef, useState } from 'react';
import {
  Camera,
  HardDrive,
  Network,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Server,
  Terminal,
  Unplug,
} from 'lucide-react';
import {
  Button,
  Dialog,
  IconButton,
  Input,
  InputTag,
  Message,
  NumberInput,
  Progress,
  SplitButton,
  StatusBadge,
  Switch,
  TableSelect,
  Tabs,
  Tag,
  Textarea,
} from '@basis/ui';
import { useCloud } from './cloud-state';
import { ApiError } from './api';
import {
  busy,
  type FieldErrors,
  type Snapshot,
  type VM,
  type VmAction,
  type Volume,
} from '../domain';
import {
  date,
  Empty,
  navigate,
  PageTitle,
  Panel,
  PlainTable,
  projectName,
  ResourceMark,
  VmState,
} from './parts';
import { VmTable } from './VmTable';
import { useVmActions, VmMenu } from './VmActions';
import { TaskList } from './WorkspacePages';
import type { RegistryColumn } from './registry-model';

export function VmListPage() {
  const { data, scope } = useCloud();
  return (
    <>
      <PageTitle
        eyebrow={scope === 'all' ? undefined : scopeLabel(data!, scope)}
        title="Виртуальные машины"
        description="Вычислительные ресурсы, состояние и размещение."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus />}
            disabled={Boolean(canChangePlatform(data!, 'vms'))}
            onClick={() => navigate('create')}
          >
            Создать машину
          </Button>
        }
      />
      <VmTable />
    </>
  );
}
export function VmDetailPage({ id, tab }: { id: string; tab: string }) {
  const consoles = useVmConsole();
  const { data: source, working, mutate, notify } = useCloud(),
    data = source!,
    vm = data.vms.find((v) => v.id === id);
  const { act, available, dialog } = useVmActions();
  const [edit, setEdit] = useState<'metadata' | 'resources' | null>(null),
    [attach, setAttach] = useState<string[]>([]),
    [attachmentError, setAttachmentError] = useState(''),
    [detach, setDetach] = useState<Volume | null>(null),
    [powerChoice, setPowerChoice] = useState('');
  if (!vm || !scopeContains(data, 'all', vm.projectId))
    return (
      <>
        <PageTitle title="Машина не найдена" />
        <Empty
          title="Машина удалена или больше недоступна"
          description="Её операции сохраняются в журнале задач."
          action={<Button onClick={() => navigate('vms')}>Вернуться в реестр</Button>}
        />
      </>
    );
  const volumes = data.volumes.filter((v) => v.vmId === vm.id),
    host = data.hosts.find((h) => h.id === vm.hostId),
    zone = data.clusters.find((c) => c.id === host?.clusterId),
    network = data.networks.find((n) => n.id === vm.networkId),
    task = data.tasks.find((t) => t.vmIds.includes(id) && t.status === 'running');
  const chosenAction =
    powerChoice && available(vm, powerChoice as VmAction)
      ? powerChoice
      : vm.status === 'running'
        ? 'stop'
        : 'start';
  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'resources', label: 'Ресурсы', count: volumes.length },
    { id: 'network', label: 'Сеть' },
    { id: 'snapshots', label: 'Снимки', count: vm.snapshots.length },
    { id: 'placement', label: 'Размещение' },
    { id: 'security', label: 'Безопасность' },
    {
      id: 'activity',
      label: 'Операции',
      count: data.tasks.filter((t) => t.vmIds.includes(id)).length,
    },
  ];
  const currentTab = tabs.some((t) => t.id === tab) ? tab : 'overview';
  const diskColumns: RegistryColumn<Volume>[] = [
    {
      id: 'name',
      value: (v) => v.name,
      pinned: 'start',
      description: 'Имя подключённого диска.',
      header: 'Диск',
      width: 245,
      render: (v) => (
        <span className="cloud-resource-cell">
          <HardDrive size={15} />
          <strong>{v.name}</strong>
        </span>
      ),
    },
    {
      id: 'size',
      kind: 'number',
      value: (v) => v.size,
      unit: 'GiB',
      description: 'Объём диска.',
      header: 'Объём',
      width: 128,
      align: 'right',
      render: (v) => `${v.size} GiB`,
    },
    {
      id: 'tier',
      kind: 'enum',
      value: (v) => v.tier,
      options: [
        { value: 'ssd', label: 'SSD' },
        { value: 'hdd', label: 'HDD' },
      ],
      description: 'Класс хранилища.',
      header: 'Класс',
      width: 112,
      render: (v) => v.tier.toUpperCase(),
    },
    {
      id: 'boot',
      kind: 'enum',
      value: (v) => (v.boot ? 'system' : 'data'),
      options: [
        { value: 'system', label: 'Системный' },
        { value: 'data', label: 'Данные' },
      ],
      description: 'Системный диск содержит загрузочный образ.',
      header: 'Назначение',
      width: 140,
      render: (v) => (
        <Tag tone={v.boot ? 'info' : 'neutral'}>{v.boot ? 'Системный' : 'Данные'}</Tag>
      ),
    },
    {
      id: 'actions',
      utility: 'actions',
      pinned: 'end',
      header: 'Действия',
      width: 100,
      render: (v) => (
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={`Отключить ${v.name}`}
          icon={<Unplug />}
          disabled={v.boot || vm.status !== 'stopped' || working}
          onClick={() => setDetach(v)}
        />
      ),
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow={`${projectName(data, vm.projectId)} / Виртуальная машина`}
        title={
          <span className="cloud-entity-title">
            <ResourceMark />
            {vm.name}
            <VmState vm={vm} />
          </span>
        }
        description={
          vm.description === 'Управляемый ресурс облачной платформы.' ? undefined : vm.description
        }
        actions={
          <>
            <Button
              leadingIcon={<Terminal />}
              disabled={vm.status !== 'running' || Boolean(canChangePlatform(data, 'vms'))}
              onClick={() => consoles.openConsole(vm)}
            >
              Консоль
            </Button>
            <SplitButton
              value={chosenAction}
              onValueChange={setPowerChoice}
              onAction={(value) => act(value as VmAction, [vm])}
              tone={chosenAction === 'stop' ? 'warning' : 'success'}
              disabled={working || Boolean(task)}
              actions={[
                {
                  id: 'start',
                  label: 'Запустить',
                  icon: <Play />,
                  disabled: !available(vm, 'start'),
                },
                {
                  id: 'stop',
                  label: 'Выключить',
                  icon: <Power />,
                  disabled: !available(vm, 'stop'),
                },
                {
                  id: 'restart',
                  label: 'Перезапустить',
                  icon: <RefreshCw />,
                  disabled: !available(vm, 'restart'),
                },
              ]}
            />
            <VmMenu vm={vm} act={act} available={available} />
          </>
        }
      />
      {task && (
        <div className="cloud-operation-banner">
          <span>
            <Server size={18} />
            <strong>{task.name}</strong>
            <small>Можно продолжать работу в других разделах</small>
          </span>
          <Progress value={task.progress} label="Выполнение задачи" compact />
          <Button variant="ghost" size="sm" onClick={() => navigate('tasks')}>
            Журнал
          </Button>
        </div>
      )}
      {vm.status === 'error' && (
        <Message
          tone="danger"
          title="Машина требует внимания"
          action={{ label: 'Открыть операции', onClick: () => navigate(`vms/${vm.id}/activity`) }}
        >
          {data.tasks.find((t) => t.vmIds.includes(id) && t.status === 'error')?.error ||
            'Операция не завершена. Проверьте журнал и повторите запуск.'}
        </Message>
      )}
      <Tabs
        label="Разделы виртуальной машины"
        items={tabs}
        value={currentTab}
        onValueChange={(value) => navigate(`vms/${vm.id}/${value}`)}
      >
        {currentTab === 'overview' && <VmOverview vm={vm} onEdit={() => setEdit('metadata')} />}
        {currentTab === 'resources' && (
          <div className="cloud-form-stack">
            <Panel
              title="Вычислительная конфигурация"
              subtitle="Изменение vCPU и памяти доступно у выключенной машины."
              action={
                <Button
                  size="sm"
                  leadingIcon={<Pencil />}
                  disabled={vm.status !== 'stopped' || Boolean(canChangePlatform(data, 'vms'))}
                  onClick={() => setEdit('resources')}
                >
                  Изменить
                </Button>
              }
            >
              <ResourceMetrics
                items={[
                  {
                    label: 'Процессоры',
                    icon: 'Cpu',
                    value: (
                      <>
                        {vm.cpu}
                        <small>vCPU</small>
                      </>
                    ),
                  },
                  {
                    label: 'Оперативная память',
                    icon: 'CircuitBoard',
                    value: (
                      <>
                        {vm.memory}
                        <small>GiB</small>
                      </>
                    ),
                  },
                  {
                    label: 'Подключённые диски',
                    icon: 'HardDrive',
                    value: (
                      <>
                        {volumes.reduce((n, v) => n + v.size, 0)}
                        <small>GiB</small>
                      </>
                    ),
                  },
                ]}
              />
            </Panel>
            <PlainTable rows={volumes} columns={diskColumns} caption="Подключённые диски" />
            <Panel
              title="Подключить дополнительные диски"
              subtitle="Можно подключить свободные диски этого аккаунта. Для отключения выключите машину."
            >
              <div className="cloud-attach-form">
                <TableSelect
                  label="Диски для подключения"
                  title="Свободные диски"
                  rows={data.volumes.filter(
                    (v) =>
                      listPlatformRecords(data, 'volumes').find((row) => row.id === v.id)
                        ?.accountId === groupAccountId(data, vm.projectId) &&
                      !v.boot &&
                      !v.vmId,
                  )}
                  columns={diskColumns.slice(0, 3)}
                  getRowId={(v) => v.id}
                  getRowLabel={(v) => v.name}
                  searchText={(v) => v.name}
                  value={attach}
                  onValueChange={setAttach}
                  disabled={busy(vm) || working}
                />
                <Button
                  leadingIcon={<Plus />}
                  disabled={!attach.length || busy(vm) || Boolean(canChangePlatform(data, 'vms'))}
                  loading={working}
                  onClick={async () => {
                    setAttachmentError('');
                    try {
                      await mutate(`/vms/${vm.id}/volumes`, { ids: attach }, 'Диски подключены');
                      setAttach([]);
                    } catch (e) {
                      setAttachmentError(e instanceof Error ? e.message : 'Ошибка подключения');
                    }
                  }}
                >
                  Подключить
                </Button>
              </div>
              {attachmentError && (
                <Message tone="danger" title="Диски не подключены">
                  {attachmentError}
                </Message>
              )}
            </Panel>
          </div>
        )}
        {currentTab === 'network' && (
          <div className="platform-detail-grid resource-detail-grid platform-tab-content">
            <Panel title="Основной интерфейс" subtitle="Подключение к приватной сети">
              <div className="vm-address">
                <div>
                  <small>eth0 · IPv4</small>
                  <strong className="cloud-mono">{vm.ip || 'Не назначен'}</strong>
                </div>
                {vm.ip && <CopyValue value={vm.ip} label="сетевой адрес" />}
              </div>
              <DetailFacts
                items={[
                  {
                    label: 'Сеть ViNS',
                    value: network ? (
                      <a href={`#cloud/networks/${network.id}`}>{network.name}</a>
                    ) : (
                      'Не подключена'
                    ),
                  },
                  {
                    label: 'Подсеть',
                    value: <span className="cloud-mono">{network?.cidr || '—'}</span>,
                  },
                  { label: 'VLAN', value: network?.vlan ?? '—' },
                  {
                    label: 'Назначение IP',
                    value: vm.dhcp ? 'Автоматическое · DHCP' : 'Статическое',
                  },
                  {
                    label: 'MAC-адрес',
                    value: (
                      <span className="cloud-mono">
                        {vm.mac
                          .match(/.{1,2}/g)
                          ?.join(':')
                          .toUpperCase()}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
            <Panel title="Машины в этой сети" subtitle="Ресурсы в одной изолированной сети ViNS">
              <div className="resource-related-machines">
                {data.vms
                  .filter((v) => v.id !== vm.id && v.networkId === vm.networkId)
                  .map((v) => (
                    <ResourceConnection
                      key={v.id}
                      icon="Server"
                      label={v.ip}
                      name={v.name}
                      href={`#cloud/vms/${v.id}`}
                    />
                  ))}
                {!data.vms.some((v) => v.id !== vm.id && v.networkId === vm.networkId) && (
                  <div className="resource-quiet">
                    <Network size={20} />
                    <div>
                      <strong>Других машин нет</strong>
                      <p>В этой сети подключена только текущая машина.</p>
                    </div>
                  </div>
                )}
              </div>
              {network && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`networks/${network.id}`)}
                >
                  Открыть сеть
                </Button>
              )}
            </Panel>
          </div>
        )}
        {currentTab === 'snapshots' && (
          <div className="cloud-form-stack">
            <Message title="Снимок фиксирует текущее состояние" compact>
              Снимки доступны после завершения задачи. Демонстрация хранит метаданные снимков, без
              реальных файлов дисков.
            </Message>
            <PlainTable<Snapshot>
              rows={vm.snapshots}
              caption="Снимки машины"
              toolbar={
                <>
                  <Button
                    size="sm"
                    leadingIcon={<Camera />}
                    disabled={!available(vm, 'snapshot')}
                    onClick={() => act('snapshot', [vm])}
                  >
                    Создать снимок
                  </Button>
                </>
              }
              columns={[
                {
                  id: 'name',
                  header: 'Название',
                  value: (s) => s.name,
                  pinned: 'start',
                  description: 'Название сохранённого состояния машины.',
                  width: 300,
                  render: (snapshot) => <strong>{snapshot.name}</strong>,
                },
                {
                  id: 'time',
                  kind: 'date',
                  value: (s) => s.createdAt,
                  description: 'Дата и время создания снимка.',
                  header: 'Создан',
                  width: 190,
                  render: (snapshot) => date(snapshot.createdAt),
                },
                {
                  id: 'size',
                  header: 'Размер',
                  kind: 'number',
                  value: (s) => s.size,
                  unit: 'GiB',
                  description: 'Объём снимка в GiB.',
                  width: 110,
                  render: (snapshot) => `${snapshot.size} GiB`,
                },
                {
                  id: 'state',
                  kind: 'enum',
                  value: () => 'ready',
                  options: [{ value: 'ready', label: 'Готов' }],
                  description: 'Готовность снимка к использованию.',
                  header: 'Состояние',
                  width: 150,
                  render: () => <StatusBadge tone="success">Готов</StatusBadge>,
                },
              ]}
              empty={
                <Empty
                  title="Снимков пока нет"
                  description="Создайте первый снимок перед изменением конфигурации."
                />
              }
            />
          </div>
        )}
        {currentTab === 'placement' && (
          <div className="platform-detail-grid resource-detail-grid platform-tab-content">
            <PlatformRecordSettings
              entity={vmConfiguration}
              row={listPlatformRecords(data, 'vms').find((r) => r.id === vm.id)!}
              title="Аппаратная конфигурация"
              fields={['nodeId', 'chipset', 'numa', 'cpuPin', 'hugepages']}
            />
            <aside className="platform-detail-aside">
              <Panel title="Размещение сейчас">
                <ResourceConnection
                  icon="MapPin"
                  label={zone?.region || 'Зона'}
                  name={zone?.name || 'Не назначена'}
                  href={zone ? `#cloud/clusters/${zone.id}` : undefined}
                />
                <ResourceConnection
                  icon="Server"
                  label="Вычислительный узел"
                  name={host?.name || 'Не назначен'}
                  href={host ? `#cloud/nodes/${host.id}` : undefined}
                />
              </Panel>
              <Message
                title={
                  vm.status === 'stopped' ? 'Машина выключена' : 'Изменение аппаратных параметров'
                }
                tone="info"
              >
                {vm.status === 'stopped'
                  ? 'Можно изменять чипсет, NUMA и параметры памяти. При переносе проверяется доступная ёмкость узла.'
                  : 'Для изменения чипсета, NUMA и параметров памяти выключите машину. Параметры размещения доступны в окне настройки.'}
              </Message>
            </aside>
          </div>
        )}
        {currentTab === 'security' && (
          <div className="platform-detail-grid resource-detail-grid platform-tab-content">
            <PlatformRecordSettings
              entity={vmConfiguration}
              row={listPlatformRecords(data, 'vms').find((r) => r.id === vm.id)!}
              title="Доступ и ограничения"
              fields={['securityGroupId', 'administrativeStatus', 'locked']}
            />
            <aside className="platform-detail-aside">
              <Panel
                title="Политика защиты"
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    leadingIcon={<Pencil />}
                    disabled={busy(vm) || Boolean(canChangePlatform(data, 'vms'))}
                    onClick={() => setEdit('metadata')}
                  >
                    Изменить
                  </Button>
                }
              >
                <StatusBadge tone={vm.backup ? 'success' : 'neutral'}>
                  {vm.backup ? 'Включена' : 'Не назначена'}
                </StatusBadge>
                <p className="resource-demo-note">
                  Политика защиты настраивается отдельно от сетевых правил и блокировки изменений.
                </p>
              </Panel>
              <Message title="Область действия" compact>
                Группа безопасности определяет сетевые правила аккаунта. Блокировка защищает машину
                от изменений и операций питания.
              </Message>
            </aside>
          </div>
        )}
        {currentTab === 'activity' && (
          <TaskList tasks={data.tasks.filter((t) => t.vmIds.includes(vm.id))} />
        )}
      </Tabs>
      {dialog}
      {edit && <VmEditDialog vm={vm} kind={edit} onClose={() => setEdit(null)} />}
      <Dialog
        open={Boolean(detach)}
        onOpenChange={(value) => {
          if (!value && !working) setDetach(null);
        }}
        title="Отключить дополнительный диск?"
        description={`${detach?.name || ''} останется в аккаунте и станет доступным для подключения к другой машине.`}
        footer={
          <>
            <Button disabled={working} onClick={() => setDetach(null)}>
              Отмена
            </Button>
            <Button
              tone="warning"
              loading={working}
              onClick={async () => {
                if (!detach) return;
                try {
                  await mutate(`/vms/${vm.id}/volumes/${detach.id}`, {}, 'Диск отключён', 'DELETE');
                  setDetach(null);
                } catch (e) {
                  notify(
                    'Не удалось отключить диск',
                    'danger',
                    e instanceof Error ? e.message : undefined,
                  );
                }
              }}
            >
              Отключить
            </Button>
          </>
        }
      />
    </>
  );
}
function VmEditDialog({
  vm,
  kind,
  onClose,
}: {
  vm: VM;
  kind: 'metadata' | 'resources';
  onClose: () => void;
}) {
  const { mutate, working } = useCloud();
  const [form, setForm] = useState({
      name: vm.name,
      cpu: vm.cpu,
      memory: vm.memory,
      description: vm.description,
      tags: vm.tags,
      backup: vm.backup,
    }),
    [error, setError] = useState(''),
    [fields, setFields] = useState<FieldErrors>({});
  const fieldsRoot = useRef<HTMLDivElement>(null);
  const save = async () => {
    const invalidTag = fieldsRoot.current?.querySelector<HTMLInputElement>(
      '.basis-input-tag input[aria-invalid="true"]',
    );
    if (invalidTag) {
      invalidTag.focus();
      return;
    }
    setError('');
    setFields({});
    try {
      await mutate(`/vms/${vm.id}`, form, 'Параметры машины сохранены', 'PATCH');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
      if (e instanceof ApiError) setFields(e.fields);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !working) onClose();
      }}
      title={kind === 'metadata' ? 'Сведения о машине' : 'Вычислительные ресурсы'}
      description={vm.name}
      footer={
        <>
          <Button disabled={working} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" loading={working} onClick={() => void save()}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="cloud-form-stack" ref={fieldsRoot}>
        {kind === 'metadata' ? (
          <>
            <Input
              label="Имя машины"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              error={fields.name}
            />
            <Textarea
              label="Описание"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
              maxLength={500}
              error={fields.description}
            />
            <InputTag
              label="Метки"
              value={form.tags}
              onValueChange={(tags) => setForm((v) => ({ ...v, tags }))}
              max={8}
              validate={(value) =>
                /^[a-z0-9:_-]{1,24}$/i.test(value) ? undefined : 'Допустимы латиница, цифры, : _ -.'
              }
              error={fields.tags}
            />
            <Switch
              label="Политика резервного копирования"
              checked={form.backup}
              onCheckedChange={(backup) => setForm((v) => ({ ...v, backup }))}
            />
          </>
        ) : (
          <>
            <Message title="Машина останется выключенной" compact>
              После сохранения новой конфигурации запустите её вручную.
            </Message>
            <NumberInput
              label="Процессоры"
              min={1}
              max={32}
              unit="vCPU"
              value={form.cpu}
              onValueChange={(cpu) => setForm((v) => ({ ...v, cpu }))}
              error={fields.cpu}
            />
            <NumberInput
              label="Оперативная память"
              min={1}
              max={128}
              unit="GiB"
              value={form.memory}
              onValueChange={(memory) => setForm((v) => ({ ...v, memory }))}
              error={fields.memory}
            />
          </>
        )}
        {error && (
          <Message tone="danger" title="Параметры не сохранены">
            {error}
          </Message>
        )}
      </div>
    </Dialog>
  );
}

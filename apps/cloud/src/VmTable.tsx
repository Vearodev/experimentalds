import {
  scopeContains,
  groupAccountId,
  listPlatformRecords,
  platformRecordName,
  vmMetadata,
} from '../platform-model';
import { useState } from 'react';
import { ArrowUpRight, Play, Power, Server, Trash2 } from 'lucide-react';
import { Button, ContextPanel, StatusBadge, Tag } from '@basis/ui';
import { statusNames, type VM } from '../domain';
import { useCloud } from './cloud-state';
import { useDesign } from '../../playground/src/DesignContext';
import { Empty, hostName, navigate, projectName, VmState } from './parts';
import { useVmActions, VmMenu } from './VmActions';
import { ResourceTable } from './ResourceTable';
import { type RegistryColumn, type Rule } from './registry-model';
import { useVmConsole } from './ConsoleProvider';
import { VmQuickPreview } from './VmQuickPreview';
export function VmTable({
  clusterId,
  resourceIds,
  contextKey,
}: {
  clusterId?: string;
  resourceIds?: string[];
  contextKey?: string;
}) {
  const consoles = useVmConsole();
  const { data: source, scope } = useCloud(),
    data = source!;
  const { resolved } = useDesign();
  const width = (role: string) =>
    resolved[`comp.table.column.${role === 'actions' ? role : `compact.${role}`}.width`].value
      .value;
  const [preview, setPreview] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const { act, available, dialog } = useVmActions();
  const rows = data.vms.filter(
    (vm) =>
      scopeContains(data, resourceIds ? 'all' : scope, vm.projectId) &&
      (!resourceIds || resourceIds.includes(vm.id)) &&
      (!clusterId || data.hosts.find((h) => h.id === vm.hostId)?.clusterId === clusterId),
  );
  const columns: RegistryColumn<VM>[] = [
    {
      id: 'name',
      header: 'Имя машины',
      width: width('identity'),
      pinned: 'start',
      value: (v) => v.name,
      description: 'Уникальное имя машины в ресурсной группе. Нажмите, чтобы открыть её страницу.',
      render: (vm) => (
        <a className="cloud-vm-link" href={`#cloud/vms/${vm.id}`}>
          <Server size={15} />
          <span title={vm.name}>{vm.name}</span>
        </a>
      ),
    },
    {
      id: 'status',
      header: 'Состояние',
      width: width('status'),
      kind: 'enum',
      value: (v) => v.status,
      options: Object.entries(statusNames).map(([value, label]) => ({ value, label })),
      description: 'Состояние питания или текущая операция.',
      render: (vm) => <VmState vm={vm} />,
    },
    {
      id: 'project',
      header: 'Ресурсная группа',
      width: width('relation'),
      kind: 'enum',
      value: (v) => v.projectId,
      options: data.projects.map((p) => ({ value: p.id, label: p.name })),
      description:
        'Ресурсная группа объединяет связанные машины, сети и ограничения внутри аккаунта.',
      render: (vm) => (
        <a className="platform-resource-link" href={`#cloud/projects/${vm.projectId}`}>
          {projectName(data, vm.projectId)}
        </a>
      ),
    },
    {
      id: 'account',
      header: 'Аккаунт',
      description: 'Владелец ресурсов. Квоты аккаунта ограничивают все его ресурсные группы.',
      hidden: true,
      width: width('relation'),
      kind: 'enum',
      options: listPlatformRecords(data, 'accounts').map((r) => ({ value: r.id, label: r.name })),
      value: (vm) => groupAccountId(data, vm.projectId),
      render: (vm) => (
        <a
          className="platform-resource-link"
          href={`#cloud/accounts/${groupAccountId(data, vm.projectId)}`}
        >
          {platformRecordName(data, 'accounts', groupAccountId(data, vm.projectId))}
        </a>
      ),
    },
    {
      id: 'administrative',
      header: 'Доступность',
      description: 'Административная доступность машины. Не зависит от состояния питания.',
      hidden: true,
      width: width('status'),
      kind: 'enum',
      options: [
        { value: 'ENABLED', label: 'Включена' },
        { value: 'DISABLED', label: 'Отключена' },
      ],
      value: (vm) => String(vmMetadata(data, vm.id)?.administrativeStatus || 'ENABLED'),
      render: (vm) => (
        <StatusBadge
          tone={
            vmMetadata(data, vm.id)?.administrativeStatus === 'DISABLED' ? 'neutral' : 'success'
          }
        >
          {vmMetadata(data, vm.id)?.administrativeStatus === 'DISABLED' ? 'Отключена' : 'Включена'}
        </StatusBadge>
      ),
    },
    {
      id: 'locked',
      header: 'Блокировка',
      description: 'Защита машины от изменений до снятия блокировки.',
      hidden: true,
      width: width('status'),
      kind: 'enum',
      options: [
        { value: 'true', label: 'Заблокирована' },
        { value: 'false', label: 'Нет блокировки' },
      ],
      value: (vm) => String(Boolean(vmMetadata(data, vm.id)?.locked)),
      render: (vm) => (
        <Tag tone={vmMetadata(data, vm.id)?.locked ? 'warning' : 'neutral'}>
          {vmMetadata(data, vm.id)?.locked ? 'Заблокирована' : 'Нет'}
        </Tag>
      ),
    },
    {
      id: 'ip',
      header: 'IP-адрес',
      width: width('address'),
      kind: 'ip',
      value: (v) => v.ip || null,
      description: 'Основной IPv4. Можно искать по полному адресу или префиксу.',
      render: (vm) => <span className="cloud-mono">{vm.ip || '—'}</span>,
    },
    {
      id: 'cpu',
      header: 'vCPU',
      width: width('numeric'),
      kind: 'number',
      value: (v) => v.cpu,
      unit: 'vCPU',
      align: 'right',
      description: 'Количество выделенных виртуальных процессоров.',
      render: (vm) => <span className="cloud-number">{vm.cpu}</span>,
    },
    {
      id: 'memory',
      header: 'RAM',
      width: width('numeric'),
      kind: 'number',
      value: (v) => v.memory,
      unit: 'GiB',
      align: 'right',
      description: 'Выделенная оперативная память в GiB.',
      render: (vm) => (
        <span className="cloud-number">
          {vm.memory}
          <small className="cloud-unit">GiB</small>
        </span>
      ),
    },
    {
      id: 'host',
      header: 'Узел',
      width: width('relation'),
      hidden: true,
      kind: 'enum',
      value: (v) => v.hostId,
      options: data.hosts.map((h) => ({ value: h.id, label: h.name })),
      description: 'Физический сервер размещения.',
      render: (vm) => hostName(data, vm.hostId),
    },
    {
      id: 'tags',
      groupable: false,
      header: 'Метки',
      width: width('identity'),
      hidden: true,
      value: (vm) => vm.tags.join(' '),
      description: 'Метки для поиска и классификации ресурсов.',
      render: (vm) => vm.tags.join(', ') || '—',
    },
    {
      id: 'actions',
      utility: 'actions',
      header: 'Действия',
      width: width('actions'),
      pinned: 'end',
      render: (vm) => (
        <div className="cloud-cell-actions">
          <VmMenu vm={vm} act={act} available={available} />
        </div>
      ),
    },
  ];
  const preset = (values: string[]): Rule[] => [
    { field: 'status', operator: 'in', value: '', to: '', values },
  ];
  const previewVm = data.vms.find((vm) => vm.id === preview?.id);
  return (
    <>
      <ResourceTable
        tableId={`vms:${contextKey || scope}:${clusterId || 'all'}`}
        rows={rows}
        columns={columns}
        caption="Виртуальные машины"
        onRowActivate={(vm, anchor) => setPreview({ id: vm.id, anchor })}
        previewRowId={preview?.id}
        placeholder="Имя, IP-адрес, ресурсная группа…"
        initialSort={[{ column: 'name', direction: 'asc' }]}
        presets={[
          { label: 'Работают', filters: preset(['running']) },
          { label: 'Выключены', filters: preset(['stopped']) },
          { label: 'С ошибкой', filters: preset(['error']) },
        ]}
        rowTone={(vm) =>
          vm.status === 'error'
            ? 'error'
            : vm.cpuUsage > 85 && vm.status === 'running'
              ? 'warning'
              : undefined
        }
        bulkActions={(chosen) => (
          <>
            <Button
              size="sm"
              tone="brand"
              leadingIcon={<Play />}
              disabled={!chosen.length || !chosen.every((v) => available(v, 'start'))}
              title={
                chosen.every((v) => available(v, 'start'))
                  ? 'Запустить выбранные машины'
                  : 'Запуск доступен только для выключенных машин'
              }
              onClick={() => act('start', chosen)}
            >
              Запустить
            </Button>
            <Button
              size="sm"
              tone="neutral"
              leadingIcon={<Power />}
              disabled={!chosen.length || !chosen.every((v) => available(v, 'stop'))}
              title={
                chosen.every((v) => available(v, 'stop'))
                  ? 'Выключить выбранные машины'
                  : 'Выберите только работающие машины'
              }
              onClick={() => act('stop', chosen)}
            >
              Выключить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              tone="danger"
              leadingIcon={<Trash2 />}
              disabled={!chosen.length || !chosen.every((v) => available(v, 'delete'))}
              title="Удалить выбранные выключенные машины"
              onClick={() => act('delete', chosen)}
            >
              Удалить
            </Button>
          </>
        )}
        empty={
          <Empty
            title="В этой области пока нет машин"
            description="Создайте машину и выберите сеть и размещение."
            action={<Button onClick={() => navigate('create')}>Создать машину</Button>}
          />
        }
      />
      <ContextPanel
        open={Boolean(previewVm)}
        anchor={preview?.anchor || null}
        presentation="drawer"
        title={previewVm?.name || 'Виртуальная машина'}
        description="Виртуальная машина · быстрый просмотр"
        icon={<Server />}
        onClose={() => setPreview(null)}
        footer={
          <>
            <Button onClick={() => setPreview(null)}>Закрыть</Button>
            <Button
              variant="primary"
              trailingIcon={<ArrowUpRight />}
              onClick={() => {
                navigate(`vms/${previewVm!.id}`);
                setPreview(null);
              }}
            >
              Открыть машину
            </Button>
          </>
        }
      >
        {previewVm && (
          <VmQuickPreview
            vm={previewVm}
            powerAvailable={available(previewVm, previewVm.status === 'running' ? 'stop' : 'start')}
            onPower={() => act(previewVm.status === 'running' ? 'stop' : 'start', [previewVm])}
            onConsole={() => {
              setPreview(null);
              consoles.openConsole(previewVm);
            }}
          />
        )}
      </ContextPanel>
      {dialog}
    </>
  );
}

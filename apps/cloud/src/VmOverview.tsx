import { ArrowUpRight, Pencil } from 'lucide-react';
import { Button, StatusBadge, Tag } from '@basis/ui';
import { busy, type VM } from '../domain';
import {
  canChangePlatform,
  groupAccountId,
  listPlatformRecords,
  platformRecordName,
} from '../platform-model';
import { useCloud } from './cloud-state';
import { navigate, Panel } from './parts';
import {
  CopyValue,
  DetailFacts,
  RecentVmTasks,
  ResourceConnection,
  ResourceIdentity,
  ResourceMetrics,
} from './ResourceDetails';

export function VmOverview({ vm, onEdit }: { vm: VM; onEdit: () => void }) {
  const { data: source } = useCloud(),
    data = source!;
  const host = data.hosts.find((h) => h.id === vm.hostId);
  const zone = data.clusters.find((c) => c.id === host?.clusterId);
  const network = data.networks.find((n) => n.id === vm.networkId);
  const volumes = data.volumes.filter((v) => v.vmId === vm.id);
  const record = listPlatformRecords(data, 'vms').find((r) => r.id === vm.id)!;
  const accountId = groupAccountId(data, vm.projectId);
  const tasks = data.tasks.filter((task) => task.vmIds.includes(vm.id));
  const running = vm.status === 'running';
  const measured = (percent: number) =>
    running ? (
      <>
        <b>{percent}%</b> · текущая нагрузка
      </>
    ) : (
      'Нет текущих измерений'
    );
  return (
    <div className="resource-overview">
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
            note: measured(vm.cpuUsage),
            progress: running ? vm.cpuUsage : undefined,
            progressLabel: 'Нагрузка',
            warning: vm.cpuUsage > 85,
            href: `#cloud/vms/${vm.id}/resources`,
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
            note: running ? (
              <>
                <b>
                  {((vm.memory * vm.memoryUsage) / 100).toLocaleString('ru-RU', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  GiB
                </b>{' '}
                используется · {vm.memoryUsage}%
              </>
            ) : (
              'Нет текущих измерений'
            ),
            progress: running ? vm.memoryUsage : undefined,
            progressLabel: 'Использовано',
            warning: vm.memoryUsage > 85,
            href: `#cloud/vms/${vm.id}/resources`,
          },
          {
            label: 'Диски',
            icon: 'HardDrive',
            value: (
              <>
                {volumes.reduce((sum, v) => sum + v.size, 0)}
                <small>GiB</small>
              </>
            ),
            note: `Подключено дисков: ${volumes.length} · ${volumes.filter((v) => v.boot).length} системный`,
            href: `#cloud/vms/${vm.id}/resources`,
          },
        ]}
      />
      <div className="platform-detail-grid resource-detail-grid">
        <Panel
          title="Конфигурация"
          action={
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Pencil />}
              disabled={busy(vm) || Boolean(canChangePlatform(data, 'vms'))}
              onClick={onEdit}
            >
              Изменить
            </Button>
          }
        >
          <DetailFacts
            layout="grid"
            items={[
              {
                label: 'Образ системы',
                description: 'Образ, из которого создана гостевая система.',
                value: record.imageId ? (
                  <a href={`#cloud/images/${record.imageId}`}>{vm.template}</a>
                ) : (
                  vm.template
                ),
              },
              {
                label: 'Политика хранения',
                description: 'Правила размещения дисков машины.',
                value: record.policyId ? (
                  <a href={`#cloud/storage-policies/${record.policyId}`}>
                    {platformRecordName(data, 'storage-policies', record.policyId)}
                  </a>
                ) : (
                  <span className="resource-unset">Не задана</span>
                ),
              },
              {
                label: 'Чипсет',
                value: <span className="cloud-mono">{String(record.chipset || '—')}</span>,
              },
              {
                label: 'Метки',
                value: vm.tags.length ? (
                  <span className="platform-tags">
                    {vm.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </span>
                ) : (
                  <span className="resource-unset">Не назначены</span>
                ),
              },
            ]}
          />
          <section className="resource-subsection">
            <h3>Рабочая область и размещение</h3>
            <div className="vm-context-pair">
              <ResourceConnection
                icon="Building2"
                label="Аккаунт"
                name={platformRecordName(data, 'accounts', accountId)}
                href={accountId ? `#cloud/accounts/${accountId}` : undefined}
              />
              <ResourceConnection
                icon="FolderKanban"
                label="Ресурсная группа"
                name={platformRecordName(data, 'projects', vm.projectId)}
                href={`#cloud/projects/${vm.projectId}`}
              />
              <ResourceConnection
                icon="MapPin"
                label="Зона размещения"
                name={zone?.name || 'Зона не назначена'}
                href={zone ? `#cloud/clusters/${zone.id}` : undefined}
              />
              <ResourceConnection
                icon="Server"
                label="Вычислительный узел"
                name={host?.name || 'Узел не назначен'}
                href={host ? `#cloud/nodes/${host.id}` : undefined}
              />
            </div>
          </section>
        </Panel>
        <aside className="platform-detail-aside">
          <Panel
            title="Подключение"
            action={
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowUpRight />}
                onClick={() => navigate(`vms/${vm.id}/network`)}
              >
                Сеть
              </Button>
            }
          >
            <div className="vm-address">
              <div>
                <small>Приватный IPv4</small>
                <strong className="cloud-mono">{vm.ip || 'Не назначен'}</strong>
              </div>
              {vm.ip && <CopyValue value={vm.ip} label="IP-адрес" />}
            </div>
            <DetailFacts
              layout="grid"
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
                  label: 'Назначение адреса',
                  value: vm.dhcp ? 'DHCP' : 'Статическое',
                },
              ]}
            />
          </Panel>
          <Panel
            title="Защита"
            emphasis="quiet"
            action={
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowUpRight />}
                onClick={() => navigate(`vms/${vm.id}/security`)}
              >
                Подробнее
              </Button>
            }
          >
            <DetailFacts
              layout="grid"
              items={[
                {
                  label: 'Политика защиты',
                  value: vm.backup ? (
                    <StatusBadge tone="success">Включена</StatusBadge>
                  ) : (
                    <span className="resource-unset">Не назначена</span>
                  ),
                },
                {
                  label: 'Снимки',
                  value: (
                    <a href={`#cloud/vms/${vm.id}/snapshots`} className="cloud-number">
                      {vm.snapshots.length}
                    </a>
                  ),
                },
                {
                  label: 'Группа безопасности',
                  value: record.securityGroupId ? (
                    <a href={`#cloud/security-groups/${record.securityGroupId}`}>
                      {platformRecordName(data, 'security-groups', record.securityGroupId)}
                    </a>
                  ) : (
                    <span className="resource-unset">Не назначена</span>
                  ),
                },
                {
                  label: 'Изменения',
                  value: record.locked ? (
                    <StatusBadge tone="warning">Заблокированы</StatusBadge>
                  ) : (
                    'Разрешены'
                  ),
                },
              ]}
            />
          </Panel>
        </aside>
      </div>
      {tasks.length > 0 && <RecentVmTasks tasks={tasks} href={`vms/${vm.id}/activity`} />}
      <ResourceIdentity row={vm} />
      <p className="resource-demo-note">Показатели нагрузки — демонстрационные.</p>
    </div>
  );
}
